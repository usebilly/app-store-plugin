var parsing = require('./parsing.js');
var recipients = require('./recipients.js');

// Reads App Store Connect’s monthly Payments and Financial Report (CSV): one row per payout region, proceeds already converted to the bank account currency.

// True when the file is an App Store Connect financial report. The title carries Apple’s product name, which stays in English regardless of the report’s language.
exports.matches = function(lines) {
	for (var i = 0; i < lines.length; i++) {
		var lower = lines[i].toLowerCase();
		if (lower.indexOf('itunes connect') !== -1 || lower.indexOf('app store connect') !== -1) {
			return true;
		}
	}
	return false;
};

// Returns { entries: [{ corp, currency, label, quantity, unit, unitPrice }], period: { serviceDateStart, serviceDateEnd, date } | null }, or null when no table is found.
exports.parse = function(lines) {
	// Find the header row. Rather than match localized column names, spot it structurally: the first row whose region cell is set and whose next cell is a text label (data rows carry the units-sold number there).
	var headerIndex = -1;
	var header = null;
	for (var i = 0; i < lines.length; i++) {
		var fields = parsing.splitLine(lines[i], ',').map(parsing.trim);
		if (fields[0] && fields[1] && isNaN(parsing.parseAmount(fields[1]))) {
			headerIndex = i;
			header = fields;
			break;
		}
	}
	if (headerIndex === -1) return null;

	// Apple’s report always leads with the region/currency column; Proceeds is the last value column and the bank-account currency the last column. Prefer the English names when present, else fall back to those fixed positions so localized reports still map.
	var lastColumn = lastNonEmptyIndex(header);
	var regionIndex = 0;
	var proceedsIndex = header.indexOf('Proceeds');
	if (proceedsIndex === -1) proceedsIndex = lastColumn - 1;
	var currencyIndex = headerIndexOf(header, 'Bank Account Currency');
	if (currencyIndex === -1) currencyIndex = lastColumn;

	// Reporting period from the title line, e.g. "(June, 2026)".
	var period = null;
	for (var p = 0; p <= headerIndex && p < lines.length; p++) {
		period = parsing.parsePeriod(lines[p]);
		if (period) break;
	}

	// Apple already expresses proceeds in the bank account currency, so the amounts sum straight to what was paid out—per subsidiary and overall.
	var entries = [];
	var currency = null;

	for (var r = headerIndex + 1; r < lines.length; r++) {
		var row = parsing.splitLine(lines[r], ',');

		var region = parsing.trim(row[regionIndex]);
		// The first row without a region ends the paid table. Stopping here skips the summary and “Paid to …” rows, and—crucially—the separate “Estimated Proceeds” table Apple appends: those aren’t paid out yet and must not be invoiced.
		if (!region) break;

		var proceeds = parsing.parseAmount(row[proceedsIndex]);
		if (isNaN(proceeds) || proceeds === 0) continue;

		if (!currency) {
			var code = parsing.trim(row[currencyIndex]);
			if (code) currency = code;
		}

		entries.push({
			corp: recipients.corpForRegion(region).corp,
			label: parsing.regionName(region),
			// The report only has regional totals, so each region is one lump sum.
			quantity: 1,
			unit: 'Lump Sum',
			unitPrice: proceeds,
		});
	}

	// Every row pays out in the same bank account currency; null lets the caller fall back to the profile currency.
	entries.forEach(function(entry) {
		entry.currency = currency;
	});

	return {
		entries: entries,
		period: period
			? {
					serviceDateStart: parsing.startOfMonth(period.year, period.month),
					serviceDateEnd: parsing.endOfMonth(period.year, period.month),
					// Issue date: the first of the month after the reporting period.
					date: parsing.firstOfNextMonth(period.year, period.month),
				}
			: null,
	};
};

// Index of the last non-empty cell (the report leaves a trailing empty field after the last column).
function lastNonEmptyIndex(fields) {
	for (var i = fields.length - 1; i >= 0; i--) {
		if (fields[i]) return i;
	}
	return -1;
}

// Find a column by a label substring.
function headerIndexOf(header, needle) {
	for (var i = 0; i < header.length; i++) {
		if (header[i].indexOf(needle) !== -1) return i;
	}
	return -1;
}
