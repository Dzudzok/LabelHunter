import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

const apiBase = import.meta.env.VITE_API_URL || '/api'

const STATUS_COLORS = {
  label_created: '#9CA3AF', handed_to_carrier: '#3B82F6', in_transit: '#8B5CF6',
  out_for_delivery: '#F59E0B', available_for_pickup: '#F59E0B', delivered: '#10B981',
  failed_delivery: '#EF4444', returned_to_sender: '#EF4444', problem: '#DC2626', unknown: '#6B7280',
}

const STATUS_ICONS = {
  label_created: '📋', handed_to_carrier: '📦', in_transit: '🚚',
  out_for_delivery: '🏠', available_for_pickup: '📬', delivered: '✅',
  failed_delivery: '❌', returned_to_sender: '↩️', problem: '⚠️', unknown: '❓',
}

export default function TrackAndTrace() {
  const { trackingToken } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetch() {
      try {
        const res = await axios.get(`${apiBase}/retino/public/returns/track/${trackingToken}`)
        setData(res.data)
      } catch {
        setError('Zásilka nenalezena')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [trackingToken])

  if (loading) return <PageWrapper><div className="text-center py-12 text-gray-500">Načítání...</div></PageWrapper>
  if (error) return <PageWrapper><div className="text-center py-12 text-red-500">{error}</div></PageWrapper>
  if (!data) return null

  const statusColor = STATUS_COLORS[data.unified_status] || '#6B7280'

  return (
    <PageWrapper>
      {/* Status hero */}
      <div className="text-center py-8">
        <div className="text-5xl mb-3">{STATUS_ICONS[data.unified_status] || '📦'}</div>
        <div className="text-2xl font-bold mb-1" style={{ color: statusColor }}>
          {data.statusLabel || data.unified_status}
        </div>
        {data.last_tracking_description && (
          <div className="text-sm text-gray-500 mt-1">{data.last_tracking_description}</div>
        )}
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Informace o zásilce</h3>
        <InfoRow label="Číslo dokladu" value={data.doc_number} />
        <InfoRow label="Objednávka" value={data.order_number} />
        <InfoRow label="Dopravce" value={data.shipper_code} />
        <InfoRow label="Tracking" value={data.tracking_number} />
        {data.tracking_url && (
          <a href={data.tracking_url} target="_blank" rel="noopener noreferrer"
            className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-500 font-medium">
            Sledovat u dopravce &rarr;
          </a>
        )}
      </div>

      {/* Items */}
      {data.items && data.items.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Obsah zásilky</h3>
          {data.items.map((item, i) => (
            <div key={i} className="flex justify-between py-1.5 text-sm border-b border-gray-100 last:border-0">
              <span>{item.text} {item.brand && <span className="text-gray-400">({item.brand})</span>}</span>
              <span className="text-gray-500">{item.qty}x</span>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      {data.trackingTimeline && data.trackingTimeline.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase mb-4">Historie</h3>
          <div className="relative">
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />
            <div className="space-y-4">
              {data.trackingTimeline.map((event, i) => (
                <div key={i} className="flex items-start gap-4 relative">
                  <div
                    className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center z-10"
                    style={{ backgroundColor: i === 0 ? statusColor : '#e5e7eb' }}
                  >
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-800">{event.description}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {event.date ? new Date(event.date).toLocaleString('cs-CZ') : ''}
                      {event.location && ` — ${event.location}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Return link */}
      <div className="text-center mt-6">
        <a href="/vraceni" className="text-sm text-blue-600 hover:text-blue-500">
          Chcete vrátit zboží? Klikněte zde
        </a>
      </div>
    </PageWrapper>
  )
}

function PageWrapper({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1046A0] text-white">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <img src="/Mroauto_1994.png" alt="MROAUTO" className="h-10 object-contain" onError={(e) => { e.target.style.display = 'none' }} />
          <div>
            <div className="font-bold text-lg">MROAUTO</div>
            <div className="text-xs opacity-80">Sledování zásilky</div>
          </div>
        </div>
        <div className="h-1 bg-[#D8112A]" />
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {children}
      </div>

      {/* Footer */}
      <div className="bg-gray-100 border-t mt-8 py-4 text-center text-xs text-gray-400">
        MROAUTO AUTODÍLY s.r.o. | www.mroauto.cz
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value || '-'}</span>
    </div>
  )
}
