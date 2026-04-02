/**
 * CarrierLogo — displays carrier logo + country flag (SVG image).
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

const COUNTRY_FLAGS = [
  'CZ','DE','AT','FR','ES','IT','SE','BE','DK','IE','PT','NL',
  'PL','SK','HU','SI','HR','RO','BG','GR','FI','LU','CH','GB',
];

/**
 * Extract base carrier name from display_carrier or transport_name.
 * "GLS CZ" -> "GLS", "Euro Business Parcel" -> "GLS", "PPL Parcel CZ Private" -> "PPL"
 */
function getBaseCarrier(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  // Direct match first
  const stripped = name.replace(/\s+(CZ|EU)$/i, '');
  if (CARRIER_LOGOS[stripped]) return stripped;
  // LP transport_name -> carrier mapping
  if (n.includes('euro business') || n.includes('business parcel') || n.includes('gls')) return 'GLS';
  if (n.includes('ppl') || n.includes('parcel cz')) return 'PPL';
  if (n.includes('ups')) return 'UPS';
  if (n.includes('dpd')) return 'DPD';
  if (n.includes('zásilkovna') || n.includes('zasilkovna') || n.includes('výdejní míst')) return 'Zasilkovna';
  if (n.includes('česká pošta') || n.includes('ceska posta') || n.includes('do ruky') || n.includes('balík')) return 'CP';
  if (n.includes('fofr') || n.includes('transfor')) return 'FOFR';
  if (n.includes('intime') || n.includes('wedo')) return 'InTime';
  return stripped;
}

export default function CarrierLogo({ carrier, country, size = 'md', className = '', showFlag = true }) {
  const baseCarrier = getBaseCarrier(carrier);
  const logo = CARRIER_LOGOS[baseCarrier] || CARRIER_LOGOS[carrier];

  const countryCode = (country || '').toUpperCase();
  const hasFlag = showFlag && countryCode && COUNTRY_FLAGS.includes(countryCode);

  const sizeClasses = {
    xs: 'h-4 max-w-[48px]',
    sm: 'h-5 max-w-[60px]',
    md: 'h-6 max-w-[80px]',
    lg: 'h-8 max-w-[100px]',
    xl: 'h-10 max-w-[120px]',
  };

  const flagSizes = {
    xs: 'h-3 w-4',
    sm: 'h-3.5 w-[18px]',
    md: 'h-4 w-[22px]',
    lg: 'h-5 w-[26px]',
    xl: 'h-6 w-8',
  };

  const badgeSizes = {
    xs: 'text-[9px] px-1 py-0.5',
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2 py-1',
    xl: 'text-base px-3 py-1',
  };

  const flagEl = hasFlag ? (
    <img
      src={`/flags/${countryCode.toLowerCase()}.svg`}
      alt={countryCode}
      title={countryCode}
      className={`${flagSizes[size] || flagSizes.md} inline-block rounded-[2px] shadow-sm border border-white/10`}
    />
  ) : null;

  if (logo) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <img
          src={logo}
          alt={baseCarrier || carrier}
          title={carrier}
          className={`${sizeClasses[size] || sizeClasses.md} object-contain`}
        />
        {flagEl}
      </span>
    );
  }

  // Text fallback
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`font-mono ${badgeSizes[size] || badgeSizes.md} bg-navy-700 rounded`}>
        {baseCarrier || carrier || '\u2014'}
      </span>
      {flagEl}
    </span>
  );
}

export { CARRIER_LOGOS, getBaseCarrier };
