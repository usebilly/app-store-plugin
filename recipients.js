// Apple’s legally accountable subsidiaries per App Store storefront, and the mapping from a payout-report region to the subsidiary that billed it.

// Subsidiary names, addresses and the country→subsidiary attribution follow Schedule 2, Exhibit A of Apple’s Paid Applications Agreement: https://developer.apple.com/support/downloads/terms/schedules/Schedule-2-and-3-English.pdf
// Ported from fedoco/apple-slicer: https://github.com/fedoco/apple-slicer

// Apple’s European VAT ID — worth adding to the Ireland invoice by hand, since the import patch can’t set a recipient VAT number.
var VAT_ID_EUROPE = 'IE9700053D';

// One recipient per subsidiary code. Addresses use Billy’s structured fields.
var RECIPIENTS = {
	EU: {
		name: 'Apple Distribution International Limited',
		address: { lineOne: 'Hollyhill Industrial Estate', lineTwo: 'Hollyhill', postcode: 'T23 YK84', city: 'Cork', country: 'IE' },
	},
	US: {
		name: 'Apple Inc.',
		address: { lineOne: 'One Apple Park Way', postcode: '95014', city: 'Cupertino', state: 'CA', country: 'US' },
	},
	CA: {
		name: 'Apple Canada Inc.',
		address: { lineOne: '120 Bremner Boulevard', lineTwo: 'Suite 1600', postcode: 'M5J 0A8', city: 'Toronto', state: 'ON', country: 'CA' },
	},
	LL: {
		name: 'Apple Services LATAM LLC',
		address: { lineOne: '1 Alhambra Plaza', lineTwo: 'Suite 700', postcode: '33134', city: 'Coral Gables', state: 'FL', country: 'US' },
	},
	AU: {
		name: 'Apple Pty Limited',
		address: { lineOne: 'Level 3, 20 Martin Place', postcode: '2000', city: 'Sydney', state: 'NSW', country: 'AU' },
	},
	JP: {
		name: 'iTunes K.K.',
		address: { lineOne: '6-10-1 Roppongi', lineTwo: 'Minato-ku', postcode: '106-6140', city: 'Tokyo', country: 'JP' },
	},
	AP: {
		name: 'Apple Services Pte. Ltd.',
		address: { lineOne: '7 Ang Mo Kio Street 64', postcode: '569086', city: 'Singapore', country: 'SG' },
	},
};

// Preferred order for the invoices we emit (largest / most common first).
var CORP_ORDER = ['EU', 'US', 'CA', 'LL', 'AU', 'JP', 'AP'];

// Apple Distribution International (Ireland) is the default: apple-slicer’s `europe` bucket covers the large majority of Apple’s territories—not just Europe, but China, India, Indonesia, Malaysia, Singapore, Nigeria and more.
var DEFAULT_CORP = 'EU';

// The payments report lists one row per payout currency, and each row’s region label ends with an ISO-4217 currency code, e.g. “Australien (AUD)”. The subsidiary gets defined by that code.
// Only the currencies billed by a non-Ireland entity are listed here—every other code (EUR, GBP, CHF, CNY, INR, IDR, MYR, NGN, RON, SGD, …) falls through to DEFAULT_CORP.
var CURRENCY_RULES = {
	AUD: 'AU', // Australia
	NZD: 'AU', // New Zealand
	CAD: 'CA', // Canada
	JPY: 'JP', // Japan
	KRW: 'AP', // South Korea (apple-slicer’s `apac` bucket)
	USD: 'US', // Americas
	BRL: 'LL', // Brazil
	MXN: 'LL', // Mexico
	CLP: 'LL', // Chile
	COP: 'LL', // Colombia
	PEN: 'LL', // Peru
	ARS: 'LL', // Argentina
};

exports.CORP_ORDER = CORP_ORDER;

// Subsidiary code for an ISO-4217 payout currency.
function corpForCurrency(code) {
	return CURRENCY_RULES[String(code || '').toUpperCase()] || DEFAULT_CORP;
}

exports.corpForCurrency = corpForCurrency;

