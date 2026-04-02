/**
 * CarrierLogo — displays carrier logo image with fallback to text badge.
 * Maps display_carrier (e.g. "GLS CZ", "PPL EU", "UPS") to logo file in /carriers/.
 */

const CARRIER_LOGOS = {
  'GLS CZ': '/carriers/gls-cz.png',
  'GLS EU': '/carriers/gls-eu.png',
  'GLS': '/carriers/gls-cz.png',
  'PPL CZ': '/carriers/ppl-cz.png',
  'PPL EU': '/carriers/ppl-eu.png',
  'PPL': '/carriers/ppl-cz.png',
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

export default function CarrierLogo({ carrier, size = 'md', className = '' }) {
  const logo = CARRIER_LOGOS[carrier];

  const sizeClasses = {
    xs: 'h-4 max-w-[48px]',
    sm: 'h-5 max-w-[60px]',
    md: 'h-6 max-w-[80px]',
    lg: 'h-8 max-w-[100px]',
    xl: 'h-10 max-w-[120px]',
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
      <img
        src={logo}
        alt={carrier}
        title={carrier}
        className={`${sizeClasses[size] || sizeClasses.md} object-contain inline-block ${className}`}
        onError={(e) => {
          // Fallback to text if image fails
          e.target.style.display = 'none';
          e.target.nextSibling && (e.target.nextSibling.style.display = 'inline-flex');
        }}
      />
    );
  }

  // Text fallback
  return (
    <span className={`font-mono ${badgeSizes[size] || badgeSizes.md} bg-navy-700 rounded inline-flex items-center ${className}`}>
      {carrier || '—'}
    </span>
  );
}
