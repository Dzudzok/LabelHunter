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
    } catch { setError('Žádost nenalezena') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [accessToken])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!message.trim()) return
    setSending(true)
    try {
      await axios.post(`${apiBase}/retino/public/returns/${accessToken}/message`, { content: message.trim() })
      setMessage('')
      fetchData()
    } catch { alert('Nepodařilo se odeslat zprávu') }
    setSending(false)
  }

  if (loading) return <PageWrapper><div className="text-center py-20"><div className="w-8 h-8 border-4 border-[#1046A0] border-t-transparent rounded-full animate-spin mx-auto" /></div></PageWrapper>
  if (error) return <PageWrapper><div className="text-center py-20 text-red-500 font-medium">{error}</div></PageWrapper>
  if (!data) return null

  const statusColor = STATUS_COLORS[data.status] || '#6B7280'
  const hasLabel = data.shipments?.some(s => s.label_url)

  return (
    <PageWrapper>
      {/* Hero status */}
      <div className="text-center mb-6">
        <p className="text-sm text-gray-400 font-medium mb-1">Žádost č.</p>
        <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">{data.return_number}</h1>
        <span className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-bold text-white shadow-md"
          style={{ backgroundColor: statusColor }}>
          <span className="w-2 h-2 rounded-full bg-white/40" />
          {data.statusLabel}
        </span>
      </div>

      {/* Label download — prominent */}
      {hasLabel && (
        <div className="mb-5 p-6 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
          <div className="w-14 h-14 mx-auto mb-3 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20 rotate-2">
            <svg className="w-7 h-7 text-white -rotate-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Přepravní štítek je připraven!</h3>
          <p className="text-sm text-gray-500 mb-4">Vytiskněte štítek, nalepte jej na balík a odevzdejte u dopravce.</p>
          {data.shipments.filter(s => s.label_url).map(s => (
            <a key={s.id} href={s.label_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#D8112A] text-white px-8 py-3.5 rounded-2xl font-bold text-lg shadow-lg shadow-red-500/20 hover:shadow-red-500/30 hover:-translate-y-0.5 transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Stáhnout štítek (PDF)
            </a>
          ))}
        </div>
      )}

      {/* Info card */}
      <Card>
        <InfoRow label="Typ" value={data.type === 'return' ? 'Vrácení' : data.type === 'complaint' ? 'Reklamace' : 'Záruka'} />
        <InfoRow label="Důvod" value={data.reasonLabel} />
        {data.reason_detail && <InfoRow label="Popis" value={data.reason_detail} />}
        {data.vehicle_info && <InfoRow label="Vozidlo" value={data.vehicle_info} />}
        <InfoRow label="Vytvořeno" value={data.requested_at ? new Date(data.requested_at).toLocaleString('cs-CZ') : '-'} />
      </Card>

      {/* Items */}
      {data.items?.length > 0 && (
        <Card title="Produkty">
          {data.items.map((item, i) => (
            <div key={i} className="flex justify-between py-2 text-sm border-b border-gray-100 last:border-0">
              <span className="text-gray-700">{item.delivery_note_items?.text || 'Produkt'}</span>
              <span className="font-semibold text-gray-400">{item.qty_returned}×</span>
            </div>
          ))}
        </Card>
      )}

      {/* Shipping */}
      {data.shipments?.length > 0 && (
        <Card title="Zpětná doprava" accent="blue">
          {data.shipments.map((s) => (
            <div key={s.id}>
              <InfoRow label="Dopravce" value={CARRIER_LABELS[s.carrier] || s.carrier} />
              <InfoRow label="Způsob" value={METHOD_LABELS[s.shipping_method] || s.shipping_method} />
              <InfoRow label="Stav" value={SHIPMENT_STATUS_LABELS[s.status] || s.status} />
              {s.pickup_point_name && <InfoRow label="Výdejní místo" value={`${s.pickup_point_name}`} />}
              {s.tracking_number && <InfoRow label="Tracking" value={s.tracking_number} />}
              {s.cost > 0 && <InfoRow label="Cena" value={`${s.cost} ${s.currency || 'CZK'}`} />}

              {s.status === 'pending_payment' && s.gopay_payment_url && (
                <div className="mt-4 p-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl text-center">
                  <p className="text-sm text-orange-800 font-semibold mb-3">Štítek bude vygenerován po zaplacení</p>
                  <a href={s.gopay_payment_url}
                    className="inline-flex items-center gap-2 bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 transition-all">
                    Zaplatit {s.cost} Kč
                  </a>
                </div>
              )}

              {s.shipping_method === 'self_ship' && s.status === 'pending' && (
                <div className="mt-3 p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
                  <strong>Adresa pro zaslání:</strong><br />
                  MROAUTO AUTODÍLY s.r.o., Čs. armády 360, Pudlov, 735 51 Bohumín
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* Resolution */}
      {data.resolution_type && (
        <Card title="Výsledek" accent="green">
          <div className="font-semibold text-gray-800">
            {data.resolution_type === 'refund' ? 'Vrácení peněz' :
             data.resolution_type === 'replacement' ? 'Výměna zboží' :
             data.resolution_type === 'repair' ? 'Oprava' : data.resolution_type}
          </div>
          {data.resolution_amount && <div className="text-sm text-green-700 mt-1">Částka: {data.resolution_amount} {data.currency || 'CZK'}</div>}
          {data.resolution_note && <div className="text-sm text-gray-600 mt-1">{data.resolution_note}</div>}
        </Card>
      )}

      {/* Timeline */}
      {data.timeline?.length > 0 && (
        <Card title="Historie">
          <div className="relative ml-3">
            <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-gray-200" />
            <div className="space-y-4 pl-6">
              {data.timeline.map((event, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-6 top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: i === data.timeline.length - 1 ? statusColor : '#d1d5db' }} />
                  <div className="text-sm font-semibold text-gray-800">{event.statusLabel}</div>
                  {event.note && <div className="text-xs text-gray-500 mt-0.5">{event.note}</div>}
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {event.created_at ? new Date(event.created_at).toLocaleString('cs-CZ') : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Messages */}
      <Card title="Zprávy">
        {data.messages?.length > 0 ? (
          <div className="space-y-3 mb-4">
            {data.messages.map((msg) => (
              <div key={msg.id} className={`p-3 rounded-xl text-sm ${
                msg.author_type === 'customer' ? 'bg-blue-50 ml-6 border border-blue-100' : 'bg-gray-50 mr-6 border border-gray-100'
              }`}>
                <div className="text-[11px] text-gray-400 mb-1 font-medium">
                  {msg.author_type === 'customer' ? 'Vy' : 'MROAUTO'} · {new Date(msg.created_at).toLocaleString('cs-CZ')}
                </div>
                <div className="text-gray-800">{msg.content}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400 mb-4 text-center py-2">Zatím žádné zprávy</div>
        )}

        {!['resolved', 'cancelled'].includes(data.status) && (
          <form onSubmit={sendMessage} className="flex gap-2">
            <input type="text" value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Napište zprávu..."
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:bg-white focus:border-[#1046A0] focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
            <button type="submit" disabled={sending || !message.trim()}
              className="bg-[#1046A0] text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-[#0d3a85] transition-colors">
              Odeslat
            </button>
          </form>
        )}
      </Card>
    </PageWrapper>
  )
}

function Card({ children, title, accent }) {
  const accentColors = { blue: 'border-l-blue-500', green: 'border-l-emerald-500', orange: 'border-l-orange-500' }
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4 ${accent ? `border-l-4 ${accentColors[accent] || ''}` : ''}`}>
      {title && <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">{title}</h3>}
      {children}
    </div>
  )
}

function PageWrapper({ children }) {
  return (
    <div className="min-h-screen" data-public-page>
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a2d6e] via-[#1046A0] to-[#1a56b8]" />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="relative max-w-lg mx-auto px-4 py-5 flex items-center gap-3">
          <img src="/Mroauto_1994.png" alt="MROAUTO" className="h-12 object-contain drop-shadow-lg" onError={(e) => { e.target.style.display = 'none' }} />
          <div>
            <div className="font-black text-xl text-white tracking-tight">MROAUTO</div>
            <div className="text-[11px] text-blue-200 font-medium">Stav žádosti</div>
          </div>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-[#D8112A] via-[#ff3333] to-[#D8112A]" />
      </header>
      <main className="max-w-lg mx-auto px-4 py-8">{children}</main>
      <footer className="mt-16 py-6 text-center border-t border-gray-200/50">
        <p className="text-xs text-gray-400 font-medium">MROAUTO AUTODÍLY s.r.o. · www.mroauto.cz</p>
        <p className="text-[10px] text-gray-300 mt-1 font-semibold tracking-widest uppercase">Powered by RETURO</p>
      </footer>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-gray-400 font-medium">{label}</span>
      <span className="font-semibold text-gray-800 text-right max-w-[60%]">{value || '—'}</span>
    </div>
  )
}
