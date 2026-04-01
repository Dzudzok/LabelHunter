import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { api } from '../../../services/api'

const PERIOD_OPTIONS = [
  { label: '7 dní', value: '7' },
  { label: '14 dní', value: '14' },
  { label: '30 dní', value: '30' },
  { label: '90 dní', value: '90' },
]

const BUCKET_LABELS = { '0': 'D+0', '1': 'D+1', '2': 'D+2', '3': 'D+3', '4': 'D+4', '5': 'D+5', '6': 'D+6', '7+': '≥D+7' }

export default function AnalyticsDeliveryTime() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState('90')
  const [shipper, setShipper] = useState('')
  const [country, setCountry] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = { days }
      if (shipper) params.shipper = shipper
      if (country) params.country = country
      const res = await api.get('/retino/analytics/delivery-time', { params })
      setData(res.data)
    } catch {} finally { setLoading(false) }
  }, [days, shipper, country])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading || !data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-black text-theme-primary mb-6">Čas dodání</h1>
        <div className="text-theme-muted">Načítání dat...</div>
      </div>
    )
  }

  const distributionData = Object.entries(data.distribution).map(([bucket, count]) => ({
    name: BUCKET_LABELS[bucket] || bucket, count,
  }))

  const otdDistData = Object.entries(data.otdDistribution || {}).map(([bucket, count]) => ({
    name: BUCKET_LABELS[bucket] || bucket, count,
  }))
  const hasOtdData = otdDistData.some(d => d.count > 0)

  const brDistData = Object.entries(data.brDistribution || {}).map(([bucket, count]) => ({
    name: BUCKET_LABELS[bucket] || bucket, count,
  }))
  const hasBrData = brDistData.some(d => d.count > 0)

  const dailyTrend = data.dailyTrend || []

  const tooltipStyle = { backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }
  const tooltipLabel = { color: '#e2e8f0' }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-theme-primary">Čas dodání</h1>
          <p className="text-sm text-theme-muted">Analyzujte dobu doručení během různých stavů přepravy</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {data.countries?.length > 1 && (
            <select value={country} onChange={e => setCountry(e.target.value)}
              className="bg-navy-800 border border-navy-600 text-theme-primary rounded-lg px-2 py-1.5 text-sm">
              <option value="">Země</option>
              {data.countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {data.carrierAvg?.length > 0 && (
            <select value={shipper} onChange={e => setShipper(e.target.value)}
              className="bg-navy-800 border border-navy-600 text-theme-primary rounded-lg px-2 py-1.5 text-sm">
              <option value="">Dopravce</option>
              {data.carrierAvg.map(c => <option key={c.carrier} value={c.carrier}>{c.carrier}</option>)}
            </select>
          )}
          <div className="flex bg-navy-800 rounded-lg border border-navy-600">
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setDays(opt.value)}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  days === opt.value ? 'bg-blue-600 text-white rounded-lg' : 'text-theme-secondary hover:text-theme-primary'
                }`}>{opt.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Průměrná doba doručení" value={data.avgDays != null ? `${data.avgDays}` : '—'} unit="D" />
        <KpiCard label="95% zásilek do" value={data.p95Days != null ? `${data.p95Days}` : '—'} unit="D" sub="pouze 5% trvá déle" />
        <KpiCard label="Medián doručení" value={data.medianDays != null ? `${data.medianDays}` : '—'} unit="D" sub="polovina zásilek do" />
        <KpiCard label="Doručených zásilek" value={`${data.totalMeasured}`} unit="" sub="za období" />
      </div>

      {/* Chart 1: Počet zásilek za období (line) */}
      {dailyTrend.length > 0 && (
        <ChartCard title="Počet zásilek za období" subtitle="Zobrazuje počet doručených zásilek v průběhu času">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={d => d.substring(5)} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} />
              <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} dot={false} name="Zásilek" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Charts row: 3 line charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {dailyTrend.length > 0 && (
          <ChartCard title="Avg in transit" subtitle="Průměrný čas od převzetí do doručení">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={d => d.substring(8)} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} />
                <Line type="monotone" dataKey="avgTransit" stroke="#8B5CF6" strokeWidth={2} dot={false} name="Dní" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {dailyTrend.length > 0 && (
          <ChartCard title="Avg order-to-delivery" subtitle="Průměrný čas od objednání do doručení">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={d => d.substring(8)} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} />
                <Line type="monotone" dataKey="avgOtd" stroke="#3B82F6" strokeWidth={2} dot={false} name="Dní" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {dailyTrend.length > 0 && (
          <ChartCard title="Avg days at branch" subtitle="Průměrný čas na pobočce do vyzvednutí">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={d => d.substring(8)} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} />
                <Line type="monotone" dataKey="avgBranch" stroke="#F59E0B" strokeWidth={2} dot={false} name="Dní" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {/* Delivery type split */}
      {data.byType && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <TypeCard label="Všechny zásilky" icon="📊" stats={data.byType.all} />
          <TypeCard label="Na adresu (kurýr)" icon="🏠" stats={data.byType.address}
            subtitle="Čas přepravy = štítek → doručeno na adresu" />
          <TypeCard label="Na pobočku (pickup)" icon="🏪" stats={data.byType.pickup}
            subtitle="Čas přepravy = štítek → dorazilo na pobočku (bez čekání klienta)" />
        </div>
      )}

      {/* Charts row: 3 distribution bar charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="In transit distribution" subtitle="Rozložení doby přepravy (převzetí → doručení)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={distributionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} />
              <Bar dataKey="count" fill="#8B5CF6" radius={[4,4,0,0]} name="Zásilek" />
            </BarChart>
          </ResponsiveContainer>
          {data.avgDays !== null && <div className="text-xs text-theme-muted mt-1">Průměr: {data.avgDays} D</div>}
        </ChartCard>

        {hasOtdData ? (
          <ChartCard title="Order-to-delivery distribution" subtitle="Rozložení doby od objednání do doručení">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={otdDistData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} />
                <Bar dataKey="count" fill="#3B82F6" radius={[4,4,0,0]} name="Zásilek" />
              </BarChart>
            </ResponsiveContainer>
            {data.avgOtd != null && <div className="text-xs text-theme-muted mt-1">Průměr: {data.avgOtd} D</div>}
          </ChartCard>
        ) : (
          <ChartCard title="Order-to-delivery distribution" subtitle="Rozložení doby od objednání do doručení">
            <div className="text-center py-10 text-theme-muted text-sm">Žádná data — date_issued chybí u zásilek</div>
          </ChartCard>
        )}

        {hasBrData ? (
          <ChartCard title="Days at branch distribution" subtitle="Rozložení doby na pobočce">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={brDistData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} />
                <Bar dataKey="count" fill="#F59E0B" radius={[4,4,0,0]} name="Zásilek" />
              </BarChart>
            </ResponsiveContainer>
            {data.avgBranch != null && <div className="text-xs text-theme-muted mt-1">Průměr: {data.avgBranch} D</div>}
          </ChartCard>
        ) : (
          <ChartCard title="Days at branch distribution" subtitle="Rozložení doby na pobočce">
            <div className="text-center py-10 text-theme-muted text-sm">Žádná data — pickup_at chybí u zásilek</div>
          </ChartCard>
        )}
      </div>

      {/* Per-carrier table */}
      {data.carrierAvg?.length > 0 && (
        <div className="bg-navy-800 rounded-xl p-5">
          <h2 className="text-sm font-bold text-theme-primary mb-4">Průměrná doba doručení podle dopravce</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-600 text-theme-muted text-xs uppercase">
                  <th className="text-left py-3 px-3">Dopravce</th>
                  <th className="text-right py-3 px-3">Doručených</th>
                  <th className="text-right py-3 px-3">Průměr</th>
                  <th className="text-right py-3 px-3">D+0</th>
                  <th className="text-right py-3 px-3">D+1</th>
                  <th className="text-right py-3 px-3">D+2</th>
                  <th className="text-right py-3 px-3">D+3</th>
                  <th className="text-right py-3 px-3">D+4+</th>
                </tr>
              </thead>
              <tbody>
                {data.carrierAvg.map(c => (
                  <tr key={c.carrier} className="border-b border-navy-700/50 hover:bg-navy-700/30">
                    <td className="py-3 px-3 text-theme-primary font-medium">{c.carrier}</td>
                    <td className="py-3 px-3 text-right text-theme-secondary">{c.count}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`font-semibold ${c.avgDays <= 1 ? 'text-green-400' : c.avgDays <= 3 ? 'text-blue-400' : c.avgDays <= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
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

function TypeCard({ label, icon, stats, subtitle }) {
  if (!stats || stats.count === 0) {
    return (
      <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{icon}</span>
          <span className="text-sm font-bold text-theme-primary">{label}</span>
        </div>
        <div className="text-sm text-theme-muted">Žádná data</div>
      </div>
    )
  }
  return (
    <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-bold text-theme-primary">{label}</span>
      </div>
      {subtitle && <p className="text-[10px] text-theme-muted mb-3">{subtitle}</p>}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-2xl font-black text-theme-primary">{stats.avg}<span className="text-sm text-theme-muted ml-0.5">D</span></div>
          <div className="text-[10px] text-theme-muted">Průměr</div>
        </div>
        <div>
          <div className="text-2xl font-black text-theme-primary">{stats.median}<span className="text-sm text-theme-muted ml-0.5">D</span></div>
          <div className="text-[10px] text-theme-muted">Medián</div>
        </div>
        <div>
          <div className="text-2xl font-black text-theme-primary">{stats.p95}<span className="text-sm text-theme-muted ml-0.5">D</span></div>
          <div className="text-[10px] text-theme-muted">95%</div>
        </div>
      </div>
      <div className="text-xs text-theme-muted mt-2">{stats.count} zásilek</div>
    </div>
  )
}

function KpiCard({ label, value, unit, sub }) {
  return (
    <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
      <div className="text-xs text-theme-muted mb-2">{label}</div>
      <div className="text-3xl font-black text-theme-primary">
        {value}<span className="text-lg text-theme-muted ml-1">{unit}</span>
      </div>
      {sub && <div className="text-xs text-theme-muted mt-1">{sub}</div>}
    </div>
  )
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
      <h3 className="text-sm font-bold text-theme-primary">{title}</h3>
      {subtitle && <p className="text-xs text-theme-muted mb-3">{subtitle}</p>}
      {children}
    </div>
  )
}
