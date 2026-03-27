const TRACKING_COLORS = {
  label_created: { bg: '#9CA3AF', text: '#fff' },
  handed_to_carrier: { bg: '#3B82F6', text: '#fff' },
  in_transit: { bg: '#8B5CF6', text: '#fff' },
  out_for_delivery: { bg: '#F59E0B', text: '#000' },
  available_for_pickup: { bg: '#F59E0B', text: '#000' },
  delivered: { bg: '#10B981', text: '#fff' },
  failed_delivery: { bg: '#EF4444', text: '#fff' },
  returned_to_sender: { bg: '#EF4444', text: '#fff' },
  problem: { bg: '#DC2626', text: '#fff' },
  unknown: { bg: '#6B7280', text: '#fff' },
}

const TRACKING_LABELS = {
  label_created: 'Štítek vytvořen',
  handed_to_carrier: 'Předáno dopravci',
  in_transit: 'V přepravě',
  out_for_delivery: 'Na doručení',
  available_for_pickup: 'K vyzvednutí',
  delivered: 'Doručeno',
  failed_delivery: 'Nedoručeno',
  returned_to_sender: 'Vráceno odesílateli',
  problem: 'Problém',
  unknown: 'Neznámý',
}

const RETURN_COLORS = {
  new: { bg: '#3B82F6', text: '#fff' },
  awaiting_shipment: { bg: '#F59E0B', text: '#000' },
  in_transit: { bg: '#8B5CF6', text: '#fff' },
  received: { bg: '#6366F1', text: '#fff' },
  under_review: { bg: '#F97316', text: '#fff' },
  approved: { bg: '#10B981', text: '#fff' },
  rejected: { bg: '#EF4444', text: '#fff' },
  refund_pending: { bg: '#F59E0B', text: '#000' },
  refunded: { bg: '#10B981', text: '#fff' },
  resolved: { bg: '#6B7280', text: '#fff' },
  cancelled: { bg: '#9CA3AF', text: '#fff' },
}

const RETURN_LABELS = {
  new: 'Nová žádost',
  awaiting_shipment: 'Čeká na odeslání',
  in_transit: 'V přepravě k nám',
  received: 'Přijato na skladu',
  under_review: 'Probíhá kontrola',
  approved: 'Schváleno',
  rejected: 'Zamítnuto',
  refund_pending: 'Čeká na vrácení peněz',
  refunded: 'Peníze vráceny',
  resolved: 'Vyřízeno',
  cancelled: 'Zrušeno',
}

export default function StatusBadge({ status, type = 'tracking', className = '' }) {
  const colors = type === 'return' ? RETURN_COLORS : TRACKING_COLORS
  const labels = type === 'return' ? RETURN_LABELS : TRACKING_LABELS
  const c = colors[status] || colors.unknown || { bg: '#6B7280', text: '#fff' }
  const label = labels[status] || status

  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${className}`}
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {label}
    </span>
  )
}

export { TRACKING_COLORS, TRACKING_LABELS, RETURN_COLORS, RETURN_LABELS }