// Storefront country (ISO 3166-1 alpha-2) per subsidiary, from apple-slicer’s apple.py. The Financial Report (TXT) names the country of every sale, so it can follow the agreement exactly—unlike currency, since many storefronts outside the US sell in USD.
var COUNTRIES_BY_CORP = {
	EU: ['AF', 'AL', 'DZ', 'AO', 'AM', 'AT', 'AZ', 'BH', 'BY', 'BE', 'BJ', 'BA', 'BW', 'BG', 'BF', 'CM', 'CV', 'TD', 'CN', 'CD', 'CG', 'CI', 'HR', 'CY', 'CZ', 'DK', 'EG', 'EE', 'FI', 'FR', 'GA', 'GM', 'GE', 'DE', 'GH', 'GR', 'GW', 'HK', 'HU', 'IS', 'IN', 'ID', 'IQ', 'IE', 'IL', 'IT', 'JO', 'KZ', 'KE', 'XK', 'KW', 'KG', 'LV', 'LB', 'LR', 'LY', 'LT', 'LU', 'MK', 'MG', 'MW', 'MY', 'ML', 'MT', 'MR', 'MU', 'MD', 'ME', 'MA', 'MZ', 'NA', 'NL', 'NE', 'NG', 'NO', 'OM', 'PK', 'PH', 'PL', 'PT', 'QA', 'RO', 'RU', 'RW', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SK', 'SI', 'ZA', 'ES', 'SZ', 'SE', 'CH', 'TW', 'TJ', 'TZ', 'TH', 'TN', 'TR', 'TM', 'AE', 'UG', 'UA', 'GB', 'UZ', 'VN', 'YE', 'ZM', 'ZW'],
	US: ['US'],
	CA: ['CA'],
	LL: ['AI', 'AG', 'AR', 'BS', 'BB', 'BZ', 'BM', 'BO', 'BR', 'VG', 'KY', 'CL', 'CO', 'CR', 'DM', 'DO', 'EC', 'SV', 'GD', 'GY', 'GT', 'HN', 'JM', 'MX', 'MS', 'NI', 'PA', 'PY', 'PE', 'KN', 'LC', 'VC', 'SR', 'TT', 'TC', 'UY', 'VE'],
	AU: ['AU', 'NZ'],
	JP: ['JP'],
	AP: ['BT', 'BN', 'KH', 'FM', 'FJ', 'KR', 'LA', 'MO', 'MV', 'MN', 'MM', 'NR', 'NP', 'PW', 'PG', 'SB', 'LK', 'TO', 'VU'],
};

var CORP_BY_COUNTRY = {};
Object.keys(COUNTRIES_BY_CORP).forEach(function(corp) {
	COUNTRIES_BY_CORP[corp].forEach(function(country) {
		CORP_BY_COUNTRY[country] = corp;
	});
});

// Subsidiary code for a storefront country. A country missing from the table (e.g. a storefront Apple added later) falls back to the currency rule.
exports.corpForCountry = function(countryCode, currencyCode) {
	return CORP_BY_COUNTRY[String(countryCode || '').toUpperCase()] || corpForCurrency(currencyCode);
};

exports.vatIdEurope = VAT_ID_EUROPE;

// EU member states (ISO 3166-1 alpha-2). Ireland is a member but is the excluded case for reverse charge.
var EU_MEMBER_STATES = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

exports.isEuMemberState = function(code) {
	return EU_MEMBER_STATES.indexOf(String(code || '').toUpperCase()) !== -1;
};

// A fresh recipient object (copy) for a subsidiary code, safe to hand to a patch. Only fields the import schema understands are included.
exports.recipientFor = function(corp) {
	var r = RECIPIENTS[corp] || RECIPIENTS[DEFAULT_CORP];
	var address = {};
	for (var key in r.address) {
		if (r.address.hasOwnProperty(key)) address[key] = r.address[key];
	}
	return { name: r.name, address: address };
};

// Pull the trailing ISO-4217 currency code from a region label, e.g. “Australien (AUD)” → “AUD”. Returns '' when the label has no such code.
function currencyCode(regionLabel) {
	var match = String(regionLabel == null ? '' : regionLabel).match(/\(([A-Za-z]{3})\)\s*$/);
	return match ? match[1].toUpperCase() : '';
}

exports.currencyCode = currencyCode;

// Resolve a region label to { corp, exact }. exact === false means the label carried no currency code and was assigned to the default entity as a best guess.
exports.corpForRegion = function(regionLabel) {
	var code = currencyCode(regionLabel);
	if (!code) return { corp: DEFAULT_CORP, exact: false };
	return { corp: corpForCurrency(code), exact: true };
};
