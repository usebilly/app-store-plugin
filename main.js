var parsing = require('./parsing.js');
var recipients = require('./recipients.js');

// Turns one App Store Connect monthly Payments and Financial Report into one invoice per legally accountable Apple subsidiary.

exports.importInvoices = function(fileContent, profile) {
	var lines = String(fileContent).split(/\r?\n/);

	// 1. Find the header row — the one that carries the "Proceeds" column.
	var headerIndex = -1;
	var header = null;
	for (var i = 0; i < lines.length; i++) {
		var fields = parsing.splitLine(lines[i], ',').map(trim);
		if (fields.indexOf('Proceeds') !== -1 && fields.indexOf('Units Sold') !== -1) {
			headerIndex = i;
			header = fields;
			break;
		}
	}
	if (headerIndex === -1) return []; // Not an App Store Connect financial report.

	var regionIdx = headerIndexOf(header, 'Country or Region');
	var proceedsIdx = header.indexOf('Proceeds');
	var currencyIdx = headerIndexOf(header, 'Bank Account Currency');
	if (regionIdx === -1) regionIdx = 0;

	// 2. Reporting period from the title line, e.g. "(June, 2026)".
	var period = null;
	for (var p = 0; p <= headerIndex && p < lines.length; p++) {
		period = parsing.parsePeriod(lines[p]);
		if (period) break;
	}

	// 3. Group region rows by the Apple subsidiary that billed them.
	//    Apple already expresses proceeds in the bank account currency, so the amounts sum straight to what was paid out — per subsidiary and overall.
	var lang = (profile && profile.language) || 'en';
	var prefix = lang === 'de' ? 'App-Store-Erlöse: ' : 'App Store proceeds: ';

	// Reverse charge applies only when invoicing the Irish entity from another EU member state.
	// If our own tax residency is Ireland the supply is domestic (Irish VAT); outside the EU the EU mechanism doesn’t apply.
	var taxResidency = String((profile && profile.taxResidency) || '').toUpperCase();
	var reverseCharge = recipients.isEuMemberState(taxResidency) && taxResidency !== 'IE';

	var groups = {}; // corp code -> array of line items
	var currency = null;

	for (var r = headerIndex + 1; r < lines.length; r++) {
		if (!lines[r].trim()) continue;
		var row = parsing.splitLine(lines[r], ',');

		var region = trim(row[regionIdx] || '');
		if (!region) continue; // Summary and "Paid to …" rows have no region.

		var proceeds = parsing.parseAmount(row[proceedsIdx]);
		if (isNaN(proceeds) || proceeds === 0) continue;

		if (!currency && currencyIdx !== -1) {
			var code = trim(row[currencyIdx] || '');
			if (code) currency = code;
		}

		var corp = recipients.corpForRegion(region).corp;
		if (!groups[corp]) groups[corp] = [];
		groups[corp].push({
			description: prefix + parsing.regionName(region),
			quantity: 1,
			unit: 'Lump Sum',
			unitPrice: parsing.round2(proceeds),
			// VAT is 0 on every line: reverse charge for the EU (Ireland) entity, out-of-scope export for the others.
			vatPercentage: 0,
		});
	}

	// 4. One invoice per subsidiary that has proceeds, in a stable order.
	var payoutCurrency = currency || (profile && profile.currency) || 'EUR';
	var order = orderedCorps(groups);
	var patches = [];

	for (var c = 0; c < order.length; c++) {
		var patch = {
			recipient: recipients.recipientFor(order[c]),
			currency: payoutCurrency,
			items: groups[order[c]],
		};
		if (period) {
			patch.serviceDateStart = parsing.startOfMonth(period.year, period.month);
			patch.serviceDateEnd = parsing.endOfMonth(period.year, period.month);
			// Issue date: the first of the month after the reporting period.
			patch.date = parsing.firstOfNextMonth(period.year, period.month);
		}
		// Only the Irish entity gets a reverse-charge notice, and only when the developer is EU-established outside Ireland.
		if (order[c] === 'EU' && reverseCharge) {
			patch.marginalNote = reverseChargeNotice(lang);
		}
		patches.push(patch);
	}

	return patches;
};

function trim(value) {
	return String(value == null ? '' : value).trim();
}

// EU-Directive reverse-charge wording (jurisdiction-neutral, not tied to any single member state’s VAT act), including the recipient’s VAT ID since the invoice has no dedicated field for it.
function reverseChargeNotice(lang) {
	var vatId = recipients.vatIdEurope;
	if (lang === 'de') {
		return 'Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, Art. 196 RL 2006/112/EG). USt-IdNr. des Leistungsempfängers: ' + vatId + '.';
	}
	return 'Reverse charge: VAT to be accounted for by the recipient (Art. 196 Directive 2006/112/EC). Recipient VAT ID: ' + vatId + '.';
}

// Find a column by a label substring.
function headerIndexOf(header, needle) {
	for (var i = 0; i < header.length; i++) {
		if (header[i].indexOf(needle) !== -1) return i;
	}
	return -1;
}

// Corp codes present in `groups`, following the preferred order and appending any unexpected codes at the end so nothing is silently dropped.
function orderedCorps(groups) {
	var order = [];
	var seen = {};
	recipients.CORP_ORDER.forEach(function(corp) {
		if (groups[corp]) {
			order.push(corp);
			seen[corp] = true;
		}
	});
	Object.keys(groups).forEach(function(corp) {
		if (!seen[corp]) order.push(corp);
	});
	return order;
}
