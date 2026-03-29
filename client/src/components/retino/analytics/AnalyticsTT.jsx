import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../services/api'
import StatsCards from '../shared/StatsCards'

const PERIOD_OPTIONS = [
  { label: '7 dni', value: '7' },
  { label: '14 dni', value: '14' },
  { label: '30 dni', value: '30' },
  { label: '90 dni', value: '90' },
]

export default function AnalyticsTT() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState('30')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/retino/analytics/tt-analytics', { params: { days } })
      setData(res.data)
    } catch (err) {
      console.error('TT analytics fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading || !data) {
    return (
      <div className="p-3 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-theme-primary mb-6">Track & Trace analytika</h1>
        <div className="text-theme-muted">Nacitani dat...</div>
      </div>
    )
  }

  const maxViews = data.viewsByDay.length > 0
    ? Math.max(...data.viewsByDay.map(d => d.views))
    : 1

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-theme-primary">Track & Trace analytika</h1>
          <p className="text-sm text-theme-muted mt-1">
            Statistiky zobrazeni verejne sledovaci stranky.
          </p>
        </div>
        <div className="flex bg-navy-800 rounded-lg border border-navy-600">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-3 py-2 text-sm transition-colors ${
                days === opt.value
                  ? 'bg-blue-600 text-white rounded-lg'
                  : 'text-theme-secondary hover:text-theme-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <StatsCards cards={[
        { label: 'Celkem zobrazeni', value: data.totalViews, bgColor: '#1e3a5f', valueColor: '#3B82F6' },
        { label: 'Unikatni navstevnici', value: data.uniqueVisitors, bgColor: '#1e293b', valueColor: '#8B5CF6' },
      ]} />

      {/* Views per day — CSS bar chart */}
      {data.viewsByDay.length > 0 && (
        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
          <h2 className="text-lg font-semibold text-theme-primary mb-4">Zobrazeni za den</h2>
          <div className="space-y-1.5">
            {data.viewsByDay.map((day) => {
              const pct = maxViews > 0 ? (day.views / maxViews) * 100 : 0
              const dateObj = new Date(day.date)
              const dateLabel = `${dateObj.getDate()}.${dateObj.getMonth() + 1}.`
              return (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="text-xs text-theme-muted w-12 text-right flex-shrink-0">{dateLabel}</span>
                  <div className="flex-1 h-5 bg-navy-700 rounded overflow-hidden">
                    <div
                      className="h-full rounded transition-all"
                      style={{
                        width: `${Math.max(pct, 1)}%`,
                        backgroundColor: '#3B82F6',
                      }}
                    />
                  </div>
                  <span className="text-xs text-theme-secondary w-10 text-right flex-shrink-0">{day.views}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top shipments */}
      {data.topShipments.length > 0 && (
        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
          <h2 className="text-lg font-semibold text-theme-primary mb-4">Nejsledovanejsi zasilky</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-600 text-theme-muted text-xs uppercase">
                  <th className="text-left py-3 px-3">#</th>
                  <th className="text-left py-3 px-3">Cislo dokladu</th>
                  <th className="text-left py-3 px-3">Sledovaci cislo</th>
                  <th className="text-right py-3 px-3">Zobrazeni</th>
                </tr>
              </thead>
              <tbody>
                {data.topShipments.map((s, i) => (
                  <tr key={i} className="border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors">
                    <td className="py-3 px-3 text-theme-muted">{i + 1}</td>
                    <td className="py-3 px-3 text-theme-primary font-medium">{s.doc_number}</td>
                    <td className="py-3 px-3 text-theme-secondary font-mono text-xs">{s.tracking_number}</td>
                    <td className="py-3 px-3 text-right text-blue-400 font-medium">{s.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.totalViews === 0 && (
        <div className="bg-navy-800 rounded-xl p-8 border border-navy-700 text-center">
          <div className="text-theme-muted text-lg mb-2">Zatim zadna zobrazeni</div>
          <p className="text-theme-muted text-sm">
            Zobrazeni se zaznamenavaji, kdyz zakaznici otevirou verejnou sledovaci stranku.
          </p>
        </div>
      )}
    </div>
  )
}
