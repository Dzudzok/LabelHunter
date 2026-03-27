import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../services/api'
import { useAuthStore } from '../../../store/authStore'

export default function ReturnAdminCreate() {
  const navigate = useNavigate()
  const worker = useAuthStore(s => s.worker)

  const [docNumber, setDocNumber] = useState('')
  const [verifiedNote, setVerifiedNote] = useState(null)
  const [items, setItems] = useState([])
  const [selectedItems, setSelectedItems] = useState([])
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  const [type, setType] = useState('return')
  const [reasonCode, setReasonCode] = useState('')
  const [reasonDetail, setReasonDetail] = useState('')
  const [vehicleInfo, setVehicleInfo] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [reasons, setReasons] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.get('/retino/public/returns/reasons').then(res => setReasons(res.data)).catch(() => {})
  }, [])

  const handleVerify = async () => {
    if (!docNumber.trim()) return
    setVerifying(true)
    setVerifyError('')
    try {
      // Search by invoice/doc number in packages
      const res = await api.get('/packages/search', { params: { query: docNumber.trim(), limit: 1 } })
      const pkg = res.data?.[0]
      if (!pkg) { setVerifyError('Objednávka nenalezena'); return }

      setVerifiedNote(pkg)
      setCustomerName(pkg.customer_name || '')
      setCustomerEmail(pkg.customer_email || '')
      setCustomerPhone(pkg.customer_phone || '')

      // Fetch items
      const detailRes = await api.get(`/packages/${pkg.id}`)
      const goodsItems = (detailRes.data?.items || []).filter(i => i.item_type === 'goods')
      setItems(goodsItems)
    } catch {
      setVerifyError('Chyba při vyhledávání')
    } finally {
      setVerifying(false)
    }
  }

  const toggleItem = (item) => {
    setSelectedItems(prev => {
      const exists = prev.find(s => s.id === item.id)
      if (exists) return prev.filter(s => s.id !== item.id)
      return [...prev, { ...item, qtyReturned: item.qty }]
    })
  }

  const handleSubmit = async () => {
    if (!verifiedNote || selectedItems.length === 0 || !reasonCode) return
    setSubmitting(true)
    try {
      const res = await api.post('/retino/returns/admin-create', {
        deliveryNoteId: verifiedNote.id,
        type,
        reasonCode,
        reasonDetail: reasonDetail || null,
        vehicleInfo: vehicleInfo || null,
        customerName,
        customerEmail,
        customerPhone: customerPhone || null,
        workerId: worker?.id,
        items: selectedItems.map(item => ({
          deliveryNoteItemId: item.id,
          qtyReturned: item.qtyReturned,
        })),
      })
      navigate(`/retino/returns/${res.data.id}`)
    } catch (err) {
      alert(err.response?.data?.error || 'Chyba')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredReasons = reasons.filter(r => r.applies_to?.includes(type))

  return (
    <div className="bg-navy-900 text-theme-primary p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/retino/returns')} className="text-theme-muted hover:text-theme-primary text-sm">
          &larr; Zpět
        </button>
        <h1 className="text-2xl font-bold">Nová žádost (admin)</h1>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Verify order */}
        <div className="bg-navy-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase">1. Vyhledat objednávku</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              placeholder="Číslo faktury / dokladu"
              className="flex-1 bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary"
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            />
            <button onClick={handleVerify} disabled={verifying}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40">
              {verifying ? '...' : 'Najít'}
            </button>
          </div>
          {verifyError && <div className="text-red-400 text-sm mt-2">{verifyError}</div>}
          {verifiedNote && (
            <div className="mt-3 text-sm text-theme-muted">
              Nalezeno: {verifiedNote.doc_number} — {verifiedNote.customer_name} ({verifiedNote.customer_email})
            </div>
          )}
        </div>

        {/* Products */}
        {items.length > 0 && (
          <div className="bg-navy-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase">2. Vyberte produkty</h3>
            <div className="space-y-1">
              {items.map(item => {
                const isSelected = selectedItems.some(s => s.id === item.id)
                return (
                  <div key={item.id}
                    className={`flex items-center gap-3 p-2 rounded cursor-pointer ${isSelected ? 'bg-blue-900/30' : 'hover:bg-navy-700'}`}
                    onClick={() => toggleItem(item)}>
                    <div className={`w-4 h-4 rounded border ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-navy-500'} flex items-center justify-center`}>
                      {isSelected && <span className="text-white text-[10px]">✓</span>}
                    </div>
                    <span className="text-sm flex-1">{item.text} {item.brand && `(${item.brand})`}</span>
                    <span className="text-xs text-theme-muted">{item.qty}x</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Details */}
        {verifiedNote && (
          <div className="bg-navy-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase">3. Detaily</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-theme-muted">Typ</label>
                <select value={type} onChange={(e) => { setType(e.target.value); setReasonCode('') }}
                  className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary mt-1">
                  <option value="return">Vrácení</option>
                  <option value="complaint">Reklamace</option>
                  <option value="warranty">Záruka</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-theme-muted">Důvod</label>
                <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary mt-1">
                  <option value="">Vyberte...</option>
                  {filteredReasons.map(r => <option key={r.code} value={r.code}>{r.label_cs}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs text-theme-muted">Popis</label>
              <textarea value={reasonDetail} onChange={(e) => setReasonDetail(e.target.value)} rows={2}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary mt-1 resize-none" />
            </div>
            <div className="mt-3">
              <label className="text-xs text-theme-muted">Vozidlo</label>
              <input type="text" value={vehicleInfo} onChange={(e) => setVehicleInfo(e.target.value)}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary mt-1" />
            </div>
          </div>
        )}

        {/* Submit */}
        {verifiedNote && (
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedItems.length === 0 || !reasonCode}
            className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold disabled:opacity-40"
          >
            {submitting ? 'Vytvářím...' : 'Vytvořit žádost'}
          </button>
        )}
      </div>
    </div>
  )
}
