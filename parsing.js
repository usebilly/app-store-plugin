// Shared helpers for the App Store Connect Payments importer.

// Split a single CSV line into fields, honoring double-quoted fields.
function splitLine(line, delimiter) {
	var fields = [];
	var current = '';
	var inQuotes = false;

	for (var i = 0; i < line.length; i++) {
		var ch = line[i];

		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (ch === delimiter && !inQuotes) {
			fields.push(current);
			current = '';
		} else {
			current += ch;
		}
	}
	fields.push(current);
	return fields;
}

exports.splitLine = splitLine;

// Parse a numeric cell from the report.
exports.parseAmount = function(value) {
	if (value == null) return NaN;
	var text = String(value).trim();
	if (!text) return NaN;

	var negative = /^\(.*\)$/.test(text);

	// Keep digits, dot and minus; drop thousands commas, currency letters, spaces.
	var cleaned = text.replace(/,/g, '').replace(/[^0-9.\-]/g, '');
	if (cleaned === '' || cleaned === '-' || cleaned === '.') return NaN;

	var number = parseFloat(cleaned);
	if (isNaN(number)) return NaN;
	return negative ? -Math.abs(number) : number;
};

// Round to 2 decimals to keep away from floating-point noise.
exports.round2 = function(value) {
	return Math.round((value + Number.EPSILON) * 100) / 100;
};

// Drop a trailing currency code from a region label.
exports.regionName = function(label) {
	return String(label == null ? '' : label)
		.replace(/\s*\([A-Za-z]{3}\)\s*$/, '')
		.trim();
};

// Month names to a 1-based number: English (full and common abbreviations) and German.
// The report title is localized, so its month name is in the account’s language.
var MONTHS = {
	january: 1,
	february: 2,
	march: 3,
	april: 4,
	may: 5,
	june: 6,
	july: 7,
	august: 8,
	september: 9,
	october: 10,
	november: 11,
	december: 12,
	jan: 1,
	feb: 2,
	mar: 3,
	apr: 4,
	jun: 6,
	jul: 7,
	aug: 8,
	sep: 9,
	sept: 9,
	oct: 10,
	nov: 11,
	dec: 12,
	// German, French, Spanish, Italian, Dutch, Portuguese. Each block lists only the spellings not already covered above, so no name maps to two months.
	// German.
	januar: 1,
	februar: 2,
	märz: 3,
	mai: 5,
	juni: 6,
	juli: 7,
	oktober: 10,
	dezember: 12,
	// French.
	janvier: 1,
	février: 2,
	mars: 3,
	avril: 4,
	juin: 6,
	juillet: 7,
	août: 8,
	septembre: 9,
	octobre: 10,
	novembre: 11,
	décembre: 12,
	// Spanish.
	enero: 1,
	febrero: 2,
	marzo: 3,
	abril: 4,
	mayo: 5,
	junio: 6,
	julio: 7,
	agosto: 8,
	septiembre: 9,
	octubre: 10,
	noviembre: 11,
	diciembre: 12,
	// Italian.
	gennaio: 1,
	febbraio: 2,
	aprile: 4,
	maggio: 5,
	giugno: 6,
	luglio: 7,
	settembre: 9,
	ottobre: 10,
	dicembre: 12,
	// Dutch.
	januari: 1,
	februari: 2,
	maart: 3,
	mei: 5,
	augustus: 8,
	// Portuguese.
	janeiro: 1,
	fevereiro: 2,
	março: 3,
	maio: 5,
	junho: 6,
	julho: 7,
	setembro: 9,
	outubro: 10,
	novembro: 11,
	dezembro: 12,
};

// Extract { year, month } (month 1-based) from a report title line such as `iTunes Connect - Payments and Financial Reports\t(June, 2026)`.
exports.parsePeriod = function(titleLine) {
	if (!titleLine) return null;
	var text = String(titleLine);

	var yearMatch = text.match(/\b(20\d{2})\b/);
	if (!yearMatch) return null;

	var lower = text.toLowerCase();
	for (var name in MONTHS) {
		if (!MONTHS.hasOwnProperty(name)) continue;
		if (new RegExp('\\b' + name + '\\b').test(lower)) {
			return { year: parseInt(yearMatch[1], 10), month: MONTHS[name] };
		}
	}
	return null;
};

function pad(n) {
	return (n < 10 ? '0' : '') + n;
}

// First day of the month as an ISO "yyyy-MM-dd" string.
exports.startOfMonth = function(year, month) {
	return year + '-' + pad(month) + '-01';
};

// Last day of the month as an ISO "yyyy-MM-dd" string.
exports.endOfMonth = function(year, month) {
	var lastDay = new Date(year, month, 0).getDate();
	return year + '-' + pad(month) + '-' + pad(lastDay);
};

// First day of the month after the given one, as an ISO "yyyy-MM-dd" string.
exports.firstOfNextMonth = function(year, month) {
	var y = month >= 12 ? year + 1 : year;
	var m = month >= 12 ? 1 : month + 1;
	return y + '-' + pad(m) + '-01';
};
