import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../../services/api'
import StatusBadge from '../shared/StatusBadge'

export default function ShipmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [shipment, setShipment] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      try {
        const res = await api.get(`/retino/tracking/shipments/${id}`)
        setShipment(res.data)
      } catch (err) {
        console.error('Failed to fetch shipment:', err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [id])

  if (loading) return <div className="bg-navy-900 flex items-center justify-center h-full text-theme-muted">Načítání...</div>
  if (!shipment) return <div className="bg-navy-900 flex items-center justify-center h-full text-red-400">Zásilka nenalezena</div>

  return (
    <div className="bg-navy-900 text-theme-primary p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/retino/tracking')} className="text-theme-muted hover:text-theme-primary text-sm">
          &larr; Zpět
        </button>
        <h1 className="text-2xl font-bold">{shipment.doc_number || shipment.invoice_number}</h1>
        <StatusBadge status={shipment.unified_status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — info */}
        <div className="lg:col-span-1 space-y-4">
          {/* Shipment info */}
          <div className="bg-navy-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Informace o zásilce</h3>
            <InfoRow label="Doklad" value={shipment.doc_number} />
            <InfoRow label="Faktura" value={shipment.invoice_number} />
            <InfoRow label="Objednávka" value={shipment.order_number} />
            <InfoRow label="Datum" value={shipment.date_issued ? new Date(shipment.date_issued).toLocaleDateString('cs-CZ') : '-'} />
            <InfoRow label="Dopravce" value={shipment.shipper_code} />
            <InfoRow label="Tracking" value={shipment.tracking_number} />
            {shipment.tracking_url && (
              <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm block mt-2">
                Sledovat u dopravce &rarr;
              </a>
            )}
          </div>

          {/* Customer */}
          <div className="bg-navy-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Zákazník</h3>
            <InfoRow label="Jméno" value={shipment.customer_name} />
            <InfoRow label="E-mail" value={shipment.customer_email} />
            <InfoRow label="Telefon" value={shipment.customer_phone} />
            <InfoRow label="Adresa" value={[shipment.delivery_street, shipment.delivery_city, shipment.delivery_postal_code, shipment.delivery_country].filter(Boolean).join(', ')} />
          </div>

          {/* Items */}
          {shipment.items && shipment.items.length > 0 && (
            <div className="bg-navy-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Položky ({shipment.items.length})</h3>
              <div className="space-y-2">
                {shipment.items.filter(i => i.item_type === 'goods').map((item, i) => (
                  <div key={i} className="flex justify-between items-start text-sm border-b border-navy-700/50 pb-2">
                    <div>
                      <span className="text-theme-primary">{item.text}</span>
                      {item.brand && <span className="text-theme-muted ml-2">({item.brand})</span>}
                      {item.code && <div className="text-xs text-theme-muted font-mono">{item.code}</div>}
                    </div>
                    <span className="text-theme-muted whitespace-nowrap ml-2">{item.qty}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — tracking timeline */}
        <div className="lg:col-span-2">
          <div className="bg-navy-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-theme-muted mb-4 uppercase tracking-wider">Tracking Timeline</h3>
            {shipment.trackingTimeline && shipment.trackingTimeline.length > 0 ? (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-navy-600" />

                <div className="space-y-4">
                  {shipment.trackingTimeline.map((event, i) => (
                    <div key={i} className="flex items-start gap-4 relative">
                      {/* Dot */}
                      <div
                        className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center z-10"
                        style={{ backgroundColor: i === 0 ? (shipment.statusColor || '#8B5CF6') : '#374151' }}
                      >
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-theme-primary">{event.description}</div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-theme-muted">
                            {event.date ? new Date(event.date).toLocaleString('cs-CZ') : ''}
                          </span>
                          {event.location && (
                            <span className="text-xs text-theme-muted">{event.location}</span>
                          )}
                          <StatusBadge status={event.unifiedStatus} className="text-[10px] px-1.5 py-0" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-theme-muted text-center py-8">Žádné tracking události</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-theme-muted">{label}</span>
      <span className="text-theme-primary font-medium">{value || '-'}</span>
    </div>
  )
}
