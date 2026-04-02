import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../services/api'
import StatusBadge from '../shared/StatusBadge'
import CarrierLogo from './CarrierLogo'

const CARRIERS = ['GLS CZ', 'GLS EU', 'PPL CZ', 'PPL EU', 'DPD', 'UPS', 'Zasilkovna', 'CP', 'FOFR']

export default function TrackingOverview() {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/retino/tracking/dashboard')
      setDashboard(res.data)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  if (loading || !dashboard) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-black text-theme-primary mb-6">Nástěnka</h1>
        <div className="text-theme-muted">Načítání...</div>
      </div>
    )
  }

  const sc = dashboard.statusCounts || {}
  const total = dashboard.total || 0
  const delivered = sc.delivered || 0
  const inTransit = (sc.in_transit || 0) + (sc.out_for_delivery || 0) + (sc.handed_to_carrier || 0)
  const pickup = sc.available_for_pickup || 0
  const problems = (sc.failed_delivery || 0) + (sc.returned_to_sender || 0)
  const deliveryRate = total > 0 ? Math.round((delivered / total) * 1000) / 10 : 0

  const carrierStats = dashboard.carrierStats || {}
  const sortedCarriers = Object.entries(carrierStats).sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-theme-primary">Nástěnka</h1>
        <p className="text-sm text-theme-muted">Přehled sledování zásilek za posledních 30 dní</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Celkem zásilek" value={total} color="#e2e8f0" bg="#1e293b" />
        <KpiCard label="Doručeno" value={delivered} color="#10B981" bg="#064e3b" />
        <KpiCard label="Na cestě" value={inTransit} color="#8B5CF6" bg="#1e1b4b" />
        <KpiCard label="K vyzvednutí" value={pickup} color="#F59E0B" bg="#451a03" />
        <KpiCard label="Míra doručení" value={`${deliveryRate} %`} color={deliveryRate >= 80 ? '#10B981' : '#F59E0B'} bg="#1e293b" />
      </div>

      {/* Status distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status breakdown */}
        <div className="bg-navy-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-theme-primary mb-4">Zásilky podle stavu</h3>
          <div className="space-y-2">
            {[
              { label: 'Doručeno', value: delivered, color: '#10B981', pct: total > 0 ? Math.round(delivered/total*100) : 0 },
              { label: 'V přepravě', value: sc.in_transit || 0, color: '#8B5CF6', pct: total > 0 ? Math.round((sc.in_transit||0)/total*100) : 0 },
              { label: 'Předáno dopravci', value: sc.handed_to_carrier || 0, color: '#6366F1', pct: total > 0 ? Math.round((sc.handed_to_carrier||0)/total*100) : 0 },
              { label: 'Na doručení', value: sc.out_for_delivery || 0, color: '#3B82F6', pct: total > 0 ? Math.round((sc.out_for_delivery||0)/total*100) : 0 },
              { label: 'K vyzvednutí', value: pickup, color: '#F59E0B', pct: total > 0 ? Math.round(pickup/total*100) : 0 },
              { label: 'Nedoručeno', value: sc.failed_delivery || 0, color: '#EF4444', pct: total > 0 ? Math.round((sc.failed_delivery||0)/total*100) : 0 },
              { label: 'Vráceno', value: sc.returned_to_sender || 0, color: '#EF4444', pct: total > 0 ? Math.round((sc.returned_to_sender||0)/total*100) : 0 },
              { label: 'Vytvořeno', value: sc.label_created || 0, color: '#9CA3AF', pct: total > 0 ? Math.round((sc.label_created||0)/total*100) : 0 },
            ].filter(s => s.value > 0).map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="text-xs text-theme-muted w-28 shrink-0">{s.label}</span>
                <div className="flex-1 h-2 bg-navy-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(s.pct, 1)}%`, backgroundColor: s.color }} />
                </div>
                <span className="text-xs font-bold text-theme-secondary w-12 text-right">{s.value}</span>
                <span className="text-[10px] text-theme-muted w-10 text-right">{s.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Problem summary */}
        <div className="bg-navy-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-theme-primary mb-4">Problémy</h3>
          {problems > 0 ? (
            <div>
              <div className="text-4xl font-black text-red-400 mb-1">{problems}</div>
              <div className="text-sm text-theme-muted mb-4">problémových zásilek</div>
              <div className="space-y-2">
                {(sc.failed_delivery || 0) > 0 && (
                  <div className="flex items-center gap-2 bg-red-500/10 rounded-lg p-2.5">
                    <span className="text-red-400 text-lg">⚠️</span>
                    <div>
                      <div className="text-xs font-bold text-red-400">Nedoručeno</div>
                      <div className="text-xs text-theme-muted">{sc.failed_delivery} zásilek</div>
                    </div>
                  </div>
                )}
                {(sc.returned_to_sender || 0) > 0 && (
                  <div className="flex items-center gap-2 bg-red-500/10 rounded-lg p-2.5">
                    <span className="text-red-400 text-lg">↩️</span>
                    <div>
                      <div className="text-xs font-bold text-red-400">Vráceno odesílateli</div>
                      <div className="text-xs text-theme-muted">{sc.returned_to_sender} zásilek</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-sm text-theme-muted">Žádné problémy</div>
            </div>
          )}
        </div>
      </div>

      {/* Carrier stats table */}
      {sortedCarriers.length > 0 && (
        <div className="bg-navy-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-theme-primary mb-4">Dopravní společnosti</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-600 text-theme-muted text-[11px] uppercase">
                  <th className="text-left py-2.5 px-3 font-semibold">Dopravce</th>
                  <th className="text-right py-2.5 px-3 font-semibold">Celkem</th>
                  <th className="text-right py-2.5 px-3 font-semibold">Na cestě</th>
                  <th className="text-right py-2.5 px-3 font-semibold">Doručeno</th>
                  <th className="text-right py-2.5 px-3 font-semibold">K vyzvednutí</th>
                  <th className="text-right py-2.5 px-3 font-semibold">Problémy</th>
                  <th className="text-right py-2.5 px-3 font-semibold">Doručeno %</th>
                </tr>
              </thead>
              <tbody>
                {sortedCarriers.map(([carrier, stats]) => {
                  const dPct = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 1000) / 10 : 0
                  return (
                    <tr key={carrier} className="border-b border-navy-700/50 hover:bg-navy-700/30">
                      <td className="py-2.5 px-3">
                        <CarrierLogo carrier={carrier} size="sm" />
                      </td>
                      <td className="py-2.5 px-3 text-right text-theme-secondary">{stats.total}</td>
                      <td className="py-2.5 px-3 text-right text-purple-400">{stats.in_transit || 0}</td>
                      <td className="py-2.5 px-3 text-right text-green-400">{stats.delivered || 0}</td>
                      <td className="py-2.5 px-3 text-right text-yellow-400">{stats.pickup || 0}</td>
                      <td className="py-2.5 px-3 text-right text-red-400">{stats.problem || 0}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`font-bold ${dPct >= 80 ? 'text-green-400' : dPct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {dPct}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, color, bg }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: bg }}>
      <div className="text-2xl font-black" style={{ color }}>{value}</div>
      <div className="text-xs text-theme-muted mt-1">{label}</div>
    </div>
  )
}
