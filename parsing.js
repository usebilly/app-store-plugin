// Shared helpers for the App Store Connect report importers.

// Split a single delimited line (comma for CSV, tab for TXT) into fields, honoring double-quoted fields.
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

exports.trim = function(value) {
	return String(value == null ? '' : value).trim();
};

// Parse a numeric cell from the report, in US (“1,234.50”) or European (“1.234,50”) notation.
exports.parseAmount = function(value) {
	if (value == null) return NaN;
	var text = String(value).trim();
	if (!text) return NaN;

	var negative = /^\(.*\)$/.test(text);

	// Keep digits, separators and minus; drop currency letters and spaces.
	var cleaned = normalizeSeparators(text.replace(/[^0-9.,\-]/g, ''));
	if (cleaned === '' || cleaned === '-' || cleaned === '.') return NaN;

	var number = parseFloat(cleaned);
	if (isNaN(number)) return NaN;
	return negative ? -Math.abs(number) : number;
};

// Rewrite a number to use a dot as the only decimal separator.
// With both separators, the last one is the decimal separator. A lone comma followed by anything but three digits is a decimal comma (“2,14”); otherwise commas group thousands (“1,234”). Several dots group thousands (“1.234.567”), a single dot stays a decimal point.
function normalizeSeparators(text) {
	var lastComma = text.lastIndexOf(',');
	var lastDot = text.lastIndexOf('.');
	if (lastComma !== -1 && lastDot !== -1) {
		return lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
	}
	if (lastComma !== -1) {
		var commaCount = text.split(',').length - 1;
		var decimalCount = text.length - lastComma - 1;
		return commaCount === 1 && decimalCount !== 3 ? text.replace(',', '.') : text.replace(/,/g, '');
	}
	if (text.split('.').length > 2) return text.replace(/\./g, '');
	return text;
}

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

// A date cell as { year, month, day }, or null when the text isn’t a valid date.
// Understands ISO “2026-08-19”, European “19.08.2026”, and slash dates—month-first “08/19/2026” (US), or day-first “19/08/2026” when dayFirst is set.
exports.parseDate = function(text, dayFirst) {
	var value = String(text == null ? '' : text).trim();
	var match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
	if (match) return validDate(match[1], match[2], match[3]);
	match = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
	if (match) return validDate(match[3], match[2], match[1]);
	match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (match) return dayFirst ? validDate(match[3], match[2], match[1]) : validDate(match[3], match[1], match[2]);
	return null;
};

function validDate(yearText, monthText, dayText) {
	var year = parseInt(yearText, 10);
	var month = parseInt(monthText, 10);
	var day = parseInt(dayText, 10);
	if (month < 1 || month > 12 || day < 1 || day > new Date(year, month, 0).getDate()) return null;
	return { year: year, month: month, day: day };
}

// A date as an ISO "yyyy-MM-dd" string.
exports.isoDate = function(year, month, day) {
	return year + '-' + pad(month) + '-' + pad(day);
};

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
