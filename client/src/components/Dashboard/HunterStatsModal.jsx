import { useState, useEffect } from 'react'
import { api } from '../../services/api'

const ERROR_LABELS = {
  wrong_qty: 'Zła ilość',
  missing_product: 'Brakujący towar',
  wrong_product: 'Inny towar',
}

function Bar({ value, max, color = 'bg-brand-orange' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-navy-900 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-theme-primary font-bold text-sm w-8 text-right">{value}</span>
    </div>
  )
}

export default function HunterStatsModal({ onClose }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('week') // 'week', 'month', 'custom'
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchStats = async () => {
    setLoading(true)
    try {
      const params = {}
      if (range === 'week') {
        const now = new Date()
        const dayOfWeek = now.getDay()
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        const monday = new Date(now)
        monday.setDate(now.getDate() + mondayOffset)
        params.date_from = monday.toISOString().split('T')[0]
        params.date_to = now.toISOString().split('T')[0]
      } else if (range === 'month') {
        const now = new Date()
        params.date_from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        params.date_to = now.toISOString().split('T')[0]
      } else if (dateFrom && dateTo) {
        params.date_from = dateFrom
        params.date_to = dateTo
      }

      const res = await api.get('/hunters/stats', { params })
      setStats(res.data)
    } catch (err) {
      console.error('Failed to fetch hunter stats:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [range, dateFrom, dateTo])

  const maxPackages = stats ? Math.max(...(stats.hunters || []).map(h => h.totalPackages), 1) : 1
  const maxErrors = stats ? Math.max(...(stats.hunters || []).map(h => h.totalErrors), 1) : 1

  return (
    <div className="fixed inset-0 overlay-bg z-50 flex items-start justify-center pt-4 px-4 overflow-y-auto">
      <div className="bg-navy-800 border border-navy-600 rounded-2xl w-full max-w-5xl mb-8">

        {/* Nagłówek */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-xl font-bold text-theme-primary">Statystyki szykowaczów</h2>
            <div className="flex gap-1">
              {['week', 'month', 'custom'].map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                    range === r
                      ? 'bg-brand-orange text-white'
                      : 'bg-navy-700 text-theme-secondary hover:text-theme-primary'
                  }`}
                >
                  {r === 'week' ? 'Tydzień' : r === 'month' ? 'Miesiąc' : 'Własny'}
                </button>
              ))}
            </div>
            {range === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="bg-navy-900 border border-navy-600 rounded-lg px-2 py-1 text-theme-primary text-sm outline-none focus:border-brand-orange"
                />
                <span className="text-theme-muted">—</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="bg-navy-900 border border-navy-600 rounded-lg px-2 py-1 text-theme-primary text-sm outline-none focus:border-brand-orange"
                />
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-theme-secondary hover:text-theme-primary text-2xl min-h-0 leading-none">&times;</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-theme-secondary text-lg">Ładowanie...</div>
        ) : !stats ? (
          <div className="flex items-center justify-center py-20 text-red-400">Błąd ładowania</div>
        ) : (
          <div className="px-6 py-6 flex flex-col gap-6">

            {/* Karty podsumowania */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-navy-700 rounded-xl p-5 border border-navy-600 text-center">
                <div className="text-4xl font-black text-theme-primary">{stats.totals.packages}</div>
                <div className="text-theme-secondary mt-1 text-sm font-semibold uppercase tracking-wide">Paczek razem</div>
              </div>
              <div className="bg-red-900/30 rounded-xl p-5 border border-red-800 text-center">
                <div className="text-4xl font-black text-red-400">{stats.totals.errors}</div>
                <div className="text-theme-secondary mt-1 text-sm font-semibold uppercase tracking-wide">Błędów razem</div>
              </div>
              <div className="bg-navy-700 rounded-xl p-5 border border-navy-600 text-center">
                <div className="text-4xl font-black text-brand-orange">{stats.totals.hunters}</div>
                <div className="text-theme-secondary mt-1 text-sm font-semibold uppercase tracking-wide">Szykowaczów</div>
              </div>
            </div>

            {/* Karty szykowaczów */}
            {(stats.hunters || []).length === 0 ? (
              <div className="text-center py-8 text-theme-muted">Brak danych za ten okres</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.hunters.map(h => (
                  <div key={h.id} className={`bg-navy-700 rounded-xl p-5 border ${
                    h.totalErrors > 0 ? 'border-red-700' : 'border-navy-600'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-theme-primary font-bold text-lg">{h.name}</div>
                      {h.errorRate > 0 && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          h.errorRate > 10 ? 'bg-red-900/50 text-red-400' : 'bg-yellow-900/50 text-yellow-400'
                        }`}>
                          {h.errorRate}% błędów
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-3">
                      <div>
                        <div className="text-theme-secondary text-xs mb-1">Przygotowanych paczek</div>
                        <Bar value={h.totalPackages} max={maxPackages} color="bg-blue-500" />
                      </div>
                      <div>
                        <div className="text-theme-secondary text-xs mb-1">Pozycji razem</div>
                        <div className="text-theme-primary font-bold text-lg">{h.totalItems}</div>
                      </div>

                      {h.totalErrors > 0 && (
                        <div className="border-t border-navy-600 pt-3 mt-1">
                          <div className="text-red-400 text-xs font-semibold mb-2">Błędy ({h.totalErrors})</div>
                          <div className="grid grid-cols-3 gap-2">
                            {Object.entries(h.errorsByType).map(([type, count]) => (
                              count > 0 && (
                                <div key={type} className="text-center">
                                  <div className="text-red-400 font-bold text-lg">{count}</div>
                                  <div className="text-theme-muted text-xs">{ERROR_LABELS[type]}</div>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Ostatnie błędy */}
            {(stats.recentErrors || []).length > 0 && (
              <div className="bg-navy-700 rounded-xl border border-navy-600 overflow-hidden">
                <div className="px-5 py-3 border-b border-navy-600">
                  <h3 className="text-base font-bold text-red-400 uppercase tracking-wide">Ostatnie błędy</h3>
                </div>
                <div className="divide-y divide-navy-600">
                  {stats.recentErrors.map(e => (
                    <div key={e.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                      <div className="text-theme-muted shrink-0 w-24">
                        {new Date(e.created_at).toLocaleDateString('pl-PL')}
                      </div>
                      <div className="text-theme-primary font-semibold shrink-0 w-32">{e.hunter_name}</div>
                      <div className="text-red-400 font-semibold shrink-0 w-36">{ERROR_LABELS[e.error_type]}</div>
                      <div className="text-theme-secondary flex-1 truncate">{e.worker_name || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
