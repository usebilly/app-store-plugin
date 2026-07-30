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

// Region to subsidiary determined from apple-slicer’s country groupings: its `europe` bucket also covers the UK, Switzerland, China and India, so those regions map to the Irish entity too.
var DEFAULT_CORP = 'EU';

// Ordered keyword rules matched against the lower-cased region label.
// First hit wins, so more specific labels precede broader ones.
var REGION_RULES = [
	['euro-zone', 'EU'],
	['euro zone', 'EU'],
	['eurozone', 'EU'],
	['united kingdom', 'EU'],
	['switzerland', 'EU'],
	['rest of europe', 'EU'],
	['europe', 'EU'],
	['china', 'EU'],
	['india', 'EU'],
	['canada', 'CA'],
	['japan', 'JP'],
	['new zealand', 'AU'],
	['australia', 'AU'],
	['latin america', 'LL'],
	['caribbean', 'LL'],
	['mexico', 'LL'],
	['brazil', 'LL'],
	['united states', 'US'],
	['americas', 'US'],
];

exports.CORP_ORDER = CORP_ORDER;
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

// Resolve a region label to { corp, exact }. exact === false means the label wasn’t recognised and was assigned to the default entity as a best guess.
exports.corpForRegion = function(regionLabel) {
	var text = String(regionLabel || '').toLowerCase();
	for (var i = 0; i < REGION_RULES.length; i++) {
		if (text.indexOf(REGION_RULES[i][0]) !== -1) {
			return { corp: REGION_RULES[i][1], exact: true };
		}
	}
	return { corp: DEFAULT_CORP, exact: false };
};
