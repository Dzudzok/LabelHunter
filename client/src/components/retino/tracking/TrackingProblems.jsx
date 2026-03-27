import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../services/api'
import StatusBadge from '../shared/StatusBadge'

const PROBLEM_STATUSES = 'failed_delivery,returned_to_sender,problem'

const TABS = [
  { label: 'Nedoručeno', status: 'failed_delivery' },
  { label: 'Vráceno odesílateli', status: 'returned_to_sender' },
  { label: 'Problémy dopravce', status: 'problem' },
  { label: 'Vše', status: PROBLEM_STATUSES },
]

export default function TrackingProblems() {
  const [shipments, setShipments] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(PROBLEM_STATUSES)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [shipper, setShipper] = useState('')
  const navigate = useNavigate()
  const pageSize = 50

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        status: activeTab,
        page,
        pageSize,
        sortBy: 'date_issued',
        sortDir: 'desc',
      }
      if (search) params.search = search
      if (shipper) params.shipper = shipper
      const res = await api.get('/retino/tracking/shipments', { params })
      setShipments(res.data.shipments || [])
      setTotal(res.data.total || 0)
    } catch (err) {
      console.error('Problems fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [activeTab, page, search, shipper])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setPage(1) }, [activeTab, search, shipper])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-theme-primary">Problémové zásilky</h1>
        <p className="text-sm text-theme-muted mt-1">
          Proaktivně řešte zásilky s problémy, abyste zajistili spokojenost zákazníků.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-navy-700">
        {TABS.map(tab => (
          <button
            key={tab.status}
            onClick={() => setActiveTab(tab.status)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.status
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-theme-muted hover:text-theme-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Sledovací číslo, číslo objednávky, jméno zákazníka..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-navy-800 border border-navy-600 text-theme-primary rounded-lg px-3 py-2 text-sm placeholder-theme-muted"
        />
        <select
          value={shipper}
          onChange={(e) => setShipper(e.target.value)}
          className="bg-navy-800 border border-navy-600 text-theme-primary rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Dopravní společnost</option>
          <option value="GLS">GLS</option>
          <option value="PPL">PPL</option>
          <option value="DPD">DPD</option>
          <option value="UPS">UPS</option>
          <option value="CP">Česká Pošta</option>
          <option value="ZASILKOVNA">Zásilkovna</option>
          <option value="WEDO">WeDo</option>
          <option value="INTIME">InTime</option>
        </select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-theme-muted py-8 text-center">Načítání...</div>
      ) : shipments.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">&#128269;</div>
          <div className="text-theme-muted">Žádné problémové zásilky nenalezeny.</div>
        </div>
      ) : (
        <>
          <div className="text-xs text-theme-muted">
            Zobrazeno {(page - 1) * pageSize + 1} až {Math.min(page * pageSize, total)} z {total} výsledků
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-600 text-theme-muted text-xs uppercase">
                  <th className="text-left py-3 px-3">Datum</th>
                  <th className="text-left py-3 px-3">Doklad</th>
                  <th className="text-left py-3 px-3">Zákazník</th>
                  <th className="text-left py-3 px-3">Dopravce</th>
                  <th className="text-left py-3 px-3">Tracking</th>
                  <th className="text-left py-3 px-3">Stav</th>
                  <th className="text-left py-3 px-3">Popis</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/retino/tracking/${s.id}`)}
                  >
                    <td className="py-2.5 px-3 text-theme-muted text-xs">
                      {s.date_issued ? new Date(s.date_issued).toLocaleDateString('cs-CZ') : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-theme-primary font-mono text-xs">{s.doc_number}</td>
                    <td className="py-2.5 px-3 text-theme-secondary">{s.customer_name || '—'}</td>
                    <td className="py-2.5 px-3 text-theme-secondary font-mono">{s.shipper_code}</td>
                    <td className="py-2.5 px-3 text-theme-muted font-mono text-xs">{s.tracking_number}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={s.unified_status} /></td>
                    <td className="py-2.5 px-3 text-theme-muted text-xs max-w-[200px] truncate">
                      {s.last_tracking_description || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-theme-muted">
                Strana {page} z {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-sm bg-navy-800 border border-navy-600 text-theme-secondary rounded-lg disabled:opacity-40 hover:bg-navy-700"
                >
                  Předchozí
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm bg-navy-800 border border-navy-600 text-theme-secondary rounded-lg disabled:opacity-40 hover:bg-navy-700"
                >
                  Další
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
