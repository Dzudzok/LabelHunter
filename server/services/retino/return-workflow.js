const TRANSITIONS = {
  new:               ['awaiting_shipment', 'under_review', 'cancelled'],
  awaiting_shipment:  ['in_transit', 'cancelled'],
  in_transit:         ['received'],
  received:           ['under_review'],
  under_review:       ['approved', 'rejected'],
  approved:           ['refund_pending', 'resolved'],
  refund_pending:     ['refunded'],
  refunded:           ['resolved'],
  rejected:           ['resolved'],
};

const STATUS_LABELS = {
  new:               'Nová žádost',
  awaiting_shipment: 'Čeká na odeslání',
  in_transit:        'V přepravě k nám',
  received:          'Přijato na skladu',
  under_review:      'Probíhá kontrola',
  approved:          'Schváleno',
  rejected:          'Zamítnuto',
  refund_pending:    'Čeká na vrácení peněz',
  refunded:          'Peníze vráceny',
  resolved:          'Vyřízeno',
  cancelled:         'Zrušeno',
};

const STATUS_COLORS = {
  new:               '#3B82F6',
  awaiting_shipment: '#F59E0B',
  in_transit:        '#8B5CF6',
  received:          '#6366F1',
  under_review:      '#F97316',
  approved:          '#10B981',
  rejected:          '#EF4444',
  refund_pending:    '#F59E0B',
  refunded:          '#10B981',
  resolved:          '#6B7280',
  cancelled:         '#9CA3AF',
};

// Workflow step order for visual stepper
const WORKFLOW_STEPS = [
  'new',
  'awaiting_shipment',
  'in_transit',
  'received',
  'under_review',
  'approved',
  'resolved',
];

function canTransition(currentStatus, newStatus) {
  const allowed = TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(newStatus);
}

function getAllowedTransitions(currentStatus) {
  return TRANSITIONS[currentStatus] || [];
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function getStatusColor(status) {
  return STATUS_COLORS[status] || '#6B7280';
}

module.exports = {
  canTransition,
  getAllowedTransitions,
  getStatusLabel,
  getStatusColor,
  STATUS_LABELS,
  STATUS_COLORS,
  WORKFLOW_STEPS,
  TRANSITIONS,
};
