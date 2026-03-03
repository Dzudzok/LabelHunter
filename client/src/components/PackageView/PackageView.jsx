import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePackageStore } from '../../store/packageStore'
import { useAuthStore } from '../../store/authStore'
import { useScanner } from '../../hooks/useScanner'
import { classifyBarcode } from '../../utils/barcode'
import { api } from '../../services/api'
import ItemList from './ItemList'
import BarcodeAction from '../BarcodeAction/BarcodeAction'

export default function PackageView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { updateItemScan, skipAllItems, generateLabel } = usePackageStore()
  const worker = useAuthStore(s => s.worker)

  const [pkg, setPkg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [labelData, setLabelData] = useState(null)
  const [labelError, setLabelError] = useState(null)
  const [overrideShipper, setOverrideShipper] = useState('')
  const [overrideService, setOverrideService] = useState('')
  const [shippers, setShippers] = useState([])
  const scanInputRef = useRef(null)

  // Fetch package data
  const fetchPackage = useCallback(async () => {
    try {
      const res = await api.get(`/packages/${id}`)
      setPkg(res.data)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchPackage()
  }, [fetchPackage])

  // Fetch shippers from LP API
  useEffect(() => {
    api.get('/labelprinter/shippers')
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.data || [])
        setShippers(data)
      })
      .catch(err => console.error('Failed to fetch shippers:', err))
  }, [])

  // Check if all goods items are verified
  const goodsItems = pkg?.items?.filter(i => i.item_type === 'goods') || []
  const allVerified = goodsItems.length === 0 || goodsItems.every(
    i => (parseFloat(i.scanned_qty) || 0) >= (parseFloat(i.qty) || 1) || i.scan_skipped || i.scan_verified
  )

  // Handle barcode scan
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

  // Skip single item
  const handleSkipItem = async (itemId) => {
    try {
      const res = await api.put(`/packages/${pkg.id}/skip-item`, { itemId })
      setPkg(res.data)
    } catch (err) {
      console.error('Skip error:', err)
    }
  }

  // Skip all items
  const handleSkipAll = async () => {
    try {
      await skipAllItems(pkg.id)
      fetchPackage()
    } catch (err) {
      console.error('Skip all error:', err)
    }
  }

  // Generate label
  const handleGenerateLabel = async () => {
    if (generating) return
    setGenerating(true)
    setLabelError(null)
    try {
      const result = await generateLabel(
        pkg.id,
        overrideShipper || null,
        overrideService || null,
        worker?.id || null
      )
      setLabelData(result)
      fetchPackage()
    } catch (err) {
      const errData = err.response?.data
      if (errData?.details) {
        setLabelError(JSON.stringify(errData.details, null, 2))
      } else if (errData?.error) {
        setLabelError(errData.error)
      } else {
        setLabelError(err.message)
      }
      console.error('Label generation error:', err)
    } finally {
      setGenerating(false)
    }
  }

  const selectedShipperObj = shippers.find(s => s.code === overrideShipper)

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-800 flex items-center justify-center">
        <div className="text-2xl text-gray-400">Nacitani baliku...</div>
      </div>
    )
  }

  if (!pkg) {
    return (
      <div className="min-h-screen bg-navy-800 flex flex-col items-center justify-center gap-4">
        <div className="text-2xl text-gray-400">Balik nenalezen</div>
        <button
          onClick={() => navigate('/')}
          className="bg-brand-orange text-white px-6 py-3 rounded-xl text-lg font-bold"
        >
          Zpet na Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-800">
      {/* Top bar */}
      <div className="bg-navy-900 border-b border-navy-700 px-6 py-4">
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-white text-xl min-h-0"
        >
          &larr; Dashboard
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT SIDE - 60% */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            {/* Customer info */}
            <div className="bg-navy-700 rounded-xl p-6 border border-navy-600">
              <h2 className="text-2xl font-bold text-white mb-4">Zakaznik</h2>
              <div className="space-y-2 text-lg">
                <div className="text-white font-semibold text-xl">
                  {pkg.customer_name}
                </div>
                {(pkg.delivery_street || pkg.customer_street) && (
                  <div className="text-gray-400">{pkg.delivery_street || pkg.customer_street}</div>
                )}
                <div className="text-gray-400">
                  {[pkg.delivery_city || pkg.customer_city, pkg.delivery_postal_code || pkg.customer_postal_code, pkg.delivery_country || pkg.customer_country].filter(Boolean).join(', ')}
                </div>
                {(pkg.delivery_phone || pkg.customer_phone) && (
                  <a
                    href={`tel:${pkg.delivery_phone || pkg.customer_phone}`}
                    className="text-brand-orange hover:underline block"
                  >
                    Tel: {pkg.delivery_phone || pkg.customer_phone}
                  </a>
                )}
                {(pkg.delivery_email || pkg.customer_email) && (
                  <div className="text-gray-400">{pkg.delivery_email || pkg.customer_email}</div>
                )}
              </div>
            </div>

            {/* Package info */}
            <div className="bg-navy-700 rounded-xl p-6 border border-navy-600">
              <h2 className="text-2xl font-bold text-white mb-4">Detail baliku</h2>
              <div className="grid grid-cols-2 gap-4 text-lg">
                <div>
                  <span className="text-gray-500">Faktura:</span>
                  <div className="text-white font-bold text-xl">{pkg.invoice_number}</div>
                </div>
                <div>
                  <span className="text-gray-500">Objednavka:</span>
                  <div className="text-white font-semibold">{pkg.order_number || '-'}</div>
                </div>
                <div>
                  <span className="text-gray-500">Prepravce:</span>
                  <div className="text-white font-semibold">{pkg.transport_name || '-'}</div>
                </div>
                <div>
                  <span className="text-gray-500">Castka:</span>
                  <div className="text-white font-semibold">
                    {pkg.amount_brutto ? `${pkg.amount_brutto} ${pkg.currency || 'CZK'}` : '-'}
                  </div>
                </div>
                {pkg.doc_number && (
                  <div>
                    <span className="text-gray-500">Doklad:</span>
                    <div className="text-white font-semibold">{pkg.doc_number}</div>
                  </div>
                )}
                {pkg.cod_amount && (
                  <div>
                    <span className="text-gray-500">Dobirka:</span>
                    <div className="text-brand-orange font-bold">
                      {pkg.cod_amount} {pkg.cod_currency || 'CZK'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT SIDE - 40% */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Scan section header */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                Produkty k naskenovani
              </h2>
              <span className="text-gray-400 text-lg">
                {goodsItems.filter(i => (parseFloat(i.scanned_qty) || 0) >= (parseFloat(i.qty) || 1) || i.scan_skipped || i.scan_verified).length}
                /{goodsItems.length}
              </span>
            </div>

            {/* Item list */}
            <ItemList
              items={pkg.items || []}
              onSkipItem={handleSkipItem}
              onScanItem={handleScan}
            />

            {/* Scan input */}
            <input
              ref={scanInputRef}
              type="text"
              placeholder="Naskenuj produkt..."
              className="w-full bg-navy-900 border-2 border-navy-600 focus:border-brand-orange rounded-xl px-4 py-4 text-xl text-white placeholder-gray-600 outline-none"
              style={{ minHeight: '64px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  handleScan(e.target.value.trim())
                  e.target.value = ''
                }
              }}
            />

            {/* Shipper override selector */}
            {!labelData && (
              <div className="bg-navy-700 rounded-xl p-4 border border-navy-600">
                <div className="text-sm text-gray-400 mb-2">
                  Přepravce{' '}
                  <span className="text-gray-500">(Nextis: {pkg.transport_name || '—'})</span>
                </div>
                <div className="flex gap-2">
                  <select
                    value={overrideShipper}
                    onChange={(e) => {
                      setOverrideShipper(e.target.value)
                      setOverrideService('')
                      setLabelError(null)
                    }}
                    className="flex-1 bg-navy-900 border border-navy-500 text-white rounded-lg px-3 py-3 text-base outline-none focus:border-brand-orange"
                  >
                    <option value="">Auto (z Nextis)</option>
                    {shippers.map(s => (
                      <option key={s.code} value={s.code}>{s.name || s.code}</option>
                    ))}
                  </select>

                  {overrideShipper && selectedShipperObj?.services?.length > 0 && (
                    <select
                      value={overrideService}
                      onChange={(e) => setOverrideService(e.target.value)}
                      className="flex-1 bg-navy-900 border border-navy-500 text-white rounded-lg px-3 py-3 text-base outline-none focus:border-brand-orange"
                    >
                      <option value="">— Vyberte službu —</option>
                      {selectedShipperObj.services.map(svc => (
                        <option key={svc.code} value={svc.code}>
                          {svc.name ? `${svc.code} — ${svc.name}` : svc.code}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {overrideShipper && !overrideService && selectedShipperObj?.services?.length > 0 && (
                  <div className="text-yellow-400 text-sm mt-2">Vyberte službu přepravce</div>
                )}
              </div>
            )}

            {/* Label generation error */}
            {labelError && (
              <div className="bg-red-900/40 border border-red-600 rounded-xl p-4">
                <div className="text-red-400 font-bold text-base mb-1">Chyba generování etikety (LP API):</div>
                <pre className="text-red-300 text-xs whitespace-pre-wrap break-all">{labelError}</pre>
              </div>
            )}

            {/* Skip all button */}
            {!allVerified && (
              <button
                onClick={handleSkipAll}
                className="w-full bg-navy-600 hover:bg-navy-500 text-gray-300 hover:text-white py-4 rounded-xl text-lg font-semibold transition-colors"
              >
                Preskocit vse
              </button>
            )}

            {/* Generate label button */}
            {allVerified && !labelData && (
              <button
                onClick={handleGenerateLabel}
                disabled={generating || (overrideShipper && !overrideService && selectedShipperObj?.services?.length > 0)}
                className="w-full bg-green-600 hover:bg-green-500 text-white py-6 rounded-xl text-2xl font-black transition-colors disabled:opacity-50"
                style={{ minHeight: '80px' }}
              >
                {generating ? 'Generuji...' : overrideShipper
                  ? `GENERUJ (${overrideShipper}${overrideService ? '/' + overrideService : ''})`
                  : 'GENERUJ ETIKETU'}
              </button>
            )}

            {/* Label generated - show barcode */}
            {labelData && (
              <div className="mt-4">
                <BarcodeAction
                  value={labelData.barcode || labelData.tracking_number || ''}
                  label="Etiketa vygenerovana"
                  onConfirm={() => navigate('/')}
                />
                {labelData.label_url && (
                  <a
                    href={`/api/packages/${pkg.id}/download-label`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-brand-orange hover:bg-brand-orange-dark text-white py-4 rounded-xl text-xl font-bold text-center mt-4 transition-colors"
                  >
                    Stahnout etiketu (PDF)
                  </a>
                )}
              </div>
            )}

            {/* Action barcode for confirming label generation */}
            {allVerified && !labelData && (
              <BarcodeAction
                value="ACTION:GENERATE_LABEL"
                label="Naskenuj pro generovani etikety"
                onConfirm={handleGenerateLabel}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
