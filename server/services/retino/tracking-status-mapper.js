// Unified status priority (higher = more advanced in delivery lifecycle)
const STATUS_PRIORITY = {
  delivered: 100,
  available_for_pickup: 90,
  failed_delivery: 80,
  returned_to_sender: 75,
  problem: 70,
  out_for_delivery: 60,
  in_transit: 50,
  handed_to_carrier: 40,
  label_created: 30,
  unknown: 0,
};

// Order matters — first match wins, so more specific patterns come first
const STATUS_RULES = [
  {
    status: 'delivered',
    patterns: [
      /^doručeno\s*$/i,
      /the parcel is delivered/i,
      /zásilka je u vás/i,
      /balíček jsme úspěšně doručili/i,
      /dodání zásilky/i,
      /podpis k dispozici/i,
    ],
  },
  {
    status: 'available_for_pickup',
    patterns: [
      /doručení do parcelshop/i,
      /uskladněno v parcelshop/i,
      /parcellocker deposit/i,
      /delivered.*pick-?up point/i,
      /doručeno do ups access point/i,
      /uschováno na ups access point/i,
    ],
  },
  {
    status: 'failed_delivery',
    patterns: [
      /adresát nezastižen/i,
      /odmítnutí převzetí/i,
    ],
  },
  {
    status: 'returned_to_sender',
    patterns: [
      /zpětné zaslání odesílateli/i,
    ],
  },
  {
    status: 'problem',
    patterns: [
      /^damaged$/i,
    ],
  },
  {
    status: 'out_for_delivery',
    patterns: [
      /^na doručení$/i,
      /being delivered today/i,
      /připraveno pro doručení dnes/i,
      /zásilka se doručuje/i,
      /příprava zásilky k doručení/i,
      /doručování zásilky/i,
      /termín doručení/i,
      /předali kurýrovi.*dnes/i,
      /predikovaný stop/i,
      /doručován.*do výdejního místa/i,
    ],
  },
  {
    status: 'handed_to_carrier',
    patterns: [
      /received.*from the sender/i,
      /zásilka převzata do přepravy/i,
      /received.*for delivery/i,
      /vyzvedli u odesílatele/i,
    ],
  },
  {
    status: 'in_transit',
    patterns: [
      /dorazil.*do zařízení/i,
      /opustil.*zařízení/i,
      /zásilka dorazila na depo/i,
      /zásilka byla (připravena|odeslána)/i,
      /zásilka v přepravě/i,
      /rollkarte|depo vstup|hub inbound|hub storage/i,
      /on the way to.*depot/i,
      /located at.*depot/i,
      /skenování/i,
      /přeprava zásilky/i,
      /vypravena/i,
      /zpracování v zařízení/i,
      /dorazila do cílové/i,
      /balík byl zpracován/i,
      /na cestě do depa/i,
      /už je v našem depu/i,
      /vytištěn presort/i,
    ],
  },
  {
    status: 'label_created',
    patterns: [
      /ostatní data přijata/i,
      /^registrace$/i,
      /cod data přijata/i,
      /o vaší zásilce už víme/i,
      /odesílatel vytvořil štítek/i,
      /obdrženy údaje/i,
      /small parcel/i,
    ],
  },
];

function classifyDescription(description) {
  if (!description) return 'unknown';
  const text = description.trim();
  for (const rule of STATUS_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) return rule.status;
    }
  }
  return 'unknown';
}

/**
 * Parse tracking_data JSONB and return the most advanced unified status.
 * Also returns the last tracking description and timestamp.
 */
function getUnifiedStatus(trackingData) {
  if (!trackingData) return { status: 'unknown', lastDescription: null, lastUpdate: null };

  const data = trackingData.data || trackingData;
  const items = (Array.isArray(data) ? data : [data]).filter(Boolean);

  let bestStatus = 'unknown';
  let bestPriority = 0;
  let lastDescription = null;
  let lastUpdate = null;

  for (const shipment of items) {
    const trackingItems = shipment.trackingItems || [];
    for (const item of trackingItems) {
      const status = classifyDescription(item.description);
      const priority = STATUS_PRIORITY[status] || 0;
      if (priority > bestPriority) {
        bestPriority = priority;
        bestStatus = status;
      }
      // Track the chronologically last event
      if (!lastUpdate || (item.date && item.date > lastUpdate)) {
        lastUpdate = item.date || null;
        lastDescription = item.description || null;
      }
    }
  }

  return { status: bestStatus, lastDescription, lastUpdate };
}

const STATUS_LABELS = {
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
};

const STATUS_COLORS = {
  label_created: '#9CA3AF',
  handed_to_carrier: '#3B82F6',
  in_transit: '#8B5CF6',
  out_for_delivery: '#F59E0B',
  available_for_pickup: '#F59E0B',
  delivered: '#10B981',
  failed_delivery: '#EF4444',
  returned_to_sender: '#EF4444',
  problem: '#DC2626',
  unknown: '#6B7280',
};

function getStatusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.unknown;
}

function getStatusColor(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.unknown;
}

module.exports = {
  getUnifiedStatus,
  classifyDescription,
  getStatusLabel,
  getStatusColor,
  STATUS_PRIORITY,
  STATUS_LABELS,
  STATUS_COLORS,
};
