import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import CarrierLogo from '../tracking/CarrierLogo'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { api } from '../../../services/api'
import StatusBadge from '../shared/StatusBadge'

const PERIOD_OPTIONS = [
  { label: '7 dní', value: '7' },
  { label: '14 dní', value: '14' },
  { label: '30 dní', value: '30' },
  { label: '90 dní', value: '90' },
]

const PROBLEM_LABELS = {
  failed_delivery: 'Nedoručeno',
  returned_to_sender: 'Vráceno odesílateli',
  problem: 'Problém',
}

const PROBLEM_COLORS = {
  failed_delivery: '#F59E0B',
  returned_to_sender: '#EF4444',
  problem: '#DC2626',
}

export default function AnalyticsProblems() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState('90')
  const [shipper, setShipper] = useState('')
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = { days }
      if (shipper) params.shipper = shipper
      const res = await api.get('/retino/analytics/problems', { params })
      setData(res.data)
    } catch (err) {
      console.error('Problems fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [days, shipper])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading || !data) {
    return (
      <div className="p-3 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-theme-primary mb-6">Problémy</h1>
        <div className="text-theme-muted">Načítání dat...</div>
      </div>
    )
  }

  // Carrier problems bar chart
  const carrierBarData = data.carrierProblems.map(c => ({
    name: c.carrier,
    problems: c.problems,
    rate: c.problemRate,
  }))

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-theme-primary">Problémy</h1>
          <p className="text-sm text-theme-muted mt-1">
            Přehled problémových zásilek a analýza chybovosti dopravců.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data.carrierProblems.length > 0 && (
            <select
              value={shipper}
              onChange={(e) => setShipper(e.target.value)}
              className="bg-navy-800 border border-navy-600 text-theme-primary rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Všichni dopravci</option>
              {data.carrierProblems.map(c => (
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Celkem zásilek"
          value={data.totalShipments}
        />
        <KpiCard
          label="Problémové zásilky"
          value={data.totalProblems}
          valueColor="#EF4444"
        />
        <KpiCard
          label="Míra problémů"
          value={`${data.problemRate} %`}
          valueColor={data.problemRate > 5 ? '#EF4444' : data.problemRate > 2 ? '#F59E0B' : '#10B981'}
        />
        <KpiCard
          label="Vráceno odesílateli"
          value={data.byStatus.returned_to_sender || 0}
          valueColor="#EF4444"
        />
      </div>

      {/* Problem breakdown by status + trend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* By status */}
        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
          <h2 className="text-lg font-semibold text-theme-primary mb-4">Problémy podle typu</h2>
          <div className="space-y-4">
            {Object.entries(data.byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: PROBLEM_COLORS[status] }}
                  />
                  <span className="text-sm text-theme-secondary">{PROBLEM_LABELS[status]}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-theme-primary">{count}</span>
                  <span className="text-xs text-theme-muted">
                    ({data.totalProblems > 0 ? Math.round((count / data.totalProblems) * 100) : 0} %)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trend chart */}
        <div className="col-span-2 bg-navy-800 rounded-xl p-5 border border-navy-700">
          <h2 className="text-lg font-semibold text-theme-primary mb-4">Trend problémů</h2>
          {data.problemTrend.length > 0 ? (
            <div className="min-w-0">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.problemTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={(d) => {
                    const dt = new Date(d)
                    return `${dt.getDate()}.${dt.getMonth() + 1}.`
                  }}
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                  labelStyle={{ color: '#e2e8f0' }}
                  labelFormatter={(d) => {
                    const dt = new Date(d)
                    return `${dt.getDate()}.${dt.getMonth() + 1}.${dt.getFullYear()}`
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Problémy"
                  stroke="#EF4444"
                  fill="#EF4444"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-theme-muted">
              Žádné problémy v daném období
            </div>
          )}
        </div>
      </div>

      {/* Carrier problems */}
      {carrierBarData.length > 0 && (
        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
          <h2 className="text-lg font-semibold text-theme-primary mb-4">Problémy podle dopravce</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-600 text-theme-muted text-xs uppercase">
                  <th className="text-left py-3 px-3">Dopravce</th>
                  <th className="text-right py-3 px-3">Celkem zásilek</th>
                  <th className="text-right py-3 px-3">Problémů</th>
                  <th className="text-right py-3 px-3">Míra problémů</th>
                  <th className="text-right py-3 px-3">Nedoručeno</th>
                  <th className="text-right py-3 px-3">Vráceno</th>
                  <th className="text-right py-3 px-3">Jiný problém</th>
                </tr>
              </thead>
              <tbody>
                {data.carrierProblems.map((c) => (
                  <tr key={c.carrier} className="border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors">
                    <td className="py-3 px-3"><CarrierLogo carrier={c.carrier} size="sm" /></td>
                    <td className="py-3 px-3 text-right text-theme-secondary">{c.carrierTotal}</td>
                    <td className="py-3 px-3 text-right text-red-400 font-semibold">{c.problems}</td>
                    <td className="py-3 px-3 text-right">
                      <ProblemRateBar pct={c.problemRate} />
                    </td>
                    <td className="py-3 px-3 text-right text-theme-muted">{c.failed_delivery}</td>
                    <td className="py-3 px-3 text-right text-theme-muted">{c.returned_to_sender}</td>
                    <td className="py-3 px-3 text-right text-theme-muted">{c.problem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent problems */}
      {data.recentProblems.length > 0 && (
        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
          <h2 className="text-lg font-semibold text-theme-primary mb-4">Poslední problémové zásilky</h2>
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
                {data.recentProblems.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/retino/tracking/${p.id}`)}
                  >
                    <td className="py-2.5 px-3 text-theme-muted text-xs">
                      {p.date_issued ? new Date(p.date_issued).toLocaleDateString('cs-CZ') : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-theme-primary font-mono text-xs">{p.doc_number}</td>
                    <td className="py-2.5 px-3 text-theme-secondary">{p.customer_name || '—'}</td>
                    <td className="py-2.5 px-3 text-theme-secondary font-mono">{p.shipper_code}</td>
                    <td className="py-2.5 px-3 text-theme-muted font-mono text-xs">{p.tracking_number}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={p.status} /></td>
                    <td className="py-2.5 px-3 text-theme-muted text-xs max-w-[200px] truncate">
                      {p.description || '—'}
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

function KpiCard({ label, value, valueColor }) {
  return (
    <div className="bg-navy-800 rounded-xl p-4 border border-navy-700">
      <div className="text-xs text-theme-muted mb-1">{label}</div>
      <div className="text-xl sm:text-2xl font-bold" style={{ color: valueColor || '#e2e8f0' }}>
        {value}
      </div>
    </div>
  )
}

function ProblemRateBar({ pct }) {
  const color = pct >= 10 ? '#EF4444' : pct >= 5 ? '#F59E0B' : '#10B981'
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-2 bg-navy-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(pct * 2, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-medium" style={{ color }}>{pct} %</span>
    </div>
  )
}
