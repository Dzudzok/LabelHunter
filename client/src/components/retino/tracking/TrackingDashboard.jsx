import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../services/api'
import StatusBadge from '../shared/StatusBadge'

const STATUS_FILTERS = [
  { key: 'all', label: 'Vše', color: '#64748b', icon: '📊' },
  { key: 'delivered', label: 'Doručeno', color: '#10B981', icon: '✅' },
  { key: 'in_transit', label: 'V přepravě', color: '#8B5CF6', icon: '🚚', statuses: 'in_transit' },
  { key: 'out_for_delivery', label: 'Na doručení', color: '#3B82F6', icon: '📬', statuses: 'out_for_delivery' },
  { key: 'handed_to_carrier', label: 'Předáno dopravci', color: '#6366F1', icon: '📦', statuses: 'handed_to_carrier' },
  { key: 'available_for_pickup', label: 'K vyzvednutí', color: '#F59E0B', icon: '🏪' },
  { key: 'problems', label: 'Problémy', color: '#EF4444', icon: '⚠️', statuses: 'failed_delivery,returned_to_sender' },
  { key: 'label_created', label: 'Vytvořeno', color: '#9CA3AF', icon: '🏷️' },
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

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/retino/tracking/dashboard')
      setDashboard(res.data)
    } catch {}
  }, [])

  const statusFilter = activeStatus === 'all' ? '' :
    STATUS_FILTERS.find(f => f.key === activeStatus)?.statuses || activeStatus

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
      setShipments(res.data.shipments)
      setTotal(res.data.total)
      setTotalPages(res.data.totalPages)
    } catch {}
    finally { setLoading(false) }
  }, [page, statusFilter, shipperFilter, dateFrom, dateTo, search])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])
  useEffect(() => { fetchShipments() }, [fetchShipments])

  const handleDatePreset = (preset) => {
    if (datePreset === preset.label) {
      setDateFrom(''); setDateTo(''); setDatePreset(''); setPage(1)
    } else {
      const { from, to } = preset.getDates()
      setDateFrom(from); setDateTo(to); setDatePreset(preset.label); setPage(1)
    }
  }

  const handleSearch = (e) => { e.preventDefault(); setSearch(searchInput); setPage(1) }

  const handleForceSync = async () => {
    setSyncing(true)
    try {
      await api.post('/retino/tracking/force-sync', syncCarrier ? { carrier: syncCarrier } : {})
      setTimeout(() => { fetchDashboard(); fetchShipments(); setSyncing(false) }, 5000)
    } catch { setSyncing(false) }
  }

  const handleReEvaluate = async () => {
    setSyncing(true)
    try {
      await api.post('/retino/tracking/re-evaluate', syncCarrier ? { carrier: syncCarrier } : {})
      setTimeout(() => { fetchDashboard(); fetchShipments(); setSyncing(false) }, 10000)
    } catch { setSyncing(false) }
  }

  const clearFilters = () => {
    setActiveStatus('all'); setShipperFilter(''); setDateFrom(''); setDateTo('')
    setSearch(''); setSearchInput(''); setDatePreset(''); setPage(1)
  }

  const hasFilters = activeStatus !== 'all' || shipperFilter || dateFrom || dateTo || search

  const getCount = (key) => {
    if (!dashboard?.statusCounts) return 0
    const sc = dashboard.statusCounts
    if (key === 'all') return dashboard.total || 0
    if (key === 'problems') return (sc.failed_delivery || 0) + (sc.returned_to_sender || 0)
    return sc[key] || 0
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-theme-primary">Tracking</h1>
          <p className="text-sm text-theme-muted">Přehled a sledování zásilek</p>
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

      {/* Status pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map(sf => {
          const count = getCount(sf.key)
          const isActive = activeStatus === sf.key
          return (
            <button key={sf.key}
              onClick={() => { setActiveStatus(isActive ? 'all' : sf.key); setPage(1) }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'text-white shadow-lg scale-[1.02]'
                  : 'bg-navy-800 text-theme-muted hover:bg-navy-700 hover:text-theme-primary'
              }`}
              style={isActive ? { backgroundColor: sf.color } : {}}>
              <span className="text-base">{sf.icon}</span>
              <span>{sf.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-navy-700'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filters bar */}
      <div className="bg-navy-800 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-1.5 flex-1 min-w-[200px]">
            <input type="text" placeholder="Hledat (doklad, tracking, zákazník...)" value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary flex-1 min-w-0 focus:border-blue-500 outline-none" />
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-semibold shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </button>
          </form>

          {/* Carrier */}
          <select value={shipperFilter} onChange={e => { setShipperFilter(e.target.value); setPage(1) }}
            className="bg-navy-700 border border-navy-600 rounded-lg px-2 py-2 text-sm text-theme-primary">
            <option value="">Dopravce</option>
            {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Date presets */}
          <div className="flex gap-1">
            {DATE_PRESETS.map(p => (
              <button key={p.label} onClick={() => handleDatePreset(p)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  datePreset === p.label ? 'bg-blue-600 text-white' : 'bg-navy-700 text-theme-muted hover:bg-navy-600'
                }`}>{p.label}</button>
            ))}
          </div>

          {/* Custom dates */}
          <div className="hidden lg:flex items-center gap-1.5">
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDatePreset(''); setPage(1) }}
              className="bg-navy-700 border border-navy-600 rounded-lg px-2 py-1.5 text-xs text-theme-primary" />
            <span className="text-theme-muted">—</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setDatePreset(''); setPage(1) }}
              className="bg-navy-700 border border-navy-600 rounded-lg px-2 py-1.5 text-xs text-theme-primary" />
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="text-red-400 hover:text-red-300 text-xs font-semibold px-2">
              ✕ Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-navy-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-600 text-theme-muted text-xs uppercase">
                <th className="text-left py-3 px-3 font-semibold">Datum</th>
                <th className="text-left py-3 px-3 font-semibold">Doklad</th>
                <th className="text-left py-3 px-3 font-semibold">Zákazník</th>
                <th className="text-left py-3 px-3 font-semibold">Dopravce</th>
                <th className="text-left py-3 px-3 font-semibold">Tracking</th>
                <th className="text-left py-3 px-3 font-semibold">Status</th>
                <th className="text-left py-3 px-3 font-semibold hidden xl:table-cell">Poslední update</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-theme-muted">
                  <svg className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Načítání...
                </td></tr>
              ) : shipments.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-theme-muted">Žádné zásilky</td></tr>
              ) : shipments.map(r => (
                <tr key={r.id} onClick={() => navigate(`/retino/tracking/${r.id}`)}
                  className="border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors cursor-pointer">
                  <td className="py-2.5 px-3 text-theme-muted text-xs whitespace-nowrap">
                    {r.date_issued ? new Date(r.date_issued).toLocaleDateString('cs-CZ') : '—'}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs font-semibold text-theme-primary">{r.doc_number}</td>
                  <td className="py-2.5 px-3 text-theme-secondary max-w-[180px] truncate">{r.customer_name || '—'}</td>
                  <td className="py-2.5 px-3">
                    <span className="font-mono text-[10px] bg-navy-700 px-1.5 py-0.5 rounded">{r.shipper_code || '—'}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-theme-muted">{r.tracking_number || '—'}</td>
                  <td className="py-2.5 px-3"><StatusBadge status={r.unified_status} /></td>
                  <td className="py-2.5 px-3 text-xs text-theme-muted max-w-[200px] truncate hidden xl:table-cell">
                    {r.last_tracking_description || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-navy-700">
            <span className="text-xs text-theme-muted">
              {(page-1)*50+1}–{Math.min(page*50, total)} z {total}
            </span>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}
                className="px-3 py-1.5 text-xs bg-navy-700 border border-navy-600 text-theme-secondary rounded-lg disabled:opacity-40 hover:bg-navy-600">
                ← Předchozí
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs bg-navy-700 border border-navy-600 text-theme-secondary rounded-lg disabled:opacity-40 hover:bg-navy-600">
                Další →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Carrier stats */}
      {dashboard?.carrierStats && Object.keys(dashboard.carrierStats).length > 0 && (
        <div className="bg-navy-800 rounded-xl p-4">
          <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider mb-3">Dopravci (30 dní)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {Object.entries(dashboard.carrierStats).sort((a, b) => b[1].total - a[1].total).map(([carrier, stats]) => (
              <button key={carrier}
                onClick={() => { setShipperFilter(shipperFilter === carrier ? '' : carrier); setPage(1) }}
                className={`rounded-lg p-3 text-left transition-all ${
                  shipperFilter === carrier ? 'bg-blue-600/20 border border-blue-500' : 'bg-navy-700 hover:bg-navy-600 border border-transparent'
                }`}>
                <div className="font-bold text-sm text-theme-primary">{carrier}</div>
                <div className="text-lg font-black text-theme-secondary">{stats.total}</div>
                <div className="flex gap-2 text-[10px] mt-1">
                  <span className="text-green-400">{stats.delivered}✓</span>
                  <span className="text-red-400">{stats.problem}✕</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
