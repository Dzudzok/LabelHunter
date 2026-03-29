import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { api } from '../../../services/api'
import { TRACKING_COLORS, TRACKING_LABELS } from '../shared/StatusBadge'

const PERIOD_OPTIONS = [
  { label: '7 dní', value: '7' },
  { label: '14 dní', value: '14' },
  { label: '30 dní', value: '30' },
  { label: '90 dní', value: '90' },
]

export default function AnalyticsOverview() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState('90')
  const [shipper, setShipper] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = { days }
      if (shipper) params.shipper = shipper
      const res = await api.get('/retino/analytics/overview', { params })
      setData(res.data)
    } catch (err) {
      console.error('Analytics fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [days, shipper])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading || !data) {
    return (
      <div className="p-3 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-theme-primary mb-6">Analytický přehled</h1>
        <div className="text-theme-muted">Načítání dat...</div>
      </div>
    )
  }

  // Prepare status pie data
  const statusPieData = Object.entries(data.statusCounts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: TRACKING_LABELS[key] || key,
      value,
      color: TRACKING_COLORS[key]?.bg || '#6B7280',
    }))

  // Carrier volume bar data
  const carrierVolumeData = data.carrierTable.map(c => ({
    name: c.carrier,
    total: c.total,
    pct: data.total > 0 ? Math.round((c.total / data.total) * 1000) / 10 : 0,
  }))

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-theme-primary">Analytický přehled</h1>
          <p className="text-sm text-theme-muted mt-1">
            Celkové statistiky výkonu vašeho doručování.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={shipper}
            onChange={(e) => setShipper(e.target.value)}
            className="bg-navy-800 border border-navy-600 text-theme-primary rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Všichni dopravci</option>
            {data.carrierTable.map(c => (
              <option key={c.carrier} value={c.carrier}>{c.carrier}</option>
            ))}
          </select>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Celkový počet zásilek" value={data.total} />
        <KpiCard label="Doručeno" value={data.delivered} valueColor="#10B981" />
        <KpiCard
          label="Míra doručení"
          value={`${data.deliveryRate} %`}
          valueColor={data.deliveryRate >= 80 ? '#10B981' : data.deliveryRate >= 50 ? '#F59E0B' : '#EF4444'}
        />
        <KpiCard
          label="V přepravě"
          value={
            (data.statusCounts?.in_transit || 0) +
            (data.statusCounts?.out_for_delivery || 0) +
            (data.statusCounts?.handed_to_carrier || 0)
          }
          valueColor="#8B5CF6"
        />
      </div>

      {/* Volume chart */}
      <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
        <h2 className="text-lg font-semibold text-theme-primary mb-1">Počet zásilek za období</h2>
        <p className="text-xs text-theme-muted mb-4">
          Zobrazuje počet zásilek importovaných do Retino Tracking v průběhu času.
        </p>
        <div className="min-w-0">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data.volumeTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={(d) => {
                const dt = new Date(d)
                return `${dt.getDate()}.${dt.getMonth() + 1}.`
              }}
            />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
              itemStyle={{ color: '#60a5fa' }}
              labelFormatter={(d) => {
                const dt = new Date(d)
                return `${dt.getDate()}.${dt.getMonth() + 1}.${dt.getFullYear()}`
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              name="Zásilky"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
        </div>
      </div>

      {/* Volume by carrier + Status pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* Volume by carrier */}
        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
          <h2 className="text-lg font-semibold text-theme-primary mb-1">Volume by carrier</h2>
          <p className="text-xs text-theme-muted mb-4">Shows the volume of shippings per carrier.</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={carrierVolumeData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#e2e8f0', fontSize: 12 }} width={90} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                formatter={(v, name, entry) => [`${entry.payload.total} (${v} %)`, 'Zásilky']}
              />
              <Bar dataKey="pct" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status breakdown pie */}
        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
          <h2 className="text-lg font-semibold text-theme-primary mb-1">Zásilky podle stavu</h2>
          <p className="text-xs text-theme-muted mb-4">Počet zásilek podle aktuálního stavu.</p>
          <div className="flex items-start gap-4">
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie
                  data={statusPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  strokeWidth={0}
                >
                  {statusPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5 pt-2">
              {statusPieData.map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-theme-secondary">{entry.name}</span>
                  </div>
                  <span className="text-theme-primary font-medium">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Carrier performance table */}
      <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
        <h2 className="text-lg font-semibold text-theme-primary mb-4">Statistiky dopravců</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-600 text-theme-muted text-xs uppercase">
                <th className="text-left py-3 px-3">Dopravní společnost</th>
                <th className="text-right py-3 px-3">Počet zásilek</th>
                <th className="text-right py-3 px-3">Na cestě</th>
                <th className="text-right py-3 px-3">Doručeno</th>
                <th className="text-right py-3 px-3">Nedoručeno</th>
                <th className="text-right py-3 px-3">K vyzvednutí</th>
                <th className="text-right py-3 px-3">Míra doručení</th>
              </tr>
            </thead>
            <tbody>
              {data.carrierTable.map((c) => (
                <tr key={c.carrier} className="border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors">
                  <td className="py-3 px-3 text-theme-primary font-medium">{c.carrier}</td>
                  <td className="py-3 px-3 text-right text-theme-secondary">{c.total}</td>
                  <td className="py-3 px-3 text-right text-theme-secondary">
                    {c.in_transit > 0 && <>{c.inTransitPct} %</>}
                    {c.in_transit === 0 && <span className="text-theme-muted">0 %</span>}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={c.deliveredPct >= 80 ? 'text-green-400' : 'text-theme-secondary'}>
                      {c.deliveredPct} %
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={c.problemPct > 5 ? 'text-red-400' : 'text-theme-secondary'}>
                      {c.problemPct} %
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-theme-secondary">{c.pickupPct} %</td>
                  <td className="py-3 px-3 text-right">
                    <DeliveryRateBar pct={c.deliveredPct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, valueColor }) {
  return (
    <div className="bg-navy-800 rounded-xl p-4 border border-navy-700">
      <div className="text-xs text-theme-muted mb-1">{label}</div>
      <div className="text-xl sm:text-2xl font-bold" style={{ color: valueColor || '#e2e8f0' }}>
        {value}
      </div>
      {sub && <div className="text-xs text-theme-muted mt-0.5">{sub}</div>}
    </div>
  )
}

function DeliveryRateBar({ pct }) {
  const color = pct >= 90 ? '#10B981' : pct >= 70 ? '#F59E0B' : '#EF4444'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-navy-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-theme-secondary">{pct} %</span>
    </div>
  )
}
