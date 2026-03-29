import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { api } from '../../../services/api'

const PERIOD_OPTIONS = [
  { label: '7 dní', value: '7' },
  { label: '14 dní', value: '14' },
  { label: '30 dní', value: '30' },
  { label: '90 dní', value: '90' },
]

const BUCKET_LABELS = {
  '0': 'D+0',
  '1': 'D+1',
  '2': 'D+2',
  '3': 'D+3',
  '4': 'D+4',
  '5': 'D+5',
  '6': 'D+6',
  '7+': 'D+7+',
}

export default function AnalyticsDeliveryTime() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState('90')
  const [shipper, setShipper] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = { days }
      if (shipper) params.shipper = shipper
      const res = await api.get('/retino/analytics/delivery-time', { params })
      setData(res.data)
    } catch (err) {
      console.error('Delivery time fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [days, shipper])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading || !data) {
    return (
      <div className="p-3 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-theme-primary mb-6">Čas dodání</h1>
        <div className="text-theme-muted">Načítání dat...</div>
      </div>
    )
  }

  // Distribution chart data
  const distributionData = Object.entries(data.distribution).map(([bucket, count]) => ({
    name: BUCKET_LABELS[bucket] || bucket,
    count,
    pct: data.distributionPct[bucket] || 0,
  }))

  // Color based on bucket
  const getBarColor = (bucket) => {
    const idx = distributionData.findIndex(d => d.name === bucket)
    if (idx <= 1) return '#10B981' // D+0, D+1 = green
    if (idx <= 3) return '#3B82F6' // D+2, D+3 = blue
    if (idx <= 5) return '#F59E0B' // D+4, D+5 = amber
    return '#EF4444' // D+6+ = red
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-theme-primary">Čas dodání</h1>
          <p className="text-sm text-theme-muted mt-1">
            Analýza doby doručení zásilek podle dopravců.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data.carrierAvg.length > 0 && (
            <select
              value={shipper}
              onChange={(e) => setShipper(e.target.value)}
              className="bg-navy-800 border border-navy-600 text-theme-primary rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Všichni dopravci</option>
              {data.carrierAvg.map(c => (
                <option key={c.carrier} value={c.carrier}>{c.carrier}</option>
              ))}
            </select>
          )}
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
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700 text-center">
          <div className="text-4xl font-bold text-theme-primary">
            {data.avgDays !== null ? `${data.avgDays}` : '—'}
            <span className="text-lg text-theme-muted ml-1">D</span>
          </div>
          <div className="text-sm text-theme-muted mt-1">Průměrná doba doručení</div>
        </div>
        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700 text-center">
          <div className="text-4xl font-bold text-green-400">
            {data.distributionPct['0'] + data.distributionPct['1']}
            <span className="text-lg text-theme-muted ml-1">%</span>
          </div>
          <div className="text-sm text-theme-muted mt-1">Doručeno do D+1</div>
        </div>
        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700 text-center">
          <div className="text-4xl font-bold text-theme-secondary">
            {data.totalMeasured}
          </div>
          <div className="text-sm text-theme-muted mt-1">Změřených zásilek</div>
        </div>
      </div>

      {/* Distribution chart + sidebar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Bar chart */}
        <div className="col-span-2 bg-navy-800 rounded-xl p-5 border border-navy-700">
          <h2 className="text-lg font-semibold text-theme-primary mb-4">Distribuce doby doručení</h2>
          <div className="min-w-0">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={distributionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#e2e8f0', fontSize: 13 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(v, name) => [v, name === 'pct' ? '%' : 'Zásilek']}
              />
              <Bar dataKey="count" name="Zásilek" radius={[4, 4, 0, 0]} barSize={40}>
                {distributionData.map((entry, i) => (
                  <rect key={i} fill={getBarColor(entry.name)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* Sidebar distribution list */}
        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
          <h2 className="text-lg font-semibold text-theme-primary mb-4">Rozložení</h2>
          <div className="space-y-3">
            {distributionData.map((d) => (
              <div key={d.name} className="flex items-center gap-3">
                <span className="text-sm text-theme-secondary w-10">{d.name}</span>
                <div className="flex-1 h-3 bg-navy-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(d.pct, 100)}%`,
                      backgroundColor: getBarColor(d.name),
                    }}
                  />
                </div>
                <span className="text-sm text-theme-primary font-medium w-12 text-right">{d.pct} %</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-carrier averages */}
      {data.carrierAvg.length > 0 && (
        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
          <h2 className="text-lg font-semibold text-theme-primary mb-4">Průměrná doba doručení podle dopravce</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-600 text-theme-muted text-xs uppercase">
                  <th className="text-left py-3 px-3">Dopravce</th>
                  <th className="text-right py-3 px-3">Doručených zásilek</th>
                  <th className="text-right py-3 px-3">Průměr (dny)</th>
                  <th className="text-right py-3 px-3">D+0</th>
                  <th className="text-right py-3 px-3">D+1</th>
                  <th className="text-right py-3 px-3">D+2</th>
                  <th className="text-right py-3 px-3">D+3</th>
                  <th className="text-right py-3 px-3">D+4+</th>
                </tr>
              </thead>
              <tbody>
                {data.carrierAvg.map((c) => (
                  <tr key={c.carrier} className="border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors">
                    <td className="py-3 px-3 text-theme-primary font-medium">{c.carrier}</td>
                    <td className="py-3 px-3 text-right text-theme-secondary">{c.count}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`font-semibold ${
                        c.avgDays <= 1 ? 'text-green-400' :
                        c.avgDays <= 3 ? 'text-blue-400' :
                        c.avgDays <= 5 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {c.avgDays} D
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-theme-muted">{c.buckets['0'] || 0}</td>
                    <td className="py-3 px-3 text-right text-theme-muted">{c.buckets['1'] || 0}</td>
                    <td className="py-3 px-3 text-right text-theme-muted">{c.buckets['2'] || 0}</td>
                    <td className="py-3 px-3 text-right text-theme-muted">{c.buckets['3'] || 0}</td>
                    <td className="py-3 px-3 text-right text-theme-muted">
                      {(c.buckets['4'] || 0) + (c.buckets['5'] || 0) + (c.buckets['6'] || 0) + (c.buckets['7+'] || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
