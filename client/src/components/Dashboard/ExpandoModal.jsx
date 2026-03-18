import { useState } from 'react'
import { api } from '../../services/api'

export default function ExpandoModal({ date, onClose }) {
  const [carrier, setCarrier] = useState('GLS')
  const [selectedDate, setSelectedDate] = useState(date)
  const [invoices, setInvoices] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

  const fetchInvoices = async () => {
    setLoading(true)
    setError('')
    setResults(null)
    setInvoices(null)
    try {
      const res = await api.post('/packages/expando-fetch-invoices', {
        date: selectedDate,
      }, { timeout: 180000 })
      setInvoices(res.data)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!invoices?.withMarketplace?.length) return
    setSending(true)
    setError('')
    try {
      const res = await api.post('/packages/expando-fulfillment', {
        rows: invoices.withMarketplace,
        carrier,
        date: selectedDate,
      }, { timeout: 300000 })
      setResults(res.data)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 overlay-bg z-50 flex items-start justify-center pt-4 px-4 overflow-y-auto">
      <div className="bg-navy-800 border border-navy-600 rounded-2xl w-full max-w-3xl mb-8">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700">
          <h2 className="text-xl font-bold text-theme-primary">Expando — wyślij numery paczek</h2>
          <button onClick={onClose} className="text-theme-secondary hover:text-theme-primary text-2xl min-h-0 leading-none">&times;</button>
        </div>

        <div className="px-6 py-6 flex flex-col gap-5">

          {/* Settings */}
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <label className="text-theme-muted text-xs mb-1 block">Data</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-theme-primary text-sm outline-none focus:border-brand-orange"
              />
            </div>
            <div>
              <label className="text-theme-muted text-xs mb-1 block">Carrier (Expando)</label>
              <input
                type="text"
                value={carrier}
                onChange={e => setCarrier(e.target.value)}
                placeholder="GLS, DPD, UPS..."
                className="bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-theme-primary text-sm outline-none focus:border-brand-orange w-40"
              />
            </div>
            <button
              onClick={fetchInvoices}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Pobieram z Nextis...' : 'Pobierz faktury z Nextis'}
            </button>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-600 rounded-lg p-3 text-red-300 text-sm">{error}</div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-8 text-theme-secondary">
              Pobieram faktury z Nextis API... (może trwać do 2 min)
            </div>
          )}

          {/* Preview */}
          {invoices && !results && (
            <>
              <div className="flex gap-4 text-sm">
                <span className="text-theme-secondary">Faktur razem: <strong className="text-theme-primary">{invoices.total}</strong></span>
                <span className="text-theme-secondary">Z marketplace: <strong className="text-green-400">{invoices.withMarketplace.length}</strong></span>
              </div>

              {invoices.withMarketplace.length === 0 ? (
                <div className="text-center py-4 text-theme-muted">Brak faktur z danymi marketplace na ten dzień</div>
              ) : (
                <>
                  <div className="max-h-60 overflow-y-auto border border-navy-600 rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-theme-muted text-left border-b border-navy-600 text-xs uppercase bg-navy-700 sticky top-0">
                          <th className="px-3 py-2">FV</th>
                          <th className="px-3 py-2">Marketplace</th>
                          <th className="px-3 py-2">Order ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.withMarketplace.slice(0, 100).map((r, i) => (
                          <tr key={i} className="border-b border-navy-700/50">
                            <td className="px-3 py-1.5 text-theme-primary font-mono text-xs">{r.invoiceNumber}</td>
                            <td className="px-3 py-1.5 text-theme-secondary text-xs">{r.marketplace}</td>
                            <td className="px-3 py-1.5 text-theme-secondary font-mono text-xs">{r.marketplaceOrderId}</td>
                          </tr>
                        ))}
                        {invoices.withMarketplace.length > 100 && (
                          <tr><td colSpan={3} className="px-3 py-2 text-theme-muted text-center text-xs">...i {invoices.withMarketplace.length - 100} więcej</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl text-lg font-bold transition-colors disabled:opacity-50"
                  >
                    {sending
                      ? `Wysyłam... (${invoices.withMarketplace.length} pozycji)`
                      : `Wyślij do Expando — ${carrier} (${invoices.withMarketplace.length})`}
                  </button>
                </>
              )}
            </>
          )}

          {/* Results */}
          {results && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-900/40 border border-green-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-black text-green-400">{results.summary.ok}</div>
                  <div className="text-theme-secondary text-xs">Wysłano</div>
                </div>
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-black text-red-400">{results.summary.errors}</div>
                  <div className="text-theme-secondary text-xs">Błędy</div>
                </div>
                <div className="bg-navy-700 border border-navy-600 rounded-lg p-3 text-center">
                  <div className="text-2xl font-black text-theme-secondary">{results.summary.skipped}</div>
                  <div className="text-theme-secondary text-xs">Pominięto (brak tracking)</div>
                </div>
              </div>

              {results.results.filter(r => r.status !== 'ok').length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-navy-600 rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-theme-muted text-left border-b border-navy-600 text-xs uppercase bg-navy-700">
                        <th className="px-3 py-2">FV</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Powód</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.results.filter(r => r.status !== 'ok').map((r, i) => (
                        <tr key={i} className="border-b border-navy-700/50">
                          <td className="px-3 py-1.5 text-theme-primary font-mono text-xs">{r.invoiceNumber}</td>
                          <td className="px-3 py-1.5">
                            <span className={r.status === 'error' ? 'text-red-400' : 'text-yellow-400'}>{r.status}</span>
                          </td>
                          <td className="px-3 py-1.5 text-theme-secondary text-xs">{r.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Show successful ones too */}
              {results.results.filter(r => r.status === 'ok').length > 0 && (
                <details className="text-sm">
                  <summary className="text-theme-secondary cursor-pointer hover:text-theme-primary">
                    Pokaż wysłane ({results.summary.ok})
                  </summary>
                  <div className="max-h-40 overflow-y-auto border border-navy-600 rounded-lg mt-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-theme-muted text-left border-b border-navy-600 text-xs uppercase bg-navy-700">
                          <th className="px-3 py-2">FV</th>
                          <th className="px-3 py-2">Order ID</th>
                          <th className="px-3 py-2">Tracking</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.results.filter(r => r.status === 'ok').map((r, i) => (
                          <tr key={i} className="border-b border-navy-700/50">
                            <td className="px-3 py-1.5 text-green-400 font-mono text-xs">{r.invoiceNumber}</td>
                            <td className="px-3 py-1.5 text-theme-secondary font-mono text-xs">{r.marketplaceOrderId}</td>
                            <td className="px-3 py-1.5 text-theme-secondary font-mono text-xs">{r.trackingNumber}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-navy-700">
          <button
            onClick={onClose}
            className="bg-navy-600 hover:bg-navy-500 text-theme-secondary px-5 py-2 rounded-xl text-base font-semibold min-h-0"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  )
}
