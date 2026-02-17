/**
 * Countries for sailing – World Sailing National Authority 3-letter codes.
 * Includes mapping to ISO alpha-2 for flag emoji rendering.
 */

export type Country = { code: string; name: string };

// National Authority 3-letter code → ISO 3166-1 alpha-2 (for flag emoji)
const CODE_TO_ALPHA2: Record<string, string> = {
  ALG: 'DZ', ASA: 'AS', AND: 'AD', ANG: 'AO', ANT: 'AG', ARG: 'AR', ARM: 'AM', ARU: 'AW',
  AUS: 'AU', AUT: 'AT', AZE: 'AZ', BAH: 'BS', BRN: 'BH', BAR: 'BB', BLR: 'BY', BEL: 'BE',
  BIZ: 'BZ', BER: 'BM', BOL: 'BO', BOT: 'BW', BRA: 'BR', IVB: 'VG', BRU: 'BN', BUL: 'BG',
  CAM: 'KH', CAN: 'CA', CAY: 'KY', CHI: 'CL', CHN: 'CN', TPE: 'TW', COL: 'CO', COK: 'CK',
  CRO: 'HR', CUB: 'CU', CYP: 'CY', CZE: 'CZ', DEN: 'DK', DJI: 'DJ', DOM: 'DO', ECU: 'EC',
  EGY: 'EG', ESA: 'SV', EST: 'EE', FIJ: 'FJ', FIN: 'FI', FRA: 'FR', GEO: 'GE', GER: 'DE',
  GBR: 'GB', GRE: 'GR', GRN: 'GD', GUM: 'GU', GUA: 'GT', HKG: 'HK', HUN: 'HU', ISL: 'IS',
  IND: 'IN', INA: 'ID', IRI: 'IR', IRQ: 'IQ', IRL: 'IE', ISR: 'IL', ITA: 'IT', JAM: 'JM',
  JPN: 'JP', JOR: 'JO', KAZ: 'KZ', KEN: 'KE', PRK: 'KP', KOR: 'KR', KOS: 'XK', KUW: 'KW',
  KGZ: 'KG', LAT: 'LV', LIB: 'LB', LBA: 'LY', LIE: 'LI', LTU: 'LT', LUX: 'LU', MAC: 'MO',
  MAD: 'MG', MAS: 'MY', MLT: 'MT', MRI: 'MU', MEX: 'MX', MDA: 'MD', MON: 'MC', MNE: 'ME',
  MNT: 'MS', MAR: 'MA', MOZ: 'MZ', MYA: 'MM', NAM: 'NA', NED: 'NL', AHO: 'CW', NZL: 'NZ',
  NCA: 'NI', NGR: 'NG', MKD: 'MK', NOR: 'NO', OMA: 'OM', PAK: 'PK', PLE: 'PS', PAN: 'PA',
  PNG: 'PG', PAR: 'PY', PER: 'PE', PHI: 'PH', POL: 'PL', POR: 'PT', PUR: 'PR', QAT: 'QA',
  ROU: 'RO', RUS: 'RU', SAM: 'WS', SMR: 'SM', KSA: 'SA', SEN: 'SN', SRB: 'RS', SEY: 'SC',
  SGP: 'SG', SVK: 'SK', SLO: 'SI', SOL: 'SB', RSA: 'ZA', ESP: 'ES', SRI: 'LK', SKN: 'KN', LCA: 'LC',
  VIN: 'VC', SUD: 'SD', SWE: 'SE', SUI: 'CH', TAH: 'PF', TJK: 'TJ', TAN: 'TZ', THA: 'TH',
  TLS: 'TL', TGA: 'TO', TTO: 'TT', TUN: 'TN', TUR: 'TR', TCA: 'TC', UGA: 'UG', UKR: 'UA',
  UAE: 'AE', USA: 'US', URU: 'UY', ISV: 'VI', VAN: 'VU', VEN: 'VE', VIE: 'VN', ZIM: 'ZW',
};

function codeToFlag(code: string): string {
  if (!code || code.length !== 3) return '';
  const a2 = CODE_TO_ALPHA2[code.toUpperCase()] || code.slice(0, 2);
  if (!a2 || a2.length !== 2) return '';
  const a = a2.charCodeAt(0) - 65;
  const b = a2.charCodeAt(1) - 65;
  if (a < 0 || a > 25 || b < 0 || b > 25) return '';
  return String.fromCodePoint(0x1f1e6 + a, 0x1f1e6 + b);
}

