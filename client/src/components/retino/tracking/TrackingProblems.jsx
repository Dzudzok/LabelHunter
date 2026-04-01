import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../services/api'
import StatusBadge, { TRACKING_COLORS } from '../shared/StatusBadge'

const PROBLEM_STATUSES = 'failed_delivery,returned_to_sender,problem'
const CARRIERS = ['GLS', 'PPL', 'DPD', 'UPS', 'Zasilkovna', 'CP', 'FOFR']

const TABS = [
  { label: 'Brzy se bude vracet', status: 'expiring', type: 'expiring', color: '#F59E0B' },
  { label: 'Nedoručeno', status: 'failed_delivery', type: 'problem', color: '#EF4444' },
  { label: 'Vráceno odesílateli', status: 'returned_to_sender', type: 'problem', color: '#EF4444' },
  { label: 'Depo 4+ dní', status: 'available_for_pickup', type: 'depot', color: '#F97316' },
  { label: 'Problémy dopravce', status: 'problem', type: 'problem', color: '#DC2626' },
  { label: 'Vše', status: PROBLEM_STATUSES, type: 'problem', color: '#64748b' },
]

export default function TrackingProblems() {
  const navigate = useNavigate()
  const [shipments, setShipments] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(PROBLEM_STATUSES)
  const [activeType, setActiveType] = useState('problem')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [shipper, setShipper] = useState('')
  const [expiryDays, setExpiryDays] = useState(3)
  const pageSize = 50

  // Sidebar preview
  const [selectedId, setSelectedId] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewSyncing, setPreviewSyncing] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      if (activeType === 'depot') {
        const res = await api.get('/retino/tracking/depot-stuck', { params: { minDays: 4, page, pageSize } })
        setShipments(res.data.shipments || []); setTotal(res.data.total || 0)
      } else if (activeType === 'expiring') {
        const res = await api.get('/retino/tracking/expiring', { params: { days: expiryDays, page, pageSize } })
        setShipments(res.data.shipments || []); setTotal(res.data.total || 0)
      } else {
        const params = { status: activeTab, page, pageSize, sortBy: 'date_issued', sortDir: 'desc' }
        if (search) params.search = search
        if (shipper) params.shipper = shipper
        const res = await api.get('/retino/tracking/shipments', { params })
        setShipments(res.data.shipments || []); setTotal(res.data.total || 0)
      }
    } catch {} finally { setLoading(false) }
  }, [activeTab, activeType, page, search, shipper, expiryDays])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setPage(1) }, [activeTab, search, shipper, expiryDays])

  // Sidebar preview
  useEffect(() => {
    if (!selectedId) { setPreview(null); return }
    setPreviewLoading(true)
    api.get(`/retino/tracking/shipments/${selectedId}`)
      .then(res => setPreview(res.data))
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false))
  }, [selectedId])

  const handlePreviewSync = async () => {
    if (!selectedId) return
    setPreviewSyncing(true)
    try {
      await api.post(`/retino/tracking/shipments/${selectedId}/sync`)
      const res = await api.get(`/retino/tracking/shipments/${selectedId}`)
      setPreview(res.data)
      fetchData()
    } catch (err) { alert(err.response?.data?.error || 'Chyba') }
    finally { setPreviewSyncing(false) }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Main */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-black text-theme-primary">Problémové zásilky</h1>
          <p className="text-sm text-theme-muted">Proaktivně řešte zásilky s problémy</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-navy-700 overflow-x-auto">
          {TABS.map(tab => {
            const isActive = activeTab === tab.status && activeType === tab.type
            return (
              <button key={tab.status + tab.type}
                onClick={() => { setActiveTab(tab.status); setActiveType(tab.type) }}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive ? 'border-current text-theme-primary' : 'border-transparent text-theme-muted hover:text-theme-primary'
                }`}
                style={isActive ? { color: tab.color, borderColor: tab.color } : {}}>
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Filters */}
        {activeType === 'expiring' ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-theme-muted">Expirace do:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 5, 7].map(d => (
                <button key={d} onClick={() => setExpiryDays(d)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${
                    expiryDays === d ? 'bg-amber-600 text-white' : 'bg-navy-800 text-theme-muted hover:bg-navy-700'
                  }`}>{d}d</button>
              ))}
            </div>
          </div>
        ) : activeType !== 'depot' && (
          <div className="flex items-center gap-2">
            <input type="text" placeholder="Hledat..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-1.5 text-sm text-theme-primary flex-1 max-w-sm focus:border-blue-500 outline-none" />
            <select value={shipper} onChange={e => setShipper(e.target.value)}
              className="bg-navy-800 border border-navy-600 rounded-lg px-2 py-1.5 text-sm text-theme-primary">
              <option value="">Dopravce</option>
              {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Table */}
        <div className="bg-navy-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-600 text-theme-muted text-[11px] uppercase">
                <th className="text-left py-2.5 px-3 font-semibold">Tracking</th>
                <th className="text-left py-2.5 px-3 font-semibold hidden lg:table-cell">Zákazník</th>
                <th className="text-left py-2.5 px-3 font-semibold">Dopravce</th>
                <th className="text-left py-2.5 px-3 font-semibold hidden md:table-cell">Datum</th>
                <th className="text-left py-2.5 px-3 font-semibold">
                  {activeType === 'depot' ? 'Dní na depu' : activeType === 'expiring' ? 'Zbývá' : 'Stav'}
                </th>
                <th className="text-left py-2.5 px-3 font-semibold hidden xl:table-cell">Popis</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-16 text-theme-muted">
                  <svg className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                </td></tr>
              ) : shipments.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16">
                  <div className="text-3xl mb-2">{activeType === 'expiring' ? '✅' : '🔍'}</div>
                  <div className="text-theme-muted text-sm">
                    {activeType === 'expiring' ? 'Žádné zásilky s blížící se expirací' : 'Žádné problémové zásilky'}
                  </div>
                </td></tr>
              ) : shipments.map(s => (
                <tr key={s.id} onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
                  className={`border-b border-navy-700/50 cursor-pointer transition-colors ${
                    selectedId === s.id ? 'bg-blue-600/10 border-l-2 border-l-blue-500' : 'hover:bg-navy-700/30'
                  }`}>
                  <td className="py-2 px-3 font-mono text-xs text-theme-primary">{s.tracking_number || s.doc_number}</td>
                  <td className="py-2 px-3 text-xs text-theme-secondary hidden lg:table-cell truncate max-w-[150px]">{s.customer_name || '—'}</td>
                  <td className="py-2 px-3">
                    <span className="font-mono text-[10px] bg-navy-700 px-1.5 py-0.5 rounded">{s.shipper_code}</span>
                  </td>
                  <td className="py-2 px-3 text-xs text-theme-muted hidden md:table-cell whitespace-nowrap">
                    {s.date_issued ? new Date(s.date_issued).toLocaleDateString('cs-CZ') : '—'}
                  </td>
                  <td className="py-2 px-3">
                    {activeType === 'depot' ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        s.days_at_depot >= 7 ? 'bg-red-900/30 text-red-400' : s.days_at_depot >= 5 ? 'bg-orange-900/30 text-orange-400' : 'bg-yellow-900/30 text-yellow-400'
                      }`}>{s.days_at_depot} dní</span>
                    ) : activeType === 'expiring' ? (
                      <ExpiryBadge daysLeft={s.days_left} />
                    ) : (
                      <StatusBadge status={s.unified_status} />
                    )}
                  </td>
                  <td className="py-2 px-3 text-xs text-theme-muted max-w-[180px] truncate hidden xl:table-cell">
                    {activeType === 'expiring' ? (s.expiry_date ? `Exp: ${new Date(s.expiry_date).toLocaleDateString('cs-CZ')}` : '—') : (s.last_tracking_description || '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-navy-700">
              <span className="text-[11px] text-theme-muted">{(page-1)*pageSize+1}–{Math.min(page*pageSize, total)} z {total}</span>
              <div className="flex gap-1.5">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}
                  className="px-2.5 py-1 text-xs bg-navy-700 border border-navy-600 text-theme-secondary rounded disabled:opacity-40 hover:bg-navy-600">←</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}
                  className="px-2.5 py-1 text-xs bg-navy-700 border border-navy-600 text-theme-secondary rounded disabled:opacity-40 hover:bg-navy-600">→</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Preview */}
      {selectedId && (
        <div className="w-[400px] xl:w-[450px] border-l border-navy-700 overflow-y-auto flex-shrink-0" style={{ backgroundColor: 'var(--navy-800)' }}>
          {previewLoading ? (
            <div className="flex items-center justify-center py-20">
              <svg className="w-6 h-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            </div>
          ) : preview ? (
            <div>
              {/* Header */}
              <div className="sticky top-0 bg-navy-800 border-b border-navy-700 px-4 py-3 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <StatusBadge status={preview.unified_status} />
                  <span className="text-sm font-bold text-theme-primary">{preview.doc_number}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={handlePreviewSync} disabled={previewSyncing}
                    className="text-blue-400 hover:text-blue-300 text-xs font-semibold flex items-center gap-1">
                    <svg className={`w-3 h-3 ${previewSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    Synchronizovat
                  </button>
                  <button onClick={() => navigate(`/retino/tracking/${selectedId}`)} className="text-theme-muted hover:text-theme-primary text-xs font-semibold">Otevřít →</button>
                  <button onClick={() => setSelectedId(null)} className="text-theme-muted hover:text-theme-primary ml-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>

              {/* Status */}
              <div className="px-4 pt-4 pb-2">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: (TRACKING_COLORS[preview.unified_status]?.bg || '#6B7280') + '22', color: TRACKING_COLORS[preview.unified_status]?.bg || '#6B7280' }}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
                  </div>
                  <div>
                    <div className="font-bold text-theme-primary">{preview.statusLabel}</div>
                    <div className="text-xs text-theme-muted">{preview.last_tracking_description || ''}</div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              {preview.trackingTimeline?.length > 0 && (
                <div className="px-4 pb-4">
                  <h4 className="text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-2">Timeline</h4>
                  <div className="relative ml-2">
                    <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-navy-600" />
                    <div className="space-y-3 pl-5">
                      {preview.trackingTimeline.slice(0, 8).map((ev, i) => (
                        <div key={i} className="relative">
                          <div className="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full border-2 border-navy-800"
                            style={{ backgroundColor: i === 0 ? (preview.statusColor || '#EF4444') : '#4b5563' }} />
                          <div className="text-xs text-theme-primary font-medium">{ev.description}</div>
                          <div className="text-[10px] text-theme-muted flex gap-2">
                            {ev.date && <span>{new Date(ev.date).toLocaleString('cs-CZ')}</span>}
                            {ev.location && <span>{ev.location}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="px-4 pb-3 border-t border-navy-700 pt-3 space-y-1.5 text-xs">
                <Row label="Objednávka" value={preview.order_number || preview.invoice_number} />
                <Row label="Tracking" value={preview.tracking_number} mono />
                <Row label="Dopravce" value={preview.shipper_code} />
                {preview.tracking_url && (
                  <div className="flex justify-between py-0.5">
                    <span className="text-theme-muted">Sledování</span>
                    <a href={preview.tracking_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">U dopravce →</a>
                  </div>
                )}
              </div>

              {/* Customer */}
              <div className="px-4 pb-4 border-t border-navy-700 pt-3">
                <h4 className="text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-2">Zákazník</h4>
                <div className="text-xs text-theme-primary font-medium">{preview.customer_name || '—'}</div>
                {preview.customer_phone && <div className="text-xs text-blue-400">{preview.customer_phone}</div>}
                {preview.customer_email && <div className="text-xs text-blue-400">{preview.customer_email}</div>}
                <div className="text-xs text-theme-muted mt-1">
                  {[preview.delivery_street, preview.delivery_city, preview.delivery_postal_code].filter(Boolean).join(', ')}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-theme-muted">{label}</span>
      <span className={`text-theme-primary font-medium ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
    </div>
  )
}

function ExpiryBadge({ daysLeft }) {
  const cfg = daysLeft < 0 ? { bg: '#450a0a', color: '#EF4444', label: `Expirováno (${Math.abs(daysLeft)}d)` }
    : daysLeft === 0 ? { bg: '#450a0a', color: '#EF4444', label: 'Dnes!' }
    : daysLeft <= 1 ? { bg: '#451a03', color: '#F59E0B', label: `${daysLeft} den` }
    : { bg: '#1e1b4b', color: '#8B5CF6', label: `${daysLeft} dní` }
  return <span style={{ backgroundColor: cfg.bg, color: cfg.color }} className="px-2 py-0.5 rounded-full text-xs font-semibold">{cfg.label}</span>
}
