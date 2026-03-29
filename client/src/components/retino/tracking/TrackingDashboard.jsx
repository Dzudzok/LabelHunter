import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../services/api'
import StatsCards from '../shared/StatsCards'
import StatusBadge from '../shared/StatusBadge'
import DataTable, { Pagination } from '../shared/DataTable'
import { TRACKING_COLORS } from '../shared/StatusBadge'

export default function TrackingDashboard() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [shipperFilter, setShipperFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/retino/tracking/dashboard')
      setDashboard(res.data)
    } catch (err) {
      console.error('Failed to fetch dashboard:', err)
    }
  }, [])

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
    } catch (err) {
      console.error('Failed to fetch shipments:', err)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, shipperFilter, dateFrom, dateTo, search])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])
  useEffect(() => { fetchShipments() }, [fetchShipments])

  const handleStatusClick = (status) => {
    setStatusFilter(prev => prev === status ? '' : status)
    setPage(1)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const statsCards = dashboard ? [
    { label: 'Celkem (30 dní)', value: dashboard.total, bgColor: '#1e293b', valueColor: '#fff' },
    { label: 'Doručeno', value: dashboard.statusCounts?.delivered || 0, bgColor: '#064e3b', valueColor: '#10B981', onClick: () => handleStatusClick('delivered'), active: statusFilter === 'delivered' },
    { label: 'V přepravě', value: (dashboard.statusCounts?.in_transit || 0) + (dashboard.statusCounts?.out_for_delivery || 0) + (dashboard.statusCounts?.handed_to_carrier || 0), bgColor: '#1e1b4b', valueColor: '#8B5CF6', onClick: () => handleStatusClick('in_transit,out_for_delivery,handed_to_carrier'), active: statusFilter === 'in_transit,out_for_delivery,handed_to_carrier' },
    { label: 'K vyzvednutí', value: dashboard.statusCounts?.available_for_pickup || 0, bgColor: '#451a03', valueColor: '#F59E0B', onClick: () => handleStatusClick('available_for_pickup'), active: statusFilter === 'available_for_pickup' },
    { label: 'Nedoručeno', value: (dashboard.statusCounts?.failed_delivery || 0) + (dashboard.statusCounts?.returned_to_sender || 0), bgColor: '#450a0a', valueColor: '#EF4444', onClick: () => handleStatusClick('failed_delivery,returned_to_sender'), active: statusFilter === 'failed_delivery,returned_to_sender' },
    { label: 'Vytvořeno', value: dashboard.statusCounts?.label_created || 0, bgColor: '#1e293b', valueColor: '#9CA3AF', onClick: () => handleStatusClick('label_created'), active: statusFilter === 'label_created' },
  ] : []

  const columns = [
    { header: 'Datum', width: '100px', render: (r) => r.date_issued ? new Date(r.date_issued).toLocaleDateString('cs-CZ') : '-' },
    { header: 'Doklad', width: '130px', key: 'doc_number' },
    { header: 'Zákazník', render: (r) => r.customer_name || '-' },
    { header: 'Dopravce', width: '80px', render: (r) => <span className="font-mono text-xs">{r.shipper_code || '-'}</span> },
    { header: 'Tracking', width: '140px', render: (r) => r.tracking_number ? (
      <span className="font-mono text-xs">{r.tracking_number}</span>
    ) : '-' },
    { header: 'Status', width: '150px', render: (r) => <StatusBadge status={r.unified_status} /> },
    { header: 'Štítky', width: '120px', render: (r) => r.tags && r.tags.length > 0 ? (
      <div className="flex flex-wrap gap-1">
        {r.tags.map(t => (
          <span key={t.id} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight"
            style={{ backgroundColor: t.bg_color || '#3b82f6', color: t.color || '#fff' }}>
            {t.name}
          </span>
        ))}
      </div>
    ) : null },
    { header: 'Poslední update', render: (r) => (
      <span className="text-xs text-theme-muted">{r.last_tracking_description || '-'}</span>
    )},
  ]

  const carriers = dashboard?.carrierStats ? Object.keys(dashboard.carrierStats).sort() : []

  return (
    <div className="bg-navy-900 text-theme-primary p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Tracking Dashboard</h1>
      </div>

      {/* Stats */}
      {dashboard && <StatsCards cards={statsCards} />}

      {/* Filters */}
      <div className="space-y-3 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="Hledat (doklad, tracking, zákazník...)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="bg-navy-700 border border-navy-600 rounded-lg px-3 py-1.5 text-sm text-theme-primary flex-1 min-w-0"
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold flex-shrink-0">
            Hledat
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick date buttons */}
          <div className="flex gap-1">
            {[
              { label: '3d', days: 3 },
              { label: '7d', days: 7 },
              { label: '14d', days: 14 },
              { label: '30d', days: 30 },
            ].map(({ label, days }) => {
              const from = new Date(); from.setDate(from.getDate() - days);
              const fromStr = from.toISOString().slice(0, 10);
              const toStr = new Date().toISOString().slice(0, 10);
              const isActive = dateFrom === fromStr && dateTo === toStr;
              return (
                <button
                  key={days}
                  onClick={() => {
                    if (isActive) { setDateFrom(''); setDateTo('') }
                    else { setDateFrom(fromStr); setDateTo(toStr) }
                    setPage(1)
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-navy-700 text-theme-muted hover:bg-navy-600 hover:text-theme-primary'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <select
            value={shipperFilter}
            onChange={(e) => { setShipperFilter(e.target.value); setPage(1) }}
            className="bg-navy-700 border border-navy-600 rounded-lg px-2 py-1.5 text-sm text-theme-primary"
          >
            <option value="">Dopravce</option>
            {carriers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="hidden sm:flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="bg-navy-700 border border-navy-600 rounded-lg px-2 py-1.5 text-sm text-theme-primary" />
            <span className="text-theme-muted text-sm">—</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="bg-navy-700 border border-navy-600 rounded-lg px-2 py-1.5 text-sm text-theme-primary" />
          </div>

          {(statusFilter || shipperFilter || dateFrom || dateTo || search) && (
            <button
              onClick={() => { setStatusFilter(''); setShipperFilter(''); setDateFrom(''); setDateTo(''); setSearch(''); setSearchInput(''); setPage(1) }}
              className="text-red-400 hover:text-red-300 text-xs sm:text-sm"
            >
              Zrušit
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-navy-800 rounded-xl p-2 sm:p-4 overflow-x-auto">
        <DataTable
          columns={columns}
          rows={shipments}
          loading={loading}
          onRowClick={(row) => navigate(`/retino/tracking/${row.id}`)}
          emptyText="Žádné zásilky"
        />
        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      </div>

      {/* Carrier stats */}
      {dashboard?.carrierStats && Object.keys(dashboard.carrierStats).length > 0 && (
        <div className="mt-6 bg-navy-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Statistiky dopravců (30 dní)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(dashboard.carrierStats).sort((a, b) => b[1].total - a[1].total).map(([carrier, stats]) => (
              <div key={carrier} className="bg-navy-700 rounded-lg p-3">
                <div className="font-bold text-sm">{carrier}</div>
                <div className="text-xs text-theme-muted mt-1">
                  Celkem: {stats.total} | Doručeno: {stats.delivered} | Problém: {stats.problem}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
