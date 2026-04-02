/**
 * CarrierLogo — displays carrier logo + country flag emoji.
 * One logo per carrier (GLS, PPL, UPS...) + flag from delivery_country.
 */

const CARRIER_LOGOS = {
  'GLS': '/carriers/gls.png',
  'PPL': '/carriers/ppl.png',
  'UPS': '/carriers/ups.png',
  'DPD': '/carriers/dpd.png',
  'Zasilkovna': '/carriers/zasilkovna.png',
  'ZASILKOVNA': '/carriers/zasilkovna.png',
  'CP': '/carriers/cp.png',
  'FOFR': '/carriers/fofr.png',
  'Fofr': '/carriers/fofr.png',
  'InTime': '/carriers/intime.jpg',
  'INTIME': '/carriers/intime.jpg',
};

const COUNTRY_FLAGS = {
  'CZ': '\u{1F1E8}\u{1F1FF}',
  'DE': '\u{1F1E9}\u{1F1EA}',
  'AT': '\u{1F1E6}\u{1F1F9}',
  'FR': '\u{1F1EB}\u{1F1F7}',
  'ES': '\u{1F1EA}\u{1F1F8}',
  'IT': '\u{1F1EE}\u{1F1F9}',
  'SE': '\u{1F1F8}\u{1F1EA}',
  'BE': '\u{1F1E7}\u{1F1EA}',
  'DK': '\u{1F1E9}\u{1F1F0}',
  'IE': '\u{1F1EE}\u{1F1EA}',
  'PT': '\u{1F1F5}\u{1F1F9}',
  'NL': '\u{1F1F3}\u{1F1F1}',
  'PL': '\u{1F1F5}\u{1F1F1}',
  'SK': '\u{1F1F8}\u{1F1F0}',
  'HU': '\u{1F1ED}\u{1F1FA}',
  'SI': '\u{1F1F8}\u{1F1EE}',
  'HR': '\u{1F1ED}\u{1F1F7}',
  'RO': '\u{1F1F7}\u{1F1F4}',
  'BG': '\u{1F1E7}\u{1F1EC}',
  'GR': '\u{1F1EC}\u{1F1F7}',
  'FI': '\u{1F1EB}\u{1F1EE}',
  'LU': '\u{1F1F1}\u{1F1FA}',
  'CH': '\u{1F1E8}\u{1F1ED}',
  'GB': '\u{1F1EC}\u{1F1E7}',
};

/**
 * Extract base carrier name from display_carrier (e.g. "GLS CZ" -> "GLS", "UPS" -> "UPS")
 */
function getBaseCarrier(displayCarrier) {
  if (!displayCarrier) return null;
  return displayCarrier.replace(/\s+(CZ|EU)$/i, '');
}

/**
 * Extract country from display_carrier or delivery_country
 * "GLS CZ" -> "CZ", "GLS EU" -> null (need delivery_country)
 */
function getCountryFromDisplay(displayCarrier) {
  if (!displayCarrier) return null;
  const match = displayCarrier.match(/\s+(CZ)$/i);
  return match ? match[1].toUpperCase() : null;
}

export default function CarrierLogo({ carrier, country, size = 'md', className = '', showFlag = true }) {
  const baseCarrier = getBaseCarrier(carrier);
  const logo = CARRIER_LOGOS[baseCarrier] || CARRIER_LOGOS[carrier];

  // Determine country: explicit prop > extracted from display_carrier
  const countryCode = country?.toUpperCase() || getCountryFromDisplay(carrier);
  const flag = countryCode ? COUNTRY_FLAGS[countryCode] : null;

  const sizeClasses = {
    xs: 'h-4 max-w-[48px]',
    sm: 'h-5 max-w-[60px]',
    md: 'h-6 max-w-[80px]',
    lg: 'h-8 max-w-[100px]',
    xl: 'h-10 max-w-[120px]',
  };

  const flagSizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };

  const badgeSizes = {
    xs: 'text-[9px] px-1 py-0.5',
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2 py-1',
    xl: 'text-base px-3 py-1',
  };

  if (logo) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <img
          src={logo}
          alt={baseCarrier || carrier}
          title={carrier}
          className={`${sizeClasses[size] || sizeClasses.md} object-contain`}
        />
        {showFlag && flag && (
          <span className={flagSizes[size] || flagSizes.md} title={countryCode}>{flag}</span>
        )}
      </span>
    );
  }

  // Text fallback
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className={`font-mono ${badgeSizes[size] || badgeSizes.md} bg-navy-700 rounded`}>
        {baseCarrier || carrier || '\u2014'}
      </span>
      {showFlag && flag && (
        <span className={flagSizes[size] || flagSizes.md} title={countryCode}>{flag}</span>
      )}
    </span>
  );
}

export { COUNTRY_FLAGS, CARRIER_LOGOS, getBaseCarrier };
