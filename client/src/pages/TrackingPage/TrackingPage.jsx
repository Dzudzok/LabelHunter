import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../services/api'

const STATUS_CONFIG = {
  pending: { label: 'Priprava', color: 'bg-gray-500', icon: '&#8987;' },
  scanning: { label: 'Priprava', color: 'bg-yellow-500', icon: '&#8987;' },
  verified: { label: 'Priprava', color: 'bg-yellow-500', icon: '&#8987;' },
  label_generated: { label: 'Pripraveno k odeslani', color: 'bg-blue-500', icon: '&#128230;' },
  shipped: { label: 'V preprave', color: 'bg-yellow-500', icon: '&#128666;' },
  delivered: { label: 'Doruceno', color: 'bg-green-500', icon: '&#10003;' },
  returned: { label: 'Vraceno', color: 'bg-gray-500', icon: '&#8617;' },
  problem: { label: 'Problem', color: 'bg-red-500', icon: '&#9888;' },
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
        setError('Zasilka nenalezena')
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
      <div className="min-h-screen bg-navy-800 flex items-center justify-center">
        <div className="text-xl text-theme-secondary">Nacitani sledovani...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-navy-800 flex flex-col items-center justify-center p-6">
        <div className="text-2xl text-red-400 mb-4">{error}</div>
        <p className="text-theme-muted">Zkontrolujte prosim odkaz na sledovani.</p>
      </div>
    )
  }

  const pkg = data?.package
  const items = data?.items || []
  // LP API tracking: data.tracking.data[0].trackingItems
  const trackingItems = data?.tracking?.data?.[0]?.trackingItems
    || data?.tracking?.trackingItems
    || []
  const carrierTrackingUrl = data?.tracking?.data?.[0]?.trackingUrl || pkg?.tracking_url
  const statusInfo = STATUS_CONFIG[pkg?.status] || STATUS_CONFIG.pending

  return (
    <div className="min-h-screen bg-navy-800">
      {/* Header */}
      <div className="bg-navy-900 border-b border-navy-700 px-4 py-6">
        <div className="max-w-xl mx-auto text-center">
          <h1 className="text-3xl font-black text-theme-primary">
            MRO<span className="text-brand-orange">AUTO</span>
          </h1>
          <p className="text-theme-secondary mt-1">Sledovani zasilky</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6">
        {/* Status badge */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center gap-3 ${statusInfo.color} text-white px-8 py-4 rounded-2xl text-2xl font-bold`}>
            <span dangerouslySetInnerHTML={{ __html: statusInfo.icon }} />
            {statusInfo.label}
          </div>
        </div>

        {/* Tracking timeline */}
        {trackingItems.length > 0 && (
          <div className="bg-navy-700 rounded-xl p-6 border border-navy-600 mb-6">
            <h2 className="text-xl font-bold text-theme-primary mb-4">Prehled prepravy</h2>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-navy-600" />

              <div className="flex flex-col gap-4">
                {trackingItems.map((item, idx) => (
                  <div key={idx} className="flex gap-4 relative">
                    {/* Dot */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                      idx === 0 ? 'bg-brand-orange' : 'bg-navy-600'
                    }`}>
                      <div className="w-3 h-3 rounded-full bg-white" />
                    </div>
                    {/* Content */}
                    <div className="flex-1 pb-2">
                      <div className="text-sm text-theme-muted">
                        {item.date
                          ? new Date(item.date).toLocaleString('cs-CZ', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })
                          : ''}
                      </div>
                      <div className="text-theme-primary font-medium mt-1">
                        {item.description || item.text}
                      </div>
                      {item.place && (
                        <div className="text-theme-secondary text-sm">{item.place}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Package info */}
        <div className="bg-navy-700 rounded-xl p-6 border border-navy-600 mb-6">
          <h2 className="text-xl font-bold text-theme-primary mb-4">Informace o zasilce</h2>
          <div className="space-y-3">
            {pkg?.invoice_number && (
              <div className="flex justify-between">
                <span className="text-theme-muted">Faktura</span>
                <span className="text-theme-primary font-medium">{pkg.invoice_number}</span>
              </div>
            )}
            {pkg?.order_number && (
              <div className="flex justify-between">
                <span className="text-theme-muted">Objednavka</span>
                <span className="text-theme-primary font-medium">{pkg.order_number}</span>
              </div>
            )}
            {pkg?.transport_name && (
              <div className="flex justify-between">
                <span className="text-theme-muted">Prepravce</span>
                <span className="text-theme-primary font-medium">{pkg.transport_name}</span>
              </div>
            )}
            {pkg?.tracking_number && (
              <div className="flex justify-between">
                <span className="text-theme-muted">Cislo zasilky</span>
                <span className="text-theme-primary font-mono font-medium">{pkg.tracking_number}</span>
              </div>
            )}
            {carrierTrackingUrl && (
              <div className="flex justify-between">
                <span className="text-theme-muted">Sledovani u prepravce</span>
                <a
                  href={carrierTrackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-orange hover:underline"
                >
                  Otevrit
                </a>
              </div>
            )}
          </div>

          {/* Product list */}
          {items.length > 0 && (
            <div className="mt-6 pt-4 border-t border-navy-600">
              <h3 className="text-lg font-semibold text-theme-secondary mb-3">Obsah zasilky</h3>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-theme-secondary truncate flex-1">
                      {parseFloat(item.qty) || 1}x {item.text}
                    </span>
                    {item.code && (
                      <span className="text-theme-muted font-mono ml-2 shrink-0">{item.code}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Contact info */}
        <div className="bg-navy-700 rounded-xl p-6 border border-navy-600 mb-6">
          <h2 className="text-xl font-bold text-theme-primary mb-4">Kontakt</h2>
          <div className="space-y-2">
            <a href="mailto:info@mroauto.cz" className="text-brand-orange hover:underline block text-lg">
              info@mroauto.cz
            </a>
            <a href="tel:+420774917859" className="text-brand-orange hover:underline block text-lg">
              +420 774 917 859
            </a>
          </div>
        </div>

        {/* Contact form */}
        <div className="bg-navy-700 rounded-xl p-6 border border-navy-600 mb-6">
          <h2 className="text-xl font-bold text-theme-primary mb-4">Napiste nam</h2>
          {sent ? (
            <div className="text-center py-4 text-green-400 text-lg">
              Zprava odeslana. Dekujeme!
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="flex flex-col gap-3">
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="Vas email"
                className="bg-navy-900 border border-navy-600 rounded-lg px-4 py-3 text-theme-primary placeholder-theme-muted outline-none focus:border-brand-orange"
              />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Vase zprava..."
                rows={4}
                className="bg-navy-900 border border-navy-600 rounded-lg px-4 py-3 text-theme-primary placeholder-theme-muted outline-none resize-none focus:border-brand-orange"
              />
              <button
                type="submit"
                disabled={sending || !message.trim()}
                className="bg-brand-orange hover:bg-brand-orange-dark text-white py-3 rounded-xl text-lg font-bold transition-colors disabled:opacity-50"
              >
                {sending ? 'Odesilam...' : 'Odeslat zpravu'}
              </button>
            </form>
          )}
        </div>

        {/* Return button */}
        <Link
          to={`/return/${token}`}
          className="block w-full bg-navy-700 hover:bg-navy-600 border border-navy-600 text-theme-primary py-4 rounded-xl text-xl font-bold text-center transition-colors mb-8"
        >
          Vratit zasilku
        </Link>

        {/* Footer */}
        <div className="text-center text-theme-muted text-sm pb-8">
          MROAUTO AUTODILY s.r.o.
        </div>
      </div>
    </div>
  )
}
