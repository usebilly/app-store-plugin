var parsing = require('./parsing.js');
var recipients = require('./recipients.js');
var csvReport = require('./csv-report.js');
var txtReport = require('./txt-report.js');

// Turns an App Store Connect report into one invoice per legally accountable Apple subsidiary (and per currency).
// Two report formats are supported: the monthly Payments and Financial Report (CSV) and the Financial Report (tab-separated TXT). Billy hands over only the file content, so the format is recognized from it.

exports.importInvoices = function(fileContent, profile) {
	var lines = String(fileContent).split(/\r?\n/);
	var language = (profile && profile.language) || 'en';

	// The TXT check runs first: it’s the stricter one, and the CSV title line also contains a tab.
	var report = null;
	if (txtReport.matches(lines)) {
		report = txtReport.parse(lines, language);
	} else if (csvReport.matches(lines)) {
		report = csvReport.parse(lines);
	}
	if (!report) return [];

	return buildInvoices(report, profile, language);
};

// Group the report’s entries by Apple subsidiary and currency, one line item each, and wrap every group into an invoice patch.
function buildInvoices(report, profile, language) {
	var prefixes = language === 'de' ? { lumpSum: 'App-Store-Erlöse: ', refund: 'Erstattung: ' } : { lumpSum: 'App Store proceeds: ', refund: 'Refund: ' };
	var fallbackCurrency = (profile && profile.currency) || 'EUR';

	// Reverse charge applies only when invoicing the Irish entity from another EU member state.
	// If our own tax residency is Ireland the supply is domestic (Irish VAT); outside the EU the EU mechanism doesn’t apply.
	var taxResidency = String((profile && profile.taxResidency) || '').toUpperCase();
	var reverseCharge = recipients.isEuMemberState(taxResidency) && taxResidency !== 'IE';

	var groups = {}; // "corp|currency" -> { corp, currency, items }
	report.entries.forEach(function(entry) {
		var unitPrice = parsing.round2(entry.unitPrice);
		if (unitPrice === 0 || !entry.quantity) return;

		var currency = entry.currency || fallbackCurrency;
		var key = entry.corp + '|' + currency;
		if (!groups[key]) groups[key] = { corp: entry.corp, currency: currency, items: [] };
		groups[key].items.push({
			description: describe(entry, prefixes),
			quantity: entry.quantity,
			unit: entry.unit,
			unitPrice: unitPrice,
			// VAT is 0 on every line: reverse charge for the EU (Ireland) entity, out-of-scope export for the others.
			vatPercentage: 0,
		});
	});

	return orderedGroups(groups).map(function(group) {
		// No date is set, so Billy dates the invoice today—like a new invoice.
		var patch = {
			recipient: recipients.recipientFor(group.corp),
			currency: group.currency,
				showPaymentPeriod: false,
				showBankDetails: false,
			items: group.items,
		};
		if (report.period) {
			patch.serviceDateStart = report.period.serviceDateStart;
			patch.serviceDateEnd = report.period.serviceDateEnd;
		}
		// Only the Irish entity gets a reverse-charge notice, and only when the developer is EU-established outside Ireland.
		if (group.corp === 'EU' && reverseCharge) {
			patch.marginalNote = reverseChargeNotice(language);
		}
		return patch;
	});
}

// Lump sums name the region they total up; itemized purchases carry the product name, and refunds are marked as such.
function describe(entry, prefixes) {
	if (entry.refund) return prefixes.refund + entry.label;
	if (entry.unit === 'Lump Sum') return prefixes.lumpSum + entry.label;
	return entry.label;
}

// EU-Directive reverse-charge wording (jurisdiction-neutral, not tied to any single member state’s VAT act), including the recipient’s VAT ID since the invoice has no dedicated field for it.
function reverseChargeNotice(language) {
	var vatId = recipients.vatIdEurope;
	if (language === 'de') {
		return 'Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, Art. 196 RL 2006/112/EG). USt-IdNr. des Leistungsempfängers: ' + vatId + '.';
	}
	return 'Reverse charge: VAT to be accounted for by the recipient (Art. 196 Directive 2006/112/EC). Recipient VAT ID: ' + vatId + '.';
}

// Groups in the preferred subsidiary order, currencies in order of appearance within a subsidiary, and any unexpected corp codes appended at the end so nothing is silently dropped.
function orderedGroups(groups) {
	var keys = Object.keys(groups);
	var rank = function(corp) {
		var index = recipients.CORP_ORDER.indexOf(corp);
		return index === -1 ? recipients.CORP_ORDER.length : index;
	};
	return keys
		.map(function(key, position) {
			return { group: groups[key], position: position };
		})
		.sort(function(first, second) {
			return rank(first.group.corp) - rank(second.group.corp) || first.position - second.position;
		})
		.map(function(wrapper) {
			return wrapper.group;
		});
}
