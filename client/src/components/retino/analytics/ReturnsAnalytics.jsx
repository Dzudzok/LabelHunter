import { useState, useEffect } from 'react'
import { api } from '../../../services/api'
import StatsCards from '../shared/StatsCards'

const TYPE_LABELS = { return: 'Vrácení', complaint: 'Reklamace', warranty: 'Záruka' }
const STATUS_LABELS = {
  new: 'Nová', awaiting_shipment: 'Čeká na odeslání', in_transit: 'V přepravě',
  received: 'Přijato', under_review: 'Posuzování', approved: 'Schváleno',
  rejected: 'Zamítnuto', refund_pending: 'Čeká na refundaci', refunded: 'Vráceno',
  resolved: 'Vyřízeno', cancelled: 'Zrušeno',
}
const RESOLUTION_LABELS = { refund: 'Vrácení peněz', replacement: 'Výměna', repair: 'Oprava', rejected: 'Zamítnuto' }

export default function ReturnsAnalytics() {
  const [overview, setOverview] = useState(null)
  const [reasons, setReasons] = useState([])
  const [resTime, setResTime] = useState(null)
  const [products, setProducts] = useState([])
  const [trend, setTrend] = useState([])
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [oRes, rRes, rtRes, pRes, tRes] = await Promise.all([
        api.get('/retino/returns-analytics/overview', { params: { days } }),
        api.get('/retino/returns-analytics/reasons', { params: { days } }),
        api.get('/retino/returns-analytics/resolution-time', { params: { days } }),
        api.get('/retino/returns-analytics/by-product', { params: { days } }),
        api.get('/retino/returns-analytics/trend', { params: { days } }),
      ])
      setOverview(oRes.data)
      setReasons(rRes.data || [])
      setResTime(rtRes.data)
      setProducts(pRes.data || [])
      setTrend(tRes.data || [])
    } catch (err) {
      console.error('Analytics fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [days])

  const statsCards = overview ? [
    { label: 'Celkem', value: overview.total, bgColor: '#1e293b', valueColor: '#fff' },
    { label: 'Vyřízeno', value: overview.resolvedCount, bgColor: '#064e3b', valueColor: '#10B981' },
    { label: 'Průměr vyřízení', value: overview.avgResolutionDays ? `${overview.avgResolutionDays}d` : '-', bgColor: '#1e1b4b', valueColor: '#8B5CF6' },
    { label: 'Refundováno', value: `${overview.totalRefunded.toLocaleString()} Kč`, bgColor: '#451a03', valueColor: '#F59E0B' },
  ] : []

  if (loading) return <div className="bg-navy-900 text-theme-muted flex items-center justify-center h-full">Načítání...</div>

  return (
    <div className="bg-navy-900 text-theme-primary p-3 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-bold">Analytika vrácení</h1>
        <div className="flex gap-1">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${days === d ? 'bg-blue-600 text-white' : 'bg-navy-700 text-theme-muted'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {overview && <StatsCards cards={statsCards} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {/* Status breakdown */}
        <div className="bg-navy-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Podle statusu</h3>
          <div className="space-y-2">
            {Object.entries(overview?.byStatus || {}).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <span>{STATUS_LABELS[status] || status}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-navy-600 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(count / overview.total) * 100}%` }} />
                  </div>
                  <span className="text-theme-muted w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Type breakdown */}
        <div className="bg-navy-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Podle typu</h3>
          <div className="space-y-2">
            {Object.entries(overview?.byType || {}).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-sm">
                <span>{TYPE_LABELS[type] || type}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-navy-600 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(count / overview.total) * 100}%` }} />
                  </div>
                  <span className="text-theme-muted w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-sm font-semibold text-theme-muted mb-3 mt-6 uppercase tracking-wider">Způsob řešení</h3>
          <div className="space-y-2">
            {Object.entries(overview?.byResolution || {}).sort((a, b) => b[1] - a[1]).map(([res, count]) => (
              <div key={res} className="flex items-center justify-between text-sm">
                <span>{RESOLUTION_LABELS[res] || res}</span>
                <span className="text-theme-muted">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top reasons */}
        <div className="bg-navy-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Nejčastější důvody</h3>
          <div className="space-y-2">
            {reasons.slice(0, 10).map((r, i) => (
              <div key={r.code} className="flex items-center justify-between text-sm">
                <span>
                  <span className="text-theme-muted mr-2">{i + 1}.</span>
                  {r.label}
                </span>
                <span className="font-bold">{r.count}</span>
              </div>
            ))}
            {reasons.length === 0 && <div className="text-theme-muted text-center py-4">Žádná data</div>}
          </div>
        </div>

        {/* Resolution time */}
        {resTime && (
          <div className="bg-navy-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Doba vyřízení (dny)</h3>
            <div className="space-y-2">
              {Object.entries(resTime.buckets).map(([bucket, count]) => {
                const total = Object.values(resTime.buckets).reduce((s, v) => s + v, 0);
                return (
                  <div key={bucket} className="flex items-center justify-between text-sm">
                    <span>{bucket} dní</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-navy-600 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: total ? `${(count / total) * 100}%` : '0%' }} />
                      </div>
                      <span className="text-theme-muted w-8 text-right">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {resTime.byType?.length > 0 && (
              <>
                <h4 className="text-xs font-semibold text-theme-muted mt-4 mb-2">Průměr dle typu</h4>
                {resTime.byType.map(t => (
                  <div key={t.type} className="flex items-center justify-between text-sm">
                    <span>{TYPE_LABELS[t.type] || t.type}</span>
                    <span className="text-theme-muted">{t.avgDays}d ({t.count}x)</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Trend chart (simple bar) */}
        {trend.length > 0 && (
          <div className="bg-navy-800 rounded-xl p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Trend ({days}d)</h3>
            <div className="flex items-end gap-0.5 h-32">
              {trend.map(d => {
                const maxCount = Math.max(...trend.map(t => t.count), 1);
                const h = (d.count / maxCount) * 100;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center" title={`${d.date}: ${d.count}`}>
                    <div className="w-full bg-blue-500 rounded-t" style={{ height: `${h}%`, minHeight: d.count > 0 ? '4px' : '0' }} />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-theme-muted mt-1">
              <span>{trend[0]?.date}</span>
              <span>{trend[trend.length - 1]?.date}</span>
            </div>
          </div>
        )}

        {/* Top products */}
        {products.length > 0 && (
          <div className="bg-navy-800 rounded-xl p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Nejvracenější produkty</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-theme-muted text-xs border-b border-navy-700">
                  <th className="text-left py-1">Kód</th>
                  <th className="text-left py-1">Značka</th>
                  <th className="text-left py-1">Produkt</th>
                  <th className="text-right py-1">Vrácení</th>
                  <th className="text-right py-1">Ks</th>
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 20).map(p => (
                  <tr key={p.code} className="border-b border-navy-700/30">
                    <td className="py-1.5 font-mono text-xs">{p.code}</td>
                    <td className="py-1.5 text-theme-muted text-xs">{p.brand}</td>
                    <td className="py-1.5">{p.text}</td>
                    <td className="py-1.5 text-right font-bold">{p.returnCount}</td>
                    <td className="py-1.5 text-right text-theme-muted">{p.totalQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
