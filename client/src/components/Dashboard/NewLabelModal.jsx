import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/authStore'

const EMPTY_FORM = {
  shipperCode: '',
  serviceCode: '',
  recipientName: '',
  recipientStreet: '',
  recipientCity: '',
  recipientPostalCode: '',
  recipientCountry: 'CZ',
  recipientPhone: '',
  recipientEmail: '',
  weight: '1',
  codAmount: '0',
  currency: 'CZK',
  invoiceNumber: '',
  orderNumber: '',
}

export default function NewLabelModal({ onClose }) {
  const worker = useAuthStore(s => s.worker)
  const [form, setForm] = useState(EMPTY_FORM)
  const [shippers, setShippers] = useState([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    api.get('/labelprinter/shippers')
      .then(r => setShippers(Array.isArray(r.data) ? r.data : (r.data?.data || [])))
      .catch(console.error)
  }, [])

  const set = (field, value) => setForm(p => ({ ...p, [field]: value }))

  const selectedShipper = shippers.find(s => s.code === form.shipperCode)
  const services = selectedShipper?.services || []

  const printLabel = async (pkgId) => {
    const url = `${import.meta.env.VITE_API_URL || '/api'}/packages/${pkgId}/view-label`
    try {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error('fetch failed')
      const blob = await resp.blob()
      const blobUrl = URL.createObjectURL(blob)
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;'
      iframe.src = blobUrl
      document.body.appendChild(iframe)
      iframe.onload = () => {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
        setTimeout(() => {
          document.body.removeChild(iframe)
          URL.revokeObjectURL(blobUrl)
        }, 60000)
      }
    } catch {
      window.open(url, '_blank')
    }
  }

  const handleSubmit = async () => {
    if (!form.shipperCode || !form.serviceCode) {
      setError('Wybierz przewoźnika i usługę')
      return
    }
    if (!form.recipientName || !form.recipientCity || !form.recipientPostalCode) {
      setError('Wypełnij imię, miasto i kod pocztowy')
      return
    }
    setGenerating(true)
    setError('')
    try {
      const res = await api.post('/packages/manual-label', {
        ...form,
        workerId: worker?.id || null,
      })
      setResult(res.data)
      if (res.data.label_url) printLabel(res.data.id)
    } catch (err) {
      const errData = err.response?.data
      const apiErrors = errData?.details?.errors
      if (apiErrors && apiErrors.length > 0) {
        setError(apiErrors.map(e => e.message).join('\n'))
      } else {
        setError(errData?.error || err.message)
      }
    } finally {
      setGenerating(false)
    }
  }

  const inputCls = 'w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-theme-primary text-sm outline-none focus:border-brand-orange'

  return (
    <div className="fixed inset-0 overlay-bg z-50 flex items-start justify-center pt-6 px-4 overflow-y-auto">
      <div className="bg-navy-800 border border-navy-600 rounded-2xl w-full max-w-2xl mb-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700">
          <h2 className="text-xl font-bold text-theme-primary">Nowa etykieta</h2>
          <button onClick={onClose} className="text-theme-secondary hover:text-theme-primary text-2xl min-h-0 leading-none">&times;</button>
        </div>

        {result ? (
          <div className="px-6 py-8 text-center">
            <div className="text-green-400 text-2xl font-bold mb-2">Etykieta wygenerowana</div>
            <div className="text-theme-secondary mb-1">Tracking: {result.tracking_number || result.barcode || '—'}</div>
            <div className="flex gap-3 mt-6 justify-center">
              <button
                onClick={() => printLabel(result.id)}
                className="bg-brand-orange hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold"
              >
                Drukuj ponownie
              </button>
              <a
                href={`${import.meta.env.VITE_API_URL || '/api'}/packages/${result.id}/download-label`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-navy-600 hover:bg-navy-500 text-theme-secondary px-6 py-3 rounded-xl font-bold"
              >
                PDF
              </a>
              <button onClick={() => { setResult(null); setForm(EMPTY_FORM) }} className="bg-navy-700 hover:bg-navy-600 text-theme-secondary px-6 py-3 rounded-xl font-semibold">
                Nowa
              </button>
              <button onClick={onClose} className="bg-green-700 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-semibold">
                Zamknij
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 space-y-4">
            {/* Shipper */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-theme-muted text-xs mb-1 block">Przewoźnik *</label>
                <select value={form.shipperCode} onChange={e => set('shipperCode', e.target.value) || set('serviceCode', '')} className={inputCls}>
                  <option value="">— Wybierz —</option>
                  {shippers.map(s => <option key={s.code} value={s.code}>{s.name || s.code} ({s.code})</option>)}
                </select>
              </div>
              {form.shipperCode && services.length > 0 && (
                <div className="flex-1">
                  <label className="text-theme-muted text-xs mb-1 block">Usługa *</label>
                  <select value={form.serviceCode} onChange={e => set('serviceCode', e.target.value)} className={inputCls}>
                    <option value="">— Wybierz —</option>
                    {services.map(s => <option key={s.code} value={s.code}>{s.code}{s.name ? ` — ${s.name}` : ''}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Recipient */}
            <div>
              <label className="text-theme-muted text-xs mb-1 block">Nazwa / firma *</label>
              <input value={form.recipientName} onChange={e => set('recipientName', e.target.value)} placeholder="Jan Kowalski" className={inputCls} />
            </div>
            <div>
              <label className="text-theme-muted text-xs mb-1 block">Ulica</label>
              <input value={form.recipientStreet} onChange={e => set('recipientStreet', e.target.value)} placeholder="Główna 1" className={inputCls} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-theme-muted text-xs mb-1 block">Miasto *</label>
                <input value={form.recipientCity} onChange={e => set('recipientCity', e.target.value)} placeholder="Warszawa" className={inputCls} />
              </div>
              <div>
                <label className="text-theme-muted text-xs mb-1 block">Kod poczt. *</label>
                <input value={form.recipientPostalCode} onChange={e => set('recipientPostalCode', e.target.value)} placeholder="11000" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-theme-muted text-xs mb-1 block">Telefon</label>
                <input value={form.recipientPhone} onChange={e => set('recipientPhone', e.target.value)} placeholder="+420 123 456 789" className={inputCls} />
              </div>
              <div>
                <label className="text-theme-muted text-xs mb-1 block">Kraj</label>
                <select value={form.recipientCountry} onChange={e => set('recipientCountry', e.target.value)} className={inputCls}>
                  <option value="CZ">CZ</option>
                  <option value="SK">SK</option>
                  <option value="DE">DE</option>
                  <option value="AT">AT</option>
                  <option value="PL">PL</option>
                  <option value="HU">HU</option>
                </select>
              </div>
            </div>

            {/* Weight + COD + refs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-theme-muted text-xs mb-1 block">Waga (kg)</label>
                <input type="number" min="0.1" step="0.1" value={form.weight} onChange={e => set('weight', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-theme-muted text-xs mb-1 block">Pobranie</label>
                <div className="flex gap-1">
                  <input type="number" min="0" step="0.01" value={form.codAmount} onChange={e => set('codAmount', e.target.value)} className={inputCls} />
                  <select value={form.currency} onChange={e => set('currency', e.target.value)} className="bg-navy-900 border border-navy-600 rounded-lg px-2 text-theme-primary text-sm outline-none focus:border-brand-orange">
                    <option>CZK</option><option>EUR</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-theme-muted text-xs mb-1 block">Faktura</label>
                <input value={form.invoiceNumber} onChange={e => set('invoiceNumber', e.target.value)} placeholder="FV-1234" className={inputCls} />
              </div>
              <div>
                <label className="text-theme-muted text-xs mb-1 block">Zamówienie</label>
                <input value={form.orderNumber} onChange={e => set('orderNumber', e.target.value)} placeholder="OBJ-1234" className={inputCls} />
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-600 rounded-lg px-4 py-3">
                {error.split('\n').map((line, i) => (
                  <div key={i} className="text-red-400 text-sm">{line}</div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-navy-700">
              <button onClick={onClose} className="bg-navy-600 hover:bg-navy-500 text-theme-secondary px-5 py-2.5 rounded-xl text-sm font-semibold">
                Anuluj
              </button>
              <button
                onClick={handleSubmit}
                disabled={generating}
                className="bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {generating ? 'Generuję...' : 'Generuj etykietę'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