export const COUNTRIES: Country[] = [
  { code: 'ALG', name: 'Algeria' },
  { code: 'ASA', name: 'American Samoa' },
  { code: 'AND', name: 'Andorra' },
  { code: 'ANG', name: 'Angola' },
  { code: 'ANT', name: 'Antigua' },
  { code: 'ARG', name: 'Argentina' },
  { code: 'ARM', name: 'Armenia' },
  { code: 'ARU', name: 'Aruba' },
  { code: 'AUS', name: 'Australia' },
  { code: 'AUT', name: 'Austria' },
  { code: 'AZE', name: 'Azerbaijan' },
  { code: 'BAH', name: 'Bahamas' },
  { code: 'BRN', name: 'Bahrain' },
  { code: 'BAR', name: 'Barbados' },
  { code: 'BLR', name: 'Belarus' },
  { code: 'BEL', name: 'Belgium' },
  { code: 'BIZ', name: 'Belize' },
  { code: 'BER', name: 'Bermuda' },
  { code: 'BOL', name: 'Bolivia' },
  { code: 'BOT', name: 'Botswana' },
  { code: 'BRA', name: 'Brazil' },
  { code: 'IVB', name: 'British Virgin Islands' },
  { code: 'BRU', name: 'Brunei' },
  { code: 'BUL', name: 'Bulgaria' },
  { code: 'CAM', name: 'Cambodia' },
  { code: 'CAN', name: 'Canada' },
  { code: 'CAY', name: 'Cayman Islands' },
  { code: 'CHI', name: 'Chile' },
  { code: 'CHN', name: 'China, PR' },
  { code: 'TPE', name: 'Chinese Taipei' },
  { code: 'COL', name: 'Colombia' },
  { code: 'COK', name: 'Cook Islands' },
  { code: 'CRO', name: 'Croatia' },
  { code: 'CUB', name: 'Cuba' },
  { code: 'CYP', name: 'Cyprus' },
  { code: 'CZE', name: 'Czechia' },
  { code: 'DEN', name: 'Denmark' },
  { code: 'DJI', name: 'Djibouti' },
  { code: 'DOM', name: 'Dominican Republic' },
  { code: 'ECU', name: 'Ecuador' },
  { code: 'EGY', name: 'Egypt' },
  { code: 'ESA', name: 'El Salvador' },
  { code: 'EST', name: 'Estonia' },
  { code: 'FIJ', name: 'Fiji' },
  { code: 'FIN', name: 'Finland' },
  { code: 'FRA', name: 'France' },
  { code: 'GEO', name: 'Georgia' },
  { code: 'GER', name: 'Germany' },
  { code: 'GBR', name: 'Great Britain' },
  { code: 'GRE', name: 'Greece' },
  { code: 'GRN', name: 'Grenada' },
  { code: 'GUM', name: 'Guam' },
  { code: 'GUA', name: 'Guatemala' },
  { code: 'HKG', name: 'Hong Kong, China' },
  { code: 'HUN', name: 'Hungary' },
  { code: 'ISL', name: 'Iceland' },
  { code: 'IND', name: 'India' },
  { code: 'INA', name: 'Indonesia' },
  { code: 'IRI', name: 'Iran' },
  { code: 'IRQ', name: 'Iraq' },
  { code: 'IRL', name: 'Ireland' },
  { code: 'ISR', name: 'Israel' },
  { code: 'ITA', name: 'Italy' },
  { code: 'JAM', name: 'Jamaica' },
  { code: 'JPN', name: 'Japan' },
  { code: 'JOR', name: 'Jordan' },
  { code: 'KAZ', name: 'Kazakhstan' },
  { code: 'KEN', name: 'Kenya' },
  { code: 'PRK', name: 'Korea, DPR' },
  { code: 'KOR', name: 'Korea, Republic of' },
  { code: 'KOS', name: 'Kosovo' },
  { code: 'KUW', name: 'Kuwait' },
  { code: 'KGZ', name: 'Kyrgyzstan' },
  { code: 'LAT', name: 'Latvia' },
  { code: 'LIB', name: 'Lebanon' },
  { code: 'LBA', name: 'Libya' },
  { code: 'LIE', name: 'Liechtenstein' },
  { code: 'LTU', name: 'Lithuania' },
  { code: 'LUX', name: 'Luxembourg' },
  { code: 'MAC', name: 'Macau, China' },
  { code: 'MAD', name: 'Madagascar' },
  { code: 'MAS', name: 'Malaysia' },
  { code: 'MLT', name: 'Malta' },
  { code: 'MRI', name: 'Mauritius' },
  { code: 'MEX', name: 'Mexico' },
  { code: 'MDA', name: 'Moldova' },
  { code: 'MON', name: 'Monaco' },
  { code: 'MNE', name: 'Montenegro' },
  { code: 'MNT', name: 'Montserrat' },
  { code: 'MAR', name: 'Morocco' },
  { code: 'MOZ', name: 'Mozambique' },
  { code: 'MYA', name: 'Myanmar' },
  { code: 'NAM', name: 'Namibia' },
  { code: 'NED', name: 'Netherlands' },
  { code: 'AHO', name: 'Netherlands Antilles' },
  { code: 'NZL', name: 'New Zealand' },
  { code: 'NCA', name: 'Nicaragua' },
  { code: 'NGR', name: 'Nigeria' },
  { code: 'MKD', name: 'North Macedonia' },
  { code: 'NOR', name: 'Norway' },
  { code: 'OMA', name: 'Oman' },
  { code: 'PAK', name: 'Pakistan' },
  { code: 'PLE', name: 'Palestine' },
  { code: 'PAN', name: 'Panama' },
  { code: 'PNG', name: 'Papua New Guinea' },
  { code: 'PAR', name: 'Paraguay' },
  { code: 'PER', name: 'Peru' },
  { code: 'PHI', name: 'Philippines' },
  { code: 'POL', name: 'Poland' },
  { code: 'POR', name: 'Portugal' },
  { code: 'PUR', name: 'Puerto Rico' },
  { code: 'QAT', name: 'Qatar' },
  { code: 'ROU', name: 'Romania' },
  { code: 'RUS', name: 'Russia' },
  { code: 'SAM', name: 'Samoa' },
  { code: 'SMR', name: 'San Marino' },
  { code: 'KSA', name: 'Saudi Arabia' },
  { code: 'SEN', name: 'Senegal' },
  { code: 'SRB', name: 'Serbia' },
  { code: 'SEY', name: 'Seychelles' },
  { code: 'SGP', name: 'Singapore' },
  { code: 'SVK', name: 'Slovak Republic' },
  { code: 'SLO', name: 'Slovenia' },
  { code: 'SOL', name: 'Solomon Islands' },
  { code: 'RSA', name: 'South Africa' },
  { code: 'ESP', name: 'Spain' },
  { code: 'SRI', name: 'Sri Lanka' },
  { code: 'SKN', name: 'St Kitts & Nevis' },
  { code: 'LCA', name: 'St Lucia' },
  { code: 'VIN', name: 'St Vincent & Grenadines' },
  { code: 'SUD', name: 'Sudan' },
  { code: 'SWE', name: 'Sweden' },
  { code: 'SUI', name: 'Switzerland' },
  { code: 'TAH', name: 'Tahiti' },
  { code: 'TJK', name: 'Tajikistan' },
  { code: 'TAN', name: 'Tanzania' },
  { code: 'THA', name: 'Thailand' },
  { code: 'TLS', name: 'Timor Leste' },
  { code: 'TGA', name: 'Tonga' },
  { code: 'TTO', name: 'Trinidad & Tobago' },
  { code: 'TUN', name: 'Tunisia' },
  { code: 'TUR', name: 'Turkey' },
  { code: 'TCA', name: 'Turks & Caicos' },
  { code: 'UGA', name: 'Uganda' },
  { code: 'UKR', name: 'Ukraine' },
  { code: 'UAE', name: 'United Arab Emirates' },
  { code: 'USA', name: 'United States of America' },
  { code: 'URU', name: 'Uruguay' },
  { code: 'ISV', name: 'US Virgin Islands' },
  { code: 'VAN', name: 'Vanuatu' },
  { code: 'VEN', name: 'Venezuela' },
  { code: 'VIE', name: 'Vietnam' },
  { code: 'ZIM', name: 'Zimbabwe' },
].sort((a, b) => a.name.localeCompare(b.name));

const seen = new Set<string>();
export const COUNTRIES_UNIQUE = COUNTRIES.filter((c) => {
  if (seen.has(c.code)) return false;
  seen.add(c.code);
  return true;
});

export function getFlagEmoji(countryCode: string): string {
  if (!countryCode) return '';
  return codeToFlag(countryCode.toUpperCase().trim());
}

/** Alpha-2 code for the given National Authority 3-letter code (for flag images). */
export function getAlpha2ForFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 3) return '';
  return (CODE_TO_ALPHA2[countryCode.toUpperCase()] || '').toLowerCase();
}

export function formatSailNumber(countryCode: string | null | undefined, sailNumber: string | null | undefined): string {
  const code = (countryCode || '').toString().trim().toUpperCase();
  const num = (sailNumber || '').toString().trim();
  if (!code && !num) return '—';
  const flag = code ? getFlagEmoji(code) : '';
  if (!num) return flag ? `${flag} ${code}` : '—';
  return flag ? `${flag} ${code} ${num}` : `${code} ${num}`;
}
