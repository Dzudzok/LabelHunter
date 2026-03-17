import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../services/api'

const STATUS_CONFIG = {
  pending: { label: 'Příprava', color: 'bg-gray-500', icon: '&#8987;' },
  scanning: { label: 'Příprava', color: 'bg-yellow-500', icon: '&#8987;' },
  verified: { label: 'Příprava', color: 'bg-yellow-500', icon: '&#8987;' },
  label_generated: { label: 'Připraveno k odeslání', color: 'bg-blue-500', icon: '&#128230;' },
  shipped: { label: 'V přepravě', color: 'bg-yellow-500', icon: '&#128666;' },
  delivered: { label: 'Doručeno', color: 'bg-green-500', icon: '&#10003;' },
  returned: { label: 'Vráceno', color: 'bg-gray-500', icon: '&#8617;' },
  problem: { label: 'Problém', color: 'bg-red-500', icon: '&#9888;' },
}

export default function TrackingPage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    api.get(`/tracking/public/${token}`)
      .then(res => {
        setData(res.data)
        setLoading(false)
      })
      .catch(() => {
        setError('Zásilka nenalezena')
        setLoading(false)
      })
  }, [token])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!message.trim()) return
    setSending(true)
    try {
      await api.post(`/tracking/public/${token}/message`, {
        message: message.trim(),
        email: contactEmail.trim(),
      })
      setSent(true)
      setMessage('')
      setContactEmail('')
    } catch {
      // Error handling
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <div className="text-xl text-gray-500">Načítání sledování...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex flex-col items-center justify-center p-6">
        <div className="text-2xl text-red-500 mb-4">{error}</div>
        <p className="text-gray-500">Zkontrolujte prosím odkaz na sledování.</p>
      </div>
    )
  }

  const pkg = data?.package
  const items = data?.items || []
  const trackingItems = data?.tracking?.data?.[0]?.trackingItems
    || data?.tracking?.trackingItems
    || []
  const carrierTrackingUrl = data?.tracking?.data?.[0]?.trackingUrl || pkg?.tracking_url
  const statusInfo = STATUS_CONFIG[pkg?.status] || STATUS_CONFIG.pending

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {/* Header */}
      <div className="bg-[#0047ab] px-4 py-6 border-b-4 border-[#e31e24]">
        <div className="max-w-xl mx-auto text-center">
          <img
            src="https://ckeditor.nextis.cz/filemanager/uploads/0E1D0AF7179CBD54DA902DDFAFD59F3F/MROdesign_2022_2%20(1).png"
            alt="MROAUTO"
            className="h-14 mx-auto mb-2"
          />
          <p className="text-blue-200 text-sm">Sledování zásilky</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6">
        {/* Status badge */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center gap-3 ${statusInfo.color} text-white px-8 py-4 rounded-2xl text-2xl font-bold shadow-lg`}>
            <span dangerouslySetInnerHTML={{ __html: statusInfo.icon }} />
            {statusInfo.label}
          </div>
        </div>

        {/* Tracking timeline */}
        {trackingItems.length > 0 && (
          <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Přehled přepravy</h2>
            <div className="relative">
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200" />
              <div className="flex flex-col gap-4">
                {trackingItems.map((item, idx) => (
                  <div key={idx} className="flex gap-4 relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                      idx === 0 ? 'bg-[#e31e24]' : 'bg-gray-300'
                    }`}>
                      <div className="w-3 h-3 rounded-full bg-white" />
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="text-sm text-gray-400">
                        {item.date
                          ? new Date(item.date).toLocaleString('cs-CZ', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })
                          : ''}
                      </div>
                      <div className="text-gray-800 font-medium mt-1">
                        {item.description || item.text}
                      </div>
                      {item.place && (
                        <div className="text-gray-500 text-sm">{item.place}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Package info */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Informace o zásilce</h2>
          <div className="space-y-3">
            {pkg?.invoice_number && (
              <div className="flex justify-between">
                <span className="text-gray-500">Faktura</span>
                <span className="text-gray-800 font-medium">{pkg.invoice_number}</span>
              </div>
            )}
            {pkg?.order_number && (
              <div className="flex justify-between">
                <span className="text-gray-500">Objednávka</span>
                <span className="text-gray-800 font-medium">{pkg.order_number}</span>
              </div>
            )}
            {pkg?.transport_name && (
              <div className="flex justify-between">
                <span className="text-gray-500">Přepravce</span>
                <span className="text-gray-800 font-medium">{pkg.shipper_code ? `${pkg.shipper_code} | ` : ''}{pkg.transport_name}</span>
              </div>
            )}
            {pkg?.tracking_number && (
              <div className="flex justify-between">
                <span className="text-gray-500">Číslo zásilky</span>
                <span className="text-gray-800 font-mono font-medium">{pkg.tracking_number}</span>
              </div>
            )}
            {carrierTrackingUrl && (
              <div className="flex justify-between">
                <span className="text-gray-500">Sledování u přepravce</span>
                <a
                  href={carrierTrackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0047ab] hover:underline font-semibold"
                >
                  Otevřít
                </a>
              </div>
            )}
          </div>

          {/* Product list */}
          {items.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-600 mb-3">Obsah zásilky</h3>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-600 truncate flex-1">
                      {parseFloat(item.qty) || 1}x {item.text}
                    </span>
                    {item.code && (
                      <span className="text-gray-400 font-mono ml-2 shrink-0">{item.code}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Contact info */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Kontakt</h2>
          <div className="space-y-2">
            <a href="mailto:info@mroauto.cz" className="text-[#0047ab] hover:underline block text-lg">
              info@mroauto.cz
            </a>
            <a href="tel:+420774917859" className="text-[#0047ab] hover:underline block text-lg">
              +420 774 917 859
            </a>
          </div>
        </div>

        {/* Contact form */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Napište nám</h2>
          {sent ? (
            <div className="text-center py-4 text-green-600 text-lg font-semibold">
              Zpráva odeslána. Děkujeme!
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="flex flex-col gap-3">
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="Váš email"
                className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400 outline-none focus:border-[#0047ab] focus:ring-1 focus:ring-[#0047ab]"
              />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Vaše zpráva..."
                rows={4}
                className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400 outline-none resize-none focus:border-[#0047ab] focus:ring-1 focus:ring-[#0047ab]"
              />
              <button
                type="submit"
                disabled={sending || !message.trim()}
                className="bg-[#e31e24] hover:bg-[#c41a1f] text-white py-3 rounded-xl text-lg font-bold transition-colors disabled:opacity-50"
              >
                {sending ? 'Odesílám...' : 'Odeslat zprávu'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-gray-400 text-sm pb-8">
          MROAUTO AUTODÍLY s.r.o. | Čs. armády 360, Pudlov, 735 51 Bohumín
        </div>
      </div>
    </div>
  )
}
