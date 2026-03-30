import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

const apiBase = import.meta.env.VITE_API_URL || '/api'

const STATUS_COLORS = {
  new: '#3B82F6', awaiting_shipment: '#F59E0B', in_transit: '#8B5CF6',
  received: '#6366F1', under_review: '#F97316', approved: '#10B981',
  rejected: '#EF4444', refund_pending: '#F59E0B', refunded: '#10B981',
  resolved: '#6B7280', cancelled: '#9CA3AF',
}

const CARRIER_LABELS = { zasilkovna: 'Zásilkovna', ppl: 'PPL', gls: 'GLS', cp: 'Česká pošta', self: 'Vlastní doprava' }
const METHOD_LABELS = { drop_off: 'Výdejní místo', courier_pickup: 'Svoz kurýrem', self_ship: 'Vlastní odeslání' }
const SHIPMENT_STATUS_LABELS = { pending: 'Připraveno', pending_payment: 'Čeká na platbu', label_generated: 'Štítek vygenerován', shipped: 'Odesláno', in_transit: 'V přepravě', delivered: 'Doručeno' }

export default function ReturnStatus() {
  const { accessToken } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const fetchData = async () => {
    try {
      const res = await axios.get(`${apiBase}/retino/public/returns/${accessToken}`)
      setData(res.data)
    } catch {
      setError('Žádost nenalezena')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [accessToken])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!message.trim()) return
    setSending(true)
    try {
      await axios.post(`${apiBase}/retino/public/returns/${accessToken}/message`, {
        content: message.trim(),
      })
      setMessage('')
      fetchData()
    } catch {
      alert('Nepodařilo se odeslat zprávu')
    }
    setSending(false)
  }

  if (loading) return <PageWrapper><div className="text-center py-12 text-gray-500">Načítání...</div></PageWrapper>
  if (error) return <PageWrapper><div className="text-center py-12 text-red-500">{error}</div></PageWrapper>
  if (!data) return null

  const statusColor = STATUS_COLORS[data.status] || '#6B7280'

  return (
    <PageWrapper>
      {/* Status */}
      <div className="text-center py-6">
        <div className="text-sm text-gray-500 mb-1">Žádost č.</div>
        <div className="text-2xl font-bold text-gray-800 mb-2">{data.return_number}</div>
        <span
          className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: statusColor }}
        >
          {data.statusLabel}
        </span>
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
        <InfoRow label="Typ" value={data.type === 'return' ? 'Vrácení' : data.type === 'complaint' ? 'Reklamace' : 'Záruka'} />
        <InfoRow label="Důvod" value={data.reasonLabel} />
        {data.reason_detail && <InfoRow label="Popis" value={data.reason_detail} />}
        {data.vehicle_info && <InfoRow label="Vozidlo" value={data.vehicle_info} />}
        <InfoRow label="Vytvořeno" value={data.requested_at ? new Date(data.requested_at).toLocaleString('cs-CZ') : '-'} />
      </div>

      {/* Items */}
      {data.items?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Produkty</h3>
          {data.items.map((item, i) => (
            <div key={i} className="flex justify-between py-1.5 text-sm border-b border-gray-100 last:border-0">
              <span>{item.delivery_note_items?.text || 'Produkt'}</span>
              <span className="text-gray-500">{item.qty_returned}x</span>
            </div>
          ))}
        </div>
      )}

      {/* Shipping */}
      {data.shipments?.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-blue-700 uppercase mb-2">Zpětná doprava</h3>
          {data.shipments.map((s) => (
            <div key={s.id}>
              <InfoRow label="Dopravce" value={CARRIER_LABELS[s.carrier] || s.carrier} />
              <InfoRow label="Způsob" value={METHOD_LABELS[s.shipping_method] || s.shipping_method} />
              <InfoRow label="Stav" value={SHIPMENT_STATUS_LABELS[s.status] || s.status} />
              {s.pickup_point_name && <InfoRow label="Výdejní místo" value={`${s.pickup_point_name} — ${s.pickup_point_address || ''}`} />}
              {s.tracking_number && <InfoRow label="Tracking" value={s.tracking_number} />}
              {s.cost > 0 && <InfoRow label="Cena" value={`${s.cost} ${s.currency || 'CZK'}`} />}
              {s.label_url && (
                <div className="mt-2">
                  <a href={s.label_url} target="_blank" rel="noopener noreferrer"
                    className="inline-block bg-[#1046A0] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">
                    Stáhnout štítek (PDF)
                  </a>
                </div>
              )}
              {s.status === 'pending_payment' && s.gopay_payment_url && (
                <div className="mt-2">
                  <p className="text-sm text-orange-700 mb-2">Štítek bude vygenerován po zaplacení.</p>
                  <a href={s.gopay_payment_url}
                    className="inline-block bg-[#2ECC71] text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90">
                    Zaplatit {s.cost} Kč
                  </a>
                </div>
              )}
              {s.shipping_method === 'self_ship' && s.status === 'pending' && (
                <div className="mt-2 bg-white rounded-lg p-3 text-sm text-gray-700">
                  <strong>Adresa pro zaslání:</strong><br />
                  MROAUTO AUTODÍLY s.r.o.<br />
                  Čs. armády 360, Pudlov, 735 51 Bohumín
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resolution */}
      {data.resolution_type && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-green-700 mb-1">Výsledek</h3>
          <div className="text-sm text-green-800">
            {data.resolution_type === 'refund' ? 'Vrácení peněz' :
             data.resolution_type === 'replacement' ? 'Výměna zboží' :
             data.resolution_type === 'repair' ? 'Oprava' : data.resolution_type}
          </div>
          {data.resolution_amount && (
            <div className="text-sm text-green-700 mt-1">Částka: {data.resolution_amount} {data.currency || 'CZK'}</div>
          )}
          {data.resolution_note && (
            <div className="text-sm text-green-700 mt-1">{data.resolution_note}</div>
          )}
        </div>
      )}

      {/* Timeline */}
      {data.timeline?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Historie</h3>
          <div className="relative">
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />
            <div className="space-y-3">
              {data.timeline.map((event, i) => (
                <div key={i} className="flex items-start gap-4 relative">
                  <div
                    className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center z-10"
                    style={{ backgroundColor: i === data.timeline.length - 1 ? statusColor : '#e5e7eb' }}
                  >
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{event.statusLabel}</div>
                    {event.note && <div className="text-xs text-gray-500 mt-0.5">{event.note}</div>}
                    <div className="text-xs text-gray-400 mt-0.5">
                      {event.created_at ? new Date(event.created_at).toLocaleString('cs-CZ') : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Zprávy</h3>
        {data.messages?.length > 0 ? (
          <div className="space-y-3 mb-4">
            {data.messages.map((msg) => (
              <div key={msg.id} className={`p-3 rounded-lg ${msg.author_type === 'customer' ? 'bg-blue-50 ml-4' : 'bg-gray-50 mr-4'}`}>
                <div className="text-xs text-gray-400 mb-1">
                  {msg.author_type === 'customer' ? 'Vy' : 'MROAUTO'} — {new Date(msg.created_at).toLocaleString('cs-CZ')}
                </div>
                <div className="text-sm text-gray-800">{msg.content}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400 mb-4">Zatím žádné zprávy</div>
        )}

        {!['resolved', 'cancelled'].includes(data.status) && (
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Napište zprávu..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="bg-[#1046A0] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
            >
              Odeslat
            </button>
          </form>
        )}
      </div>
    </PageWrapper>
  )
}

function PageWrapper({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1046A0] text-white">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <img src="/Mroauto_1994.png" alt="MROAUTO" className="h-10 object-contain" onError={(e) => { e.target.style.display = 'none' }} />
          <div>
            <div className="font-bold text-lg">MROAUTO</div>
            <div className="text-xs opacity-80">Stav žádosti</div>
          </div>
        </div>
        <div className="h-1 bg-[#D8112A]" />
      </div>
      <div className="max-w-lg mx-auto px-4 py-6">{children}</div>
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
