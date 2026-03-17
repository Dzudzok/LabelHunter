import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePackageStore } from '../../store/packageStore'
import { useAuthStore } from '../../store/authStore'
import { useScanner } from '../../hooks/useScanner'
import { classifyBarcode } from '../../utils/barcode'
import { api } from '../../services/api'
import ItemList from './ItemList'
import HunterPanel from './HunterPanel'
import { usePrinter } from '../../hooks/usePrinter'

export default function PackageView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { updateItemScan, skipAllItems } = usePackageStore()
  const { printLabel } = usePrinter()
  const worker = useAuthStore(s => s.worker)

  const [pkg, setPkg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [labelData, setLabelData] = useState(null)
  const [labelError, setLabelError] = useState(null)
  const [overrideShipper, setOverrideShipper] = useState('')
  const [overrideService, setOverrideService] = useState('')
  const [shippers, setShippers] = useState([])

  // History state
  const [history, setHistory] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)

  // Address edit state
  const [editingAddress, setEditingAddress] = useState(false)
  const [addressForm, setAddressForm] = useState({})
  const [savingAddress, setSavingAddress] = useState(false)

  // Multi-parcel state: array of { weight }
  const [parcels, setParcels] = useState([])
  const [codAmount, setCodAmount] = useState('')
  const parcelsInitialized = useRef(false)
  const scanInputRef = useRef(null)

  function calcAutoWeight(items) {
    let w = 0
    for (const item of (items || [])) {
      if (item.unit_weight_netto && item.qty) {
        w += parseFloat(item.unit_weight_netto) * parseFloat(item.qty)
      }
    }
    return Math.max(Math.round(w * 100) / 100, 0.5)
  }

  const fetchPackage = useCallback(async () => {
    try {
      const res = await api.get(`/packages/${id}`)
      const data = res.data
      setPkg(data)
      setLoading(false)
      // Init parcels only once
      if (!parcelsInitialized.current) {
        parcelsInitialized.current = true
        const autoW = data.weight ? parseFloat(data.weight) : calcAutoWeight(data.items || [])
        setParcels([{ weight: autoW || 0.5 }])
        setCodAmount(data.cod_amount ? String(data.cod_amount) : '0')
      }
    } catch {
      setLoading(false)
    }
  }, [id])

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await api.get(`/packages/${id}/history`)
      setHistory(res.data)
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchPackage()
    fetchHistory()
  }, [fetchPackage, fetchHistory])

  useEffect(() => {
    api.get('/labelprinter/shippers')
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.data || [])
        setShippers(data)
      })
      .catch(err => console.error('Failed to fetch shippers:', err))
  }, [])

  const goodsItems = pkg?.items?.filter(i => i.item_type === 'goods') || []
  const allVerified = goodsItems.length === 0 || goodsItems.every(
    i => (parseFloat(i.scanned_qty) || 0) >= (parseFloat(i.qty) || 1) || i.scan_skipped || i.scan_verified
  )

  const handleScan = useCallback(async (code) => {
    if (!pkg) return
    const classified = classifyBarcode(code)

    if (classified.type === 'action' && classified.action === 'GENERATE_LABEL') {
      handleGenerateLabel()
      return
    }

    if (classified.type === 'product') {
      const item = goodsItems.find(
        i => i.code === classified.value || i.ean === classified.value
      )
      if (item) {
        try {
          const updated = await updateItemScan(pkg.id, item.id, 1, worker?.id)
          setPkg(updated)
        } catch (err) {
          console.error('Scan error:', err)
        }
      }
    }
  }, [pkg, goodsItems, updateItemScan])

  useScanner(handleScan)

  const handleSkipItem = async (itemId) => {
    try {
      const res = await api.put(`/packages/${pkg.id}/skip-item`, { itemId })
      setPkg(res.data)
    } catch (err) {
      console.error('Skip error:', err)
    }
  }

  const handleSkipAll = async () => {
    try {
      await skipAllItems(pkg.id)
      fetchPackage()
    } catch (err) {
      console.error('Skip all error:', err)
    }
  }

  // --- Address edit ---
  const startEditAddress = () => {
    setAddressForm({
      customer_name: pkg.customer_name || '',
      delivery_street: pkg.delivery_street || pkg.customer_street || '',
      delivery_city: pkg.delivery_city || pkg.customer_city || '',
      delivery_postal_code: pkg.delivery_postal_code || pkg.customer_postal_code || '',
      delivery_country: pkg.delivery_country || pkg.customer_country || 'CZ',
      delivery_phone: pkg.delivery_phone || pkg.customer_phone || '',
      delivery_email: pkg.delivery_email || pkg.customer_email || '',
    })
    setEditingAddress(true)
  }

  const handleSaveAddress = async () => {
    setSavingAddress(true)
    try {
      const res = await api.put(`/packages/${pkg.id}/address`, addressForm)
      setPkg(prev => ({ ...prev, ...res.data }))
      setEditingAddress(false)
    } catch (err) {
      console.error('Address save error:', err)
    } finally {
      setSavingAddress(false)
    }
  }

  // --- Multi-parcel ---
  const addParcel = () => {
    const autoW = calcAutoWeight(pkg?.items || [])
    const count = parcels.length + 1
    const splitW = Math.round((autoW / count) * 100) / 100
    setParcels(Array(count).fill(null).map(() => ({ weight: splitW })))
  }

  const removeParcel = (idx) => {
    if (parcels.length <= 1) return
    setParcels(prev => prev.filter((_, i) => i !== idx))
  }

  const updateParcelWeight = (idx, val) => {
    setParcels(prev => prev.map((p, i) => i === idx ? { ...p, weight: val } : p))
  }

  // --- Generate label ---
  const handleGenerateLabel = async () => {
    if (generating) return
    setGenerating(true)
    setLabelError(null)
    try {
      const parcelsPayload = parcels.map(p => ({ weight: Math.max(parseFloat(p.weight) || 0.5, 0.1) }))
      const res = await api.post(`/packages/${pkg.id}/generate-label`, {
        shipperCode: overrideShipper || null,
        serviceCode: overrideService || null,
        workerId: worker?.id || null,
        parcels: parcelsPayload,
        codAmount: parseFloat(codAmount) || 0,
      })
      setLabelData(res.data)
      fetchPackage()
      if (res.data.label_url) {
        await printLabel(pkg.id)
      }
      // Auto-redirect to dashboard after successful print
      setTimeout(() => navigate('/'), 1000)
    } catch (err) {
      const errData = err.response?.data
      const apiErrors = errData?.details?.errors
      if (apiErrors && apiErrors.length > 0) {
        setLabelError(apiErrors.map(e => e.message).join('\n'))
      } else if (errData?.error) {
        setLabelError(errData.error)
      } else {
        setLabelError(err.message)
      }
    } finally {
      setGenerating(false)
    }
  }

  const selectedShipperObj = shippers.find(s => s.code === overrideShipper)
  const totalWeight = parcels.reduce((s, p) => s + (parseFloat(p.weight) || 0), 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-800 flex items-center justify-center">
        <div className="text-2xl text-theme-secondary">Ładowanie paczki...</div>
      </div>
    )
  }

  if (!pkg) {
    return (
      <div className="min-h-screen bg-navy-800 flex flex-col items-center justify-center gap-4">
        <div className="text-2xl text-theme-secondary">Paczka nie znaleziona</div>
        <button onClick={() => navigate('/')} className="bg-brand-orange text-white px-6 py-3 rounded-xl text-lg font-bold">
          Wróć na Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen bg-navy-800 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="bg-navy-900 border-b border-navy-700 px-4 py-2 shrink-0">
        <button onClick={() => navigate('/')} className="text-theme-secondary hover:text-theme-primary text-lg min-h-0">
          &larr; Dashboard
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex gap-4 px-5 py-4">

          {/* LEFT SIDE - 50% */}
          <div className="w-1/2 shrink-0 flex flex-col gap-4 pr-1">

            {/* Customer info / Address edit */}
            <div className="bg-navy-700 rounded-xl p-5 border border-navy-600">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-theme-primary">Klient</h2>
                {!labelData && !editingAddress && (
                  <button
                    onClick={startEditAddress}
                    className="bg-navy-600 hover:bg-navy-500 text-theme-secondary hover:text-theme-primary px-4 py-2 rounded-lg text-base transition-colors"
                  >
                    Edytuj adres
                  </button>
                )}
              </div>

              {editingAddress ? (
                <div className="space-y-3">
                  <input
                    value={addressForm.customer_name}
                    onChange={e => setAddressForm(p => ({ ...p, customer_name: e.target.value }))}
                    placeholder="Nazwa / firma"
                    className="w-full bg-navy-900 border border-navy-500 text-theme-primary rounded-lg px-3 py-2 text-base outline-none focus:border-brand-orange"
                  />
                  <input
                    value={addressForm.delivery_street}
                    onChange={e => setAddressForm(p => ({ ...p, delivery_street: e.target.value }))}
                    placeholder="Ulica"
                    className="w-full bg-navy-900 border border-navy-500 text-theme-primary rounded-lg px-3 py-2 text-base outline-none focus:border-brand-orange"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      value={addressForm.delivery_city}
                      onChange={e => setAddressForm(p => ({ ...p, delivery_city: e.target.value }))}
                      placeholder="Miasto"
                      className="col-span-2 bg-navy-900 border border-navy-500 text-theme-primary rounded-lg px-3 py-2 text-base outline-none focus:border-brand-orange"
                    />
                    <input
                      value={addressForm.delivery_postal_code}
                      onChange={e => setAddressForm(p => ({ ...p, delivery_postal_code: e.target.value }))}
                      placeholder="Kod pocztowy"
                      className="bg-navy-900 border border-navy-500 text-theme-primary rounded-lg px-3 py-2 text-base outline-none focus:border-brand-orange"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={addressForm.delivery_phone}
                      onChange={e => setAddressForm(p => ({ ...p, delivery_phone: e.target.value }))}
                      placeholder="Telefon"
                      className="bg-navy-900 border border-navy-500 text-theme-primary rounded-lg px-3 py-2 text-base outline-none focus:border-brand-orange"
                    />
                    <input
                      value={addressForm.delivery_email}
                      onChange={e => setAddressForm(p => ({ ...p, delivery_email: e.target.value }))}
                      placeholder="Email"
                      className="bg-navy-900 border border-navy-500 text-theme-primary rounded-lg px-3 py-2 text-base outline-none focus:border-brand-orange"
                    />
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={handleSaveAddress}
                      disabled={savingAddress}
                      className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg text-base font-bold transition-colors disabled:opacity-50"
                    >
                      {savingAddress ? 'Zapisuję...' : 'Zapisz adres'}
                    </button>
                    <button
                      onClick={() => setEditingAddress(false)}
                      className="px-5 bg-navy-600 hover:bg-navy-500 text-theme-secondary py-3 rounded-lg text-base transition-colors"
                    >
                      Anuluj
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-theme-primary font-semibold text-lg">{pkg.customer_name}</div>
                  {(pkg.delivery_street || pkg.customer_street) && (
                    <div className="text-theme-secondary text-base">{pkg.delivery_street || pkg.customer_street}</div>
                  )}
                  <div className="text-theme-secondary text-base">
                    {[pkg.delivery_city || pkg.customer_city, pkg.delivery_postal_code || pkg.customer_postal_code, pkg.delivery_country || pkg.customer_country].filter(Boolean).join(', ')}
                  </div>
                  <div className="flex gap-6 pt-1">
                    {(pkg.delivery_phone || pkg.customer_phone) && (
                      <a href={`tel:${pkg.delivery_phone || pkg.customer_phone}`} className="text-brand-orange hover:underline text-base font-semibold">
                        {pkg.delivery_phone || pkg.customer_phone}
                      </a>
                    )}
                    {(pkg.delivery_email || pkg.customer_email) && (
                      <span className="text-theme-muted text-base">{pkg.delivery_email || pkg.customer_email}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Package info + Parcels — side by side */}
            <div className="flex gap-4">
              <div className="flex-1 bg-navy-700 rounded-xl p-5 border border-navy-600">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-base">
                  <div>
                    <span className="text-theme-muted text-sm">Faktura:</span>
                    <div className="text-theme-primary font-bold text-xl">{pkg.invoice_number}</div>
                  </div>
                  <div>
                    <span className="text-theme-muted text-sm">Zamówienie:</span>
                    <div className="text-theme-primary font-semibold">{pkg.order_number || '-'}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-theme-muted text-sm">Przewoźnik:</span>
                    <div className="text-theme-primary font-semibold">
                      {pkg.shipper_code ? `${pkg.shipper_code} | ${pkg.transport_name || pkg.shipper_service || ''}` : pkg.transport_name || '-'}
                    </div>
                  </div>
                  <div>
                    <span className="text-theme-muted text-sm">Cena przesyłki:</span>
                    <div className="text-theme-primary font-semibold">
                      {pkg.amount_brutto ? `${pkg.amount_brutto} ${pkg.currency || 'CZK'}` : '-'}
                    </div>
                  </div>
                  <div>
                    <span className="text-theme-muted text-sm">Waga:</span>
                    <div className="text-theme-primary font-semibold">
                      {pkg.weight ? `${pkg.weight} kg` : '-'}
                    </div>
                  </div>
                  <div>
                    <span className="text-theme-muted text-sm">Pobranie:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={codAmount}
                        onChange={e => setCodAmount(e.target.value)}
                        disabled={!!labelData}
                        className="w-32 bg-navy-900 border border-navy-500 text-theme-primary rounded-lg px-3 py-1.5 text-base outline-none focus:border-brand-orange disabled:opacity-50"
                      />
                      <span className="text-theme-secondary text-sm">{pkg.currency || 'CZK'}</span>
                      {parseFloat(codAmount) > 0 && <span className="text-orange-400 text-sm font-semibold">DOB</span>}
                    </div>
                  </div>
                  {pkg.doc_number && (
                    <div>
                      <span className="text-theme-muted text-sm">Dokument:</span>
                      <div className="text-theme-primary font-semibold">{pkg.doc_number}</div>
                    </div>
                  )}
                </div>
              </div>

              {!labelData && (
                <div className="w-[280px] shrink-0 bg-navy-700 rounded-xl p-5 border border-navy-600 flex flex-col">
                  <div className="text-lg font-bold text-theme-primary mb-2">
                    Paczki ({parcels.length} szt.) — {totalWeight.toFixed(2)} kg
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    {parcels.map((parcel, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-theme-secondary text-base">#{idx + 1}</span>
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={parcel.weight}
                          onChange={e => updateParcelWeight(idx, e.target.value)}
                          className="w-24 bg-navy-900 border border-navy-500 text-theme-primary rounded-lg px-3 py-2 text-base outline-none focus:border-brand-orange"
                        />
                        <span className="text-theme-secondary text-sm">kg</span>
                        {parcels.length > 1 && (
                          <button
                            onClick={() => removeParcel(idx)}
                            className="text-red-400 hover:text-red-300 text-xl leading-none px-1"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addParcel}
                    className="bg-brand-orange hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-base font-bold transition-colors mt-2"
                  >
                    + Dodaj paczkę
                  </button>
                </div>
              )}
            </div>

            {/* Hunter — fills remaining height */}
            <div className="flex-1 pt-2 flex flex-col min-h-0">
              <HunterPanel
                packageId={parseInt(id)}
                workerId={worker?.id}
                itemsCount={goodsItems.length}
              />
            </div>
          </div>

          {/* RIGHT SIDE - 50% */}
          <div className="flex-1 flex flex-col gap-3 overflow-y-auto pl-1">

            <input
              ref={scanInputRef}
              type="text"
              placeholder="Skanuj produkt..."
              className="w-full bg-navy-900 border-2 border-navy-600 focus:border-brand-orange rounded-xl px-4 py-3 text-xl text-theme-primary placeholder-theme-muted outline-none shrink-0"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  handleScan(e.target.value.trim())
                  e.target.value = ''
                }
              }}
            />

            {/* Shipper override */}
            {!labelData && (
              <div className="bg-navy-700 rounded-xl p-4 border border-navy-600 shrink-0">
                <div className="text-sm text-theme-secondary mb-2">
                  Przewoźnik <span className="text-theme-muted">(LP: {pkg.shipper_code ? `${pkg.shipper_code}${pkg.shipper_service ? '/' + pkg.shipper_service : ''}` : pkg.transport_name || '—'})</span>
                </div>
                <div className="flex gap-2">
                  <select
                    value={overrideShipper}
                    onChange={(e) => { setOverrideShipper(e.target.value); setOverrideService(''); setLabelError(null) }}
                    className="flex-1 bg-navy-900 border border-navy-500 text-theme-primary rounded-lg px-3 py-3 text-base outline-none focus:border-brand-orange"
                  >
                    <option value="">Auto (z LP)</option>
                    {shippers.map(s => (
                      <option key={s.code} value={s.code}>{s.name || s.code}</option>
                    ))}
                  </select>
                  {overrideShipper && selectedShipperObj?.services?.length > 0 && (
                    <select
                      value={overrideService}
                      onChange={(e) => setOverrideService(e.target.value)}
                      className="flex-1 bg-navy-900 border border-navy-500 text-theme-primary rounded-lg px-3 py-3 text-base outline-none focus:border-brand-orange"
                    >
                      <option value="">— Wybierz usługę —</option>
                      {selectedShipperObj.services.map(svc => (
                        <option key={svc.code} value={svc.code}>
                          {svc.name ? `${svc.code} — ${svc.name}` : svc.code}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {overrideShipper && !overrideService && selectedShipperObj?.services?.length > 0 && (
                  <div className="text-yellow-400 text-sm mt-2">Wybierz usługę przewoźnika</div>
                )}
              </div>
            )}

            {!allVerified && (
              <button
                onClick={handleSkipAll}
                className="w-full bg-navy-600 hover:bg-navy-500 text-theme-secondary hover:text-theme-primary py-4 rounded-xl text-lg font-semibold transition-colors shrink-0"
              >
                Pomiń wszystko
              </button>
            )}

            {labelError && (
              <div className="bg-red-900/40 border border-red-600 rounded-xl p-4 shrink-0">
                <div className="text-red-400 font-bold text-base mb-1">Błąd generowania etykiety (LP API):</div>
                <pre className="text-red-300 text-xs whitespace-pre-wrap break-all">{labelError}</pre>
              </div>
            )}

            {allVerified && !labelData && (
              <button
                onClick={handleGenerateLabel}
                disabled={generating || (overrideShipper && !overrideService && selectedShipperObj?.services?.length > 0)}
                className="w-full bg-green-600 hover:bg-green-500 text-white py-5 rounded-xl text-2xl font-black transition-colors disabled:opacity-50 shrink-0"
              >
                {generating ? 'Generuję...' : overrideShipper
                  ? `GENERUJ (${overrideShipper}${overrideService ? '/' + overrideService : ''})`
                  : `GENERUJ ETYKIETĘ${parcels.length > 1 ? ` (${parcels.length} paczki)` : ''}`}
              </button>
            )}

            {labelData && (
              <div className="mt-4 shrink-0 space-y-3">
                <div className="bg-green-900/40 border border-green-600 rounded-xl p-4 text-center">
                  <div className="text-green-400 font-bold text-lg">Etykieta wygenerowana</div>
                  <div className="text-green-300 text-sm mt-1">{labelData.tracking_number || labelData.barcode || ''}</div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => printLabel(pkg.id)}
                    className="flex-1 bg-brand-orange hover:bg-orange-600 text-white py-4 rounded-xl text-xl font-bold text-center transition-colors"
                  >
                    Drukuj ponownie
                  </button>
                  <a
                    href={`${import.meta.env.VITE_API_URL || '/api'}/packages/${pkg.id}/download-label`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 bg-navy-600 hover:bg-navy-500 text-theme-secondary py-4 rounded-xl text-xl font-bold text-center transition-colors"
                  >
                    PDF
                  </a>
                </div>
                <button
                  onClick={() => navigate('/')}
                  className="w-full bg-navy-700 hover:bg-navy-600 text-theme-secondary py-3 rounded-xl text-base font-semibold transition-colors"
                >
                  Wróć na Dashboard
                </button>
              </div>
            )}

            {/* Products list — at the bottom */}
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold text-theme-primary">Produkty do skanowania</h2>
              <span className="text-theme-secondary text-lg font-bold">
                {goodsItems.filter(i => (parseFloat(i.scanned_qty) || 0) >= (parseFloat(i.qty) || 1) || i.scan_skipped || i.scan_verified).length}
                /{goodsItems.length}
              </span>
            </div>

            <ItemList items={pkg.items || []} onSkipItem={handleSkipItem} onScanItem={handleScan} />
          </div>
      </div>

      {/* History — fixed bottom bar, expandable */}
      <div className="shrink-0 border-t border-navy-700 bg-navy-900">
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          className="w-full flex items-center gap-2 px-4 py-2 text-theme-muted hover:text-theme-secondary text-sm font-semibold transition-colors"
        >
          <span>{historyOpen ? '▼' : '▶'}</span>
          Historie ({history.length})
        </button>

        {historyOpen && (
          <div className="max-h-40 overflow-y-auto border-t border-navy-700">
            {historyLoading ? (
              <div className="text-center py-3 text-theme-muted text-sm">Načítám...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-3 text-theme-muted text-sm">Žádná historie</div>
            ) : (
              <div className="divide-y divide-navy-600/50">
                {history.map(h => (
                  <HistoryRow key={h.id} entry={h} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const ACTION_LABELS = {
  scan_item: 'Naskenován produkt',
  skip_item: 'Produkt přeskočen',
  skip_all: 'Vše přeskočeno',
  generate_label: 'Etiketa vygenerována',
  cancel_label: 'Etiketa zrušena',
  status_change: 'Změna statusu',
  address_update: 'Adresa upravena',
  import: 'Import z Nextis',
}

const ACTION_COLORS = {
  scan_item: 'text-blue-400',
  skip_item: 'text-yellow-400',
  skip_all: 'text-yellow-400',
  generate_label: 'text-green-400',
  cancel_label: 'text-red-400',
  status_change: 'text-purple-400',
  address_update: 'text-orange-400',
  import: 'text-gray-400',
}

function HistoryRow({ entry }) {
  const time = new Date(entry.created_at)
  const dateStr = time.toLocaleDateString('cs-CZ')
  const timeStr = time.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const details = entry.details || {}

  let detail = ''
  if (entry.action === 'scan_item' && details.item_code) {
    detail = `${details.item_code} (qty: ${details.scanned_qty})`
  } else if (entry.action === 'status_change') {
    detail = `${details.old_status || '?'} → ${details.new_status || '?'}`
  } else if (entry.action === 'generate_label' && details.tracking_number) {
    detail = `${details.shipper_code} / ${details.tracking_number}`
  } else if (entry.action === 'address_update' && details.customer_name) {
    detail = `${details.customer_name}, ${details.delivery_city || ''}`
  } else if (entry.action === 'cancel_label') {
    detail = `LP #${details.lp_shipment_id || '?'}`
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 text-sm">
      <div className="text-theme-muted shrink-0 w-28">
        <div>{dateStr}</div>
        <div>{timeStr}</div>
      </div>
      <div className={`font-semibold shrink-0 w-44 ${ACTION_COLORS[entry.action] || 'text-theme-secondary'}`}>
        {ACTION_LABELS[entry.action] || entry.action}
      </div>
      <div className="text-theme-secondary flex-1 truncate">
        {detail}
      </div>
      <div className="text-theme-muted shrink-0 w-32 text-right">
        {entry.worker_name || '—'}
      </div>
    </div>
  )
}
