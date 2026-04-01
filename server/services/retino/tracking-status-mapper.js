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
      /parcel was successfully delivered/i,
      /zásilka je u vás/i,
      /balíček jsme úspěšně doručili/i,
      /dodání zásilky/i,
      /podpis k dispozici/i,
      /zásilku jsme doručili/i,
      /zugestellt/i,
      /has been delivered/i,
    ],
  },
  {
    status: 'available_for_pickup',
    patterns: [
      /doručení do parcelshop/i,
      /doručen do výdejního místa/i,
      /uskladněno v parcelshop/i,
      /parcellocker deposit/i,
      /delivered.*pick-?up point/i,
      /can be picked up/i,
      /picked up from parcelshop/i,
      /ready for pick.?up/i,
      /doručeno do ups access point/i,
      /uschováno na ups access point/i,
      /stored for pickup/i,
      /připraveno k vyzvednutí/i,
      /k vyzvednutí/i,
      /uloženo na pobočce/i,
      /uloženo na poště/i,
    ],
  },
  {
    status: 'failed_delivery',
    patterns: [
      /adresát nezastižen/i,
      /odmítnutí převzetí/i,
      /not delivered/i,
      /delivery attempt failed/i,
      /neúspěšný pokus/i,
      /nedoručeno/i,
      /parcel was not delivered/i,
      /nebyla doručena/i,
      /zásilka nebyla doručena/i,
      /poškození/i,
    ],
  },
  {
    status: 'returned_to_sender',
    patterns: [
      /zpětné zaslání odesílateli/i,
      /returned to sender/i,
      /vráceno odesílateli/i,
      /back to sender/i,
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
      /with our courier/i,
      /out for delivery/i,
      /parcel is being delivered/i,
      /zásilka se dnes doručuje/i,
      /se dnes doručuje/i,
      /dnes doručuje/i,
    ],
  },
  {
    status: 'handed_to_carrier',
    patterns: [
      /received.*from the sender/i,
      /received.*parcel.*from.*sender/i,
      /zásilka převzata do přepravy/i,
      /received.*for delivery/i,
      /vyzvedli u odesílatele/i,
      /picked up.*sender/i,
      /parcel has been pickup/i,
      /balík předán/i,
      /we received the parcel/i,
      /převzali od odesílatele/i,
      /jsme převzali od odesílatele/i,
      /čekáme na přijetí/i,
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
      /parcel is at our depot/i,
      /parcel is on the way/i,
      /parcel in transit/i,
      /control scan/i,
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

// Sub-status labels for more granular tracking
const SUB_STATUS_LABELS = {
  // PENDING
  'new_shipment': 'Nova zasilka',
  'cannot_track': 'Nelze sledovat',
  // IN_TRANSIT
  'accepted_by_carrier': 'Prijato dopravcem',
  'distribution_center': 'Distribucni centrum',
  'depot': 'Depo',
  'customs_clearance': 'Celni rizeni',
  'customs_cleared': 'Procleno',
  // FAILED_ATTEMPT
  'recipient_not_home': 'Prijemce nezastizen',
  // AVAILABLE_FOR_PICKUP
  'standard_storage': 'Standardni ulozni doba',
  'extended_storage': 'Prodlouzena ulozni doba',
  // DELIVERED
  'standard_delivery': 'Standardni doruceni',
  'picked_up': 'Vyzvednuto zakaznikem',
  // EXCEPTION
  'damaged': 'Poskozena zasilka',
  'lost': 'Ztracena zasilka',
  'rejected': 'Odmitnuto prijemcem',
  'incorrect_address': 'Nespravna adresa',
};

// Sub-status detection rules based on description text analysis
const SUB_STATUS_RULES = [
  // EXCEPTION
  { sub: 'damaged', patterns: [/posko[zž]/i, /damaged/i] },
  { sub: 'lost', patterns: [/ztracen/i, /lost/i, /nedohledan/i] },
  { sub: 'rejected', patterns: [/odm[ií]tnut/i, /rejected/i, /refuse/i] },
  { sub: 'incorrect_address', patterns: [/nespr[aá]vn[aá] adresa/i, /incorrect address/i, /bad address/i, /chybn[aá] adresa/i] },
  // FAILED_ATTEMPT
  { sub: 'recipient_not_home', patterns: [/nezasti[zž]en/i, /not home/i, /not available/i] },
  // IN_TRANSIT
  { sub: 'accepted_by_carrier', patterns: [/p[rř]evzat.*p[rř]eprav/i, /received.*from.*sender/i, /vyzvedli u odes/i, /received.*for delivery/i] },
  { sub: 'distribution_center', patterns: [/distribu[cč]/i, /za[rř][ií]zen[ií]/i, /zpracov[aá]n[ií] v/i, /hub inbound/i, /hub storage/i] },
  { sub: 'depot', patterns: [/depo/i, /depot/i, /rollkarte/i] },
  { sub: 'customs_clearance', patterns: [/celn[ií]/i, /customs/i, /proclení/i] },
  { sub: 'customs_cleared', patterns: [/proclen/i, /customs cleared/i] },
  // AVAILABLE_FOR_PICKUP
  { sub: 'picked_up', patterns: [/vyzvednuto/i, /picked up/i, /parcelshop/i, /parcellocker/i, /access point/i] },
  { sub: 'standard_storage', patterns: [/uskladn[eě]no/i, /stored/i, /ulo[zž]/i] },
  { sub: 'extended_storage', patterns: [/prodlou[zž]en/i, /extended/i] },
  // DELIVERED
  { sub: 'standard_delivery', patterns: [/doru[cč]eno/i, /delivered/i, /dodání/i] },
  // PENDING
  { sub: 'new_shipment', patterns: [/registrace/i, /data p[rř]ijata/i, /[sš]t[ií]tek/i, /label/i, /obdr[zž]eny/i] },
  { sub: 'cannot_track', patterns: [/nelze sledovat/i, /cannot track/i, /no tracking/i] },
];

/**
 * Get the best matching sub-status based on carrier code, status code, and description text.
 */
function getSubStatus(carrierCode, statusCode, description) {
  if (!description) return null;

  const text = description.trim();
  for (const rule of SUB_STATUS_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        return rule.sub;
      }
    }
  }

  return null;
}

module.exports = {
  getUnifiedStatus,
  classifyDescription,
  getStatusLabel,
  getStatusColor,
  getSubStatus,
  STATUS_PRIORITY,
  STATUS_LABELS,
  STATUS_COLORS,
  SUB_STATUS_LABELS,
};
