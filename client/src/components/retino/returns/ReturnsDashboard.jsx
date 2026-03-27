import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../services/api'
import StatsCards from '../shared/StatsCards'
import StatusBadge from '../shared/StatusBadge'
import DataTable, { Pagination } from '../shared/DataTable'

export default function ReturnsDashboard() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/retino/returns/dashboard')
      setDashboard(res.data)
    } catch (err) {
      console.error('Failed to fetch returns dashboard:', err)
    }
  }, [])

  const fetchReturns = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, pageSize: 50 }
      if (statusFilter) params.status = statusFilter
      if (typeFilter) params.type = typeFilter
      if (search) params.search = search
      const res = await api.get('/retino/returns', { params })
      setReturns(res.data.returns)
      setTotal(res.data.total)
      setTotalPages(res.data.totalPages)
    } catch (err) {
      console.error('Failed to fetch returns:', err)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, typeFilter, search])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])
  useEffect(() => { fetchReturns() }, [fetchReturns])

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const statsCards = dashboard ? [
    { label: 'Celkem', value: dashboard.total, bgColor: '#1e293b', valueColor: '#fff' },
    { label: 'Nové', value: dashboard.statusCounts?.new || 0, bgColor: '#1e3a5f', valueColor: '#3B82F6', onClick: () => { setStatusFilter('new'); setPage(1) } },
    { label: 'Čeká kontrola', value: dashboard.statusCounts?.under_review || 0, bgColor: '#431407', valueColor: '#F97316', onClick: () => { setStatusFilter('under_review'); setPage(1) } },
    { label: 'Schváleno', value: dashboard.statusCounts?.approved || 0, bgColor: '#064e3b', valueColor: '#10B981', onClick: () => { setStatusFilter('approved'); setPage(1) } },
    { label: 'Zamítnuto', value: dashboard.statusCounts?.rejected || 0, bgColor: '#450a0a', valueColor: '#EF4444', onClick: () => { setStatusFilter('rejected'); setPage(1) } },
    { label: 'Prům. dny', value: dashboard.avgResolutionDays ?? '-', bgColor: '#1e293b', valueColor: '#F59E0B' },
  ] : []

  const columns = [
    { header: '#', width: '120px', render: (r) => <span className="font-mono text-xs">{r.return_number || `#${r.id}`}</span> },
    { header: 'Zákazník', render: (r) => r.customer_name || r.customer_email || '-' },
    { header: 'Typ', width: '90px', render: (r) => (
      <span className="text-xs">{r.type === 'return' ? 'Vrácení' : r.type === 'complaint' ? 'Reklamace' : 'Záruka'}</span>
    )},
    { header: 'Status', width: '150px', render: (r) => <StatusBadge status={r.status} type="return" /> },
    { header: 'Datum', width: '100px', render: (r) => r.requested_at ? new Date(r.requested_at).toLocaleDateString('cs-CZ') : '-' },
  ]

  return (
    <div className="bg-navy-900 text-theme-primary p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Vrácení a reklamace</h1>
        <button
          onClick={() => navigate('/retino/returns/new')}
          className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-2 rounded-lg text-sm"
        >
          + Nová žádost
        </button>
      </div>

      {dashboard && <StatsCards cards={statsCards} />}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="Hledat (číslo, zákazník...)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="bg-navy-700 border border-navy-600 rounded-lg px-3 py-1.5 text-sm text-theme-primary w-56"
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold">
            Hledat
          </button>
        </form>

        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className="bg-navy-700 border border-navy-600 rounded-lg px-3 py-1.5 text-sm text-theme-primary"
        >
          <option value="">Všechny typy</option>
          <option value="return">Vrácení</option>
          <option value="complaint">Reklamace</option>
          <option value="warranty">Záruka</option>
        </select>

        {(statusFilter || typeFilter || search) && (
          <button
            onClick={() => { setStatusFilter(''); setTypeFilter(''); setSearch(''); setSearchInput(''); setPage(1) }}
            className="text-red-400 hover:text-red-300 text-sm"
          >
            Zrušit filtry
          </button>
        )}
      </div>

      <div className="bg-navy-800 rounded-xl p-4">
        <DataTable
          columns={columns}
          rows={returns}
          loading={loading}
          onRowClick={(row) => navigate(`/retino/returns/${row.id}`)}
          emptyText="Žádné žádosti"
        />
        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      </div>
    </div>
  )
}
