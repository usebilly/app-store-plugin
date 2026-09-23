var parsing = require('./parsing.js');
var recipients = require('./recipients.js');

// Reads App Store Connect’s Financial Report (tab-separated TXT): one row per transaction, amounts in the currency of the sale—not converted to the bank account currency.
// Unlike the CSV’s regional lump sums, this report lists every purchase and return, so the invoice itemizes them.

// Apple names the columns in English; a report with other names (e.g. translated) falls back to the fixed positions of Apple’s layout.
var COLUMNS = {
	sku: { name: 'SKU', fallbackIndex: 3 },
	title: { name: 'Title', fallbackIndex: 4 },
	country: { name: 'Country of Sale', fallbackIndex: 7 },
	quantity: { name: 'Quantity', fallbackIndex: 8 },
	price: { name: 'Partner Share', fallbackIndex: 9 },
	amount: { name: 'Extended Partner Share', fallbackIndex: 10 },
	currency: { name: 'Partner Share Currency', fallbackIndex: 11 },
};

// Apple’s transaction rows have 18 columns; requiring most of them keeps short tables—like the per-country summary—from passing as transactions.
var MINIMUM_TRANSACTION_COLUMNS = 12;

// The report is recognized by its structure, not by its labels, so it’s found whatever language they’re in: a tab-separated table whose rows start with a transaction date and a settlement date.
exports.matches = function(lines) {
	return lines.map(splitRow).some(isTransactionRow);
};

// Returns { entries: [{ corp, currency, label, quantity, unit, unitPrice, refund }], period: { serviceDateStart, serviceDateEnd, date } | null }, or null when no table is found.
exports.parse = function(lines, language) {
	var rows = lines.map(splitRow);
	var dayFirst = slashDatesAreDayFirst(rows);

	// One line item per product, country, price and direction: identical purchases add up to a quantity, while refunds get their own line so they stay visible on the invoice.
	var lineItems = {};
	var products = {}; // product key -> order of first appearance
	var productCount = 0;
	var firstTransactionIndex = -1;
	var index = columnIndexes([]);

	for (var r = 0; r < rows.length; r++) {
		var row = rows[r];
		if (!isTransactionRow(row)) {
			// The row right above a transaction is its table’s header. Anything else—the preamble, blank lines, the per-country summary Apple appends—is skipped, so nothing is counted twice.
			if (r + 1 < rows.length && isTransactionRow(rows[r + 1])) index = columnIndexes(row);
			continue;
		}
		if (firstTransactionIndex === -1) firstTransactionIndex = r;

		var quantity = parsing.parseAmount(row[index.quantity]);
		var price = parsing.parseAmount(row[index.price]);
		var amount = parsing.parseAmount(row[index.amount]);
		if (isNaN(quantity) || isNaN(price) || quantity === 0 || price === 0) continue;

		// A row whose country or currency isn’t an ISO code was read from the wrong columns; skipping it beats invoicing it to the wrong Apple company.
		var country = row[index.country].toUpperCase();
		var currency = row[index.currency].toUpperCase();
		if (!/^[A-Z]{2}$/.test(country) || !/^[A-Z]{3}$/.test(currency)) continue;

		// Returns carry a negative quantity and extended amount; the per-unit partner share stays positive.
		var refund = quantity < 0 || amount < 0;
		var product = row[index.title] || row[index.sku];

		var productKey = [currency, country, row[index.sku] || product].join('|');
		if (!products.hasOwnProperty(productKey)) products[productKey] = productCount++;

		var unitPrice = parsing.round2(Math.abs(price));
		var key = [productKey, unitPrice, refund].join('|');
		if (!lineItems[key]) {
			lineItems[key] = {
				// The country of sale decides the Apple subsidiary, as in Apple’s agreement.
				corp: recipients.corpForCountry(country, currency),
				currency: currency,
				label: product + ', ' + countryName(country, language),
				quantity: 0,
				unit: 'Piece',
				// Refunds follow Billy’s cancellation convention: positive quantity, negative price.
				unitPrice: refund ? -unitPrice : unitPrice,
				refund: refund,
				productOrder: products[productKey],
			};
		}
		lineItems[key].quantity += Math.abs(quantity);
	}
	if (firstTransactionIndex === -1) return null;

	// Products in order of first appearance; within a product, sales before refunds and higher prices first.
	var entries = Object.keys(lineItems)
		.map(function(key) {
			return lineItems[key];
		})
		.sort(function(first, second) {
			return first.productOrder - second.productOrder || first.refund - second.refund || Math.abs(second.unitPrice) - Math.abs(first.unitPrice);
		});
	entries.forEach(function(entry) {
		delete entry.productOrder;
	});

	return { entries: entries, period: parsePeriod(rows.slice(0, firstTransactionIndex), dayFirst) };
};

function splitRow(line) {
	return parsing.splitLine(line, '\t').map(parsing.trim);
}

function isDate(text) {
	return !!(parsing.parseDate(text, false) || parsing.parseDate(text, true));
}

function isTransactionRow(row) {
	return row.length >= MINIMUM_TRANSACTION_COLUMNS && isDate(row[0]) && isDate(row[1]);
}

// Column positions for a header row: by English name where present, else Apple’s fixed position.
function columnIndexes(header) {
	var index = {};
	for (var column in COLUMNS) {
		if (!COLUMNS.hasOwnProperty(column)) continue;
		var position = header.indexOf(COLUMNS[column].name);
		index[column] = position === -1 ? COLUMNS[column].fallbackIndex : position;
	}
	return index;
}

// Apple writes slash dates month-first (US). A first number above 12 anywhere in the file can only be a day, so then the whole file is read day-first.
function slashDatesAreDayFirst(rows) {
	return rows.some(function(row) {
		return row.some(function(field) {
			var match = field.match(/^(\d{1,2})\/\d{1,2}\/\d{4}$/);
			return match && parseInt(match[1], 10) > 12;
		});
	});
}

// The preamble holds the start and end date of Apple’s fiscal month, in that order. They’re read by position—the first two dates—rather than by their labels.
// The fiscal month rarely matches the calendar month (e.g. 06/28–08/01 for July), so the service period uses those exact dates.
// The fiscal month is the calendar month holding the middle of that range; the invoice is dated the first of the month after it, like the CSV report.
function parsePeriod(preambleRows, dayFirst) {
	var dates = [];
	preambleRows.forEach(function(row) {
		row.forEach(function(field) {
			var date = parsing.parseDate(field, dayFirst);
			if (date) dates.push(date);
		});
	});
	if (dates.length < 2) return null;

	var start = dates[0];
	var end = dates[1];
	var startTime = Date.UTC(start.year, start.month - 1, start.day);
	var endTime = Date.UTC(end.year, end.month - 1, end.day);
	if (endTime < startTime) return null;
	var middle = new Date((startTime + endTime) / 2);

	return {
		serviceDateStart: parsing.isoDate(start.year, start.month, start.day),
		serviceDateEnd: parsing.isoDate(end.year, end.month, end.day),
		date: parsing.firstOfNextMonth(middle.getUTCFullYear(), middle.getUTCMonth() + 1),
	};
}

// Localized country name for an ISO 3166-1 code, e.g. “DE” → “Deutschland”. Falls back to the code where the JavaScript engine lacks Intl.DisplayNames.
function countryName(code, language) {
	try {
		var name = new Intl.DisplayNames([language], { type: 'region', fallback: 'none' }).of(code);
		if (name) return name;
	} catch (error) {}
	return code;
}
