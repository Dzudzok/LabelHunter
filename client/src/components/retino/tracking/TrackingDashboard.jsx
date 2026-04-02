import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../services/api'
import StatusBadge, { TRACKING_COLORS } from '../shared/StatusBadge'
import CarrierLogo from './CarrierLogo'

const STATUS_FILTERS = [
  { key: 'all', label: 'Vše', color: '#64748b', icon: '📊' },
  { key: 'in_transit', label: 'Na cestě', color: '#8B5CF6', statuses: 'in_transit,handed_to_carrier' },
  { key: 'out_for_delivery', label: 'Na doručení', color: '#3B82F6', statuses: 'out_for_delivery' },
  { key: 'available_for_pickup', label: 'K vyzvednutí', color: '#F59E0B' },
  { key: 'delivered', label: 'Doručeno', color: '#10B981' },
  { key: 'problems', label: 'S problémy', color: '#EF4444', statuses: 'failed_delivery,returned_to_sender' },
  { key: 'label_created', label: 'Vytvořeno', color: '#9CA3AF' },
]

const DATE_PRESETS = [
  { label: 'Včera', getDates: () => { const d = new Date(); d.setDate(d.getDate()-1); const s = d.toISOString().slice(0,10); return { from: s, to: s } } },
  { label: 'Dnes', getDates: () => { const s = new Date().toISOString().slice(0,10); return { from: s, to: s } } },
  { label: '3 dny', getDates: () => { const d = new Date(); d.setDate(d.getDate()-3); return { from: d.toISOString().slice(0,10), to: new Date().toISOString().slice(0,10) } } },
  { label: 'Týden', getDates: () => { const d = new Date(); d.setDate(d.getDate()-7); return { from: d.toISOString().slice(0,10), to: new Date().toISOString().slice(0,10) } } },
  { label: '14 dní', getDates: () => { const d = new Date(); d.setDate(d.getDate()-14); return { from: d.toISOString().slice(0,10), to: new Date().toISOString().slice(0,10) } } },
  { label: '30 dní', getDates: () => { const d = new Date(); d.setDate(d.getDate()-30); return { from: d.toISOString().slice(0,10), to: new Date().toISOString().slice(0,10) } } },
  { label: 'Do včerejška', getDates: () => { const d = new Date(); d.setDate(d.getDate()-1); return { from: new Date(Date.now()-30*86400000).toISOString().slice(0,10), to: d.toISOString().slice(0,10) } } },
]

const CARRIERS = ['GLS', 'PPL', 'DPD', 'UPS', 'Zasilkovna', 'CP', 'FOFR']

export default function TrackingDashboard() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [activeStatus, setActiveStatus] = useState('all')
  const [shipperFilter, setShipperFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [datePreset, setDatePreset] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncCarrier, setSyncCarrier] = useState('')

  // Sidebar preview
  const [selectedId, setSelectedId] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewSyncing, setPreviewSyncing] = useState(false)

  const fetchDashboard = useCallback(async () => {
    try { const res = await api.get('/retino/tracking/dashboard'); setDashboard(res.data) } catch {}
  }, [])

  const statusFilter = activeStatus === 'all' ? '' : STATUS_FILTERS.find(f => f.key === activeStatus)?.statuses || activeStatus

  const fetchShipments = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, pageSize: 50 }
      if (statusFilter) params.status = statusFilter
      if (shipperFilter) params.shipper = shipperFilter
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      if (search) params.search = search
      const res = await api.get('/retino/tracking/shipments', { params })
      setShipments(res.data.shipments); setTotal(res.data.total); setTotalPages(res.data.totalPages)
    } catch {} finally { setLoading(false) }
  }, [page, statusFilter, shipperFilter, dateFrom, dateTo, search])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])
  useEffect(() => { fetchShipments() }, [fetchShipments])

  // Fetch preview when selected
  useEffect(() => {
    if (!selectedId) { setPreview(null); return }
    setPreviewLoading(true)
    api.get(`/retino/tracking/shipments/${selectedId}`)
      .then(res => setPreview(res.data))
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false))
  }, [selectedId])

  const handleRowClick = (row) => {
    setSelectedId(selectedId === row.id ? null : row.id)
  }

  const handlePreviewSync = async () => {
    if (!selectedId) return
    setPreviewSyncing(true)
    try {
      await api.post(`/retino/tracking/shipments/${selectedId}/sync`)
      const res = await api.get(`/retino/tracking/shipments/${selectedId}`)
      setPreview(res.data)
      fetchShipments() // refresh list too
    } catch (err) {
      alert(err.response?.data?.error || 'Chyba')
    } finally { setPreviewSyncing(false) }
  }

  const handleDatePreset = (preset) => {
    if (datePreset === preset.label) { setDateFrom(''); setDateTo(''); setDatePreset(''); setPage(1) }
    else { const { from, to } = preset.getDates(); setDateFrom(from); setDateTo(to); setDatePreset(preset.label); setPage(1) }
  }
  const handleSearch = (e) => { e.preventDefault(); setSearch(searchInput); setPage(1) }
  const handleForceSync = async () => {
    setSyncing(true)
    try { await api.post('/retino/tracking/force-sync', syncCarrier ? { carrier: syncCarrier } : {}); setTimeout(() => { fetchDashboard(); fetchShipments(); setSyncing(false) }, 5000) } catch { setSyncing(false) }
  }
  const handleReEvaluate = async () => {
    setSyncing(true)
    try { await api.post('/retino/tracking/re-evaluate', syncCarrier ? { carrier: syncCarrier } : {}); setTimeout(() => { fetchDashboard(); fetchShipments(); setSyncing(false) }, 10000) } catch { setSyncing(false) }
  }
  const clearFilters = () => { setActiveStatus('all'); setShipperFilter(''); setDateFrom(''); setDateTo(''); setSearch(''); setSearchInput(''); setDatePreset(''); setPage(1) }
  const hasFilters = activeStatus !== 'all' || shipperFilter || dateFrom || dateTo || search

  const getCount = (key) => {
    if (!dashboard?.statusCounts) return 0
    const sc = dashboard.statusCounts
    if (key === 'all') return dashboard.total || 0
    if (key === 'problems') return (sc.failed_delivery || 0) + (sc.returned_to_sender || 0)
    if (key === 'in_transit') return (sc.in_transit || 0) + (sc.handed_to_carrier || 0)
    return sc[key] || 0
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Main content */}
      <div className={`flex-1 overflow-auto p-4 sm:p-6 space-y-4 transition-all ${selectedId ? 'mr-0' : ''}`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-theme-primary">Doprava</h1>
            <p className="text-sm text-theme-muted">Všechny zásilky — filtrujte a sledujte stav doručení</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={syncCarrier} onChange={e => setSyncCarrier(e.target.value)}
              className="bg-navy-800 border border-navy-600 text-theme-primary rounded-lg px-2 py-1.5 text-xs">
              <option value="">Všichni</option>
              {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={handleForceSync} disabled={syncing}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
              <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Sync
            </button>
            <button onClick={handleReEvaluate} disabled={syncing}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
              Re-eval
            </button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 border-b border-navy-700 overflow-x-auto">
          {STATUS_FILTERS.map(sf => {
            const count = getCount(sf.key)
            const isActive = activeStatus === sf.key
            return (
              <button key={sf.key}
                onClick={() => { setActiveStatus(isActive && sf.key !== 'all' ? 'all' : sf.key); setPage(1) }}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive ? 'border-current text-theme-primary' : 'border-transparent text-theme-muted hover:text-theme-primary'
                }`}
                style={isActive ? { color: sf.color, borderColor: sf.color } : {}}>
                {sf.label}
                {count != null && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white/20' : 'bg-navy-600'
                  }`}>{count}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearch} className="flex gap-1.5 flex-1 min-w-[200px] max-w-md">
            <input type="text" placeholder="Tracking, doklad, zákazník..." value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-1.5 text-sm text-theme-primary flex-1 min-w-0 focus:border-blue-500 outline-none" />
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold">
              Hledat
            </button>
          </form>
          <select value={shipperFilter} onChange={e => { setShipperFilter(e.target.value); setPage(1) }}
            className="bg-navy-800 border border-navy-600 rounded-lg px-2 py-1.5 text-sm text-theme-primary">
            <option value="">Dopravce</option>
            {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex gap-1">
            {DATE_PRESETS.map(p => (
              <button key={p.label} onClick={() => handleDatePreset(p)}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  datePreset === p.label ? 'bg-blue-600 text-white' : 'bg-navy-800 text-theme-muted hover:bg-navy-700'
                }`}>{p.label}</button>
            ))}
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="text-red-400 hover:text-red-300 text-xs font-semibold">✕ Reset</button>
          )}
        </div>

        {/* Table */}
        <div className="bg-navy-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-600 text-theme-muted text-[11px] uppercase">
                <th className="text-left py-2.5 px-3 font-semibold">Tracking</th>
                <th className="text-left py-2.5 px-3 font-semibold">Objednávka</th>
                <th className="text-left py-2.5 px-3 font-semibold hidden lg:table-cell">Zákazník</th>
                <th className="text-left py-2.5 px-3 font-semibold">Dopravce</th>
                <th className="text-left py-2.5 px-3 font-semibold hidden md:table-cell">Datum</th>
                <th className="text-left py-2.5 px-3 font-semibold">Stav</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-16 text-theme-muted">
                  <svg className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Načítání...
                </td></tr>
              ) : shipments.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-theme-muted">Žádné zásilky</td></tr>
              ) : shipments.map(r => (
                <tr key={r.id} onClick={() => handleRowClick(r)}
                  className={`border-b border-navy-700/50 cursor-pointer transition-colors ${
                    selectedId === r.id ? 'bg-blue-600/10 border-l-2 border-l-blue-500' : 'hover:bg-navy-700/30'
                  }`}>
                  <td className="py-2 px-3 font-mono text-xs text-theme-primary">{r.tracking_number || r.doc_number}</td>
                  <td className="py-2 px-3 text-xs text-theme-secondary">{r.order_number || r.invoice_number || '—'}</td>
                  <td className="py-2 px-3 text-xs text-theme-secondary hidden lg:table-cell truncate max-w-[150px]">{r.customer_name || '—'}</td>
                  <td className="py-2 px-3">
                    <CarrierLogo carrier={r.shipper_code} country={r.delivery_country} size="xs" />
                  </td>
                  <td className="py-2 px-3 text-xs text-theme-muted hidden md:table-cell whitespace-nowrap">
                    {r.date_issued ? new Date(r.date_issued).toLocaleDateString('cs-CZ') : '—'}
                  </td>
                  <td className="py-2 px-3"><StatusBadge status={r.unified_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-navy-700">
              <span className="text-[11px] text-theme-muted">{(page-1)*50+1}–{Math.min(page*50, total)} z {total}</span>
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

      {/* Sidebar Preview Panel */}
      {selectedId && (
        <div className="w-[400px] xl:w-[450px] border-l border-navy-700 bg-navy-850 overflow-y-auto flex-shrink-0"
          style={{ backgroundColor: 'var(--navy-800)' }}>
          {previewLoading ? (
            <div className="flex items-center justify-center py-20">
              <svg className="w-6 h-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            </div>
          ) : preview ? (
            <div>
              {/* Preview header */}
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
                  <button onClick={() => navigate(`/retino/tracking/${selectedId}`)}
                    className="text-theme-muted hover:text-theme-primary text-xs font-semibold">
                    Otevřít →
                  </button>
                  <button onClick={() => setSelectedId(null)} className="text-theme-muted hover:text-theme-primary ml-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>

              {/* Status badge large */}
              <div className="px-4 pt-4 pb-2">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: (TRACKING_COLORS[preview.unified_status]?.bg || '#6B7280') + '22', color: TRACKING_COLORS[preview.unified_status]?.bg || '#6B7280' }}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {preview.unified_status === 'delivered' ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/> :
                       preview.unified_status === 'available_for_pickup' ? <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/> :
                       <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>}
                    </svg>
                  </div>
                  <div>
                    <div className="font-bold text-theme-primary">{preview.statusLabel || preview.unified_status}</div>
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
                            style={{ backgroundColor: i === 0 ? (preview.statusColor || '#8B5CF6') : '#4b5563' }} />
                          <div className="text-xs text-theme-primary font-medium">{ev.description}</div>
                          <div className="text-[10px] text-theme-muted flex gap-2">
                            {ev.date && <span>{new Date(ev.date).toLocaleString('cs-CZ')}</span>}
                            {ev.location && <span>{ev.location}</span>}
                          </div>
                          <StatusBadge status={ev.unifiedStatus} className="mt-0.5" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Shipment info */}
              <div className="px-4 pb-3 border-t border-navy-700 pt-3">
                <div className="space-y-1.5 text-xs">
                  <Row label="Objednávka" value={preview.order_number || preview.invoice_number} />
                  <Row label="Číslo sledování" value={preview.tracking_number} mono />
                  <div className="flex justify-between items-center py-0.5">
                      <span className="text-theme-muted">Dopravce</span>
                      <CarrierLogo carrier={preview.shipper_code} country={preview.delivery_country} size="sm" />
                    </div>
                  <Row label="Datum odeslání" value={preview.date_issued ? new Date(preview.date_issued).toLocaleDateString('cs-CZ') : '—'} />
                  {preview.tracking_url && (
                    <div className="flex justify-between py-0.5">
                      <span className="text-theme-muted">Sledování</span>
                      <a href={preview.tracking_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-xs">
                        U dopravce →
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer */}
              <div className="px-4 pb-3 border-t border-navy-700 pt-3">
                <h4 className="text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-2">Zákazník</h4>
                <div className="text-xs text-theme-primary font-medium">{preview.customer_name || '—'}</div>
                {preview.customer_phone && <div className="text-xs text-blue-400">{preview.customer_phone}</div>}
                {preview.customer_email && <div className="text-xs text-blue-400">{preview.customer_email}</div>}
                <div className="text-xs text-theme-muted mt-1">
                  {[preview.delivery_street, preview.delivery_city, preview.delivery_postal_code, preview.delivery_country].filter(Boolean).join(', ')}
                </div>
              </div>

              {/* Items */}
              {preview.items?.length > 0 && (
                <div className="px-4 pb-4 border-t border-navy-700 pt-3">
                  <h4 className="text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-2">Položky ({preview.items.length})</h4>
                  {preview.items.filter(i => i.item_type === 'goods').slice(0, 5).map((item, i) => (
                    <div key={i} className="flex justify-between text-xs py-1 border-b border-navy-700/50 last:border-0">
                      <span className="text-theme-secondary truncate max-w-[250px]">{item.text}</span>
                      <span className="text-theme-muted ml-2">{item.qty}×</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-20 text-theme-muted text-sm">Zásilka nenalezena</div>
          )}
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
