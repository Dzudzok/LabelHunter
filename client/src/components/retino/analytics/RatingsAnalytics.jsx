import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../services/api'
import StatsCards from '../shared/StatsCards'

const PERIOD_OPTIONS = [
  { label: '7 dní', value: '7' },
  { label: '14 dní', value: '14' },
  { label: '30 dní', value: '30' },
  { label: '90 dní', value: '90' },
]

const PROBLEM_LABELS = {
  late_delivery: 'Pozdní doručení',
  damaged_package: 'Poškozená zásilka',
  wrong_item: 'Špatná položka',
  poor_packaging: 'Špatné balení',
  rude_courier: 'Nezdvořilý kurýr',
  other: 'Jiné',
}

const RATING_COLORS = {
  5: '#10B981',
  4: '#6EE7B7',
  3: '#FBBF24',
  2: '#F97316',
  1: '#EF4444',
}

function StarRating({ rating, max = 5 }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i < Math.round(rating) ? 'text-yellow-400' : 'text-navy-600'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  )
}

export default function RatingsAnalytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState('30')
  const [shipper, setShipper] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = { days }
      if (shipper) params.shipper = shipper
      const res = await api.get('/retino/ratings/analytics', { params })
      setData(res.data)
    } catch (err) {
      console.error('Ratings analytics fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [days, shipper])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading || !data) {
    return (
      <div className="p-3 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-theme-primary mb-6">Hodnocení dopravy</h1>
        <div className="text-theme-muted">Načítání dat...</div>
      </div>
    )
  }

  const totalRatings = data.totalRatings || 0

  if (totalRatings === 0) {
    return (
      <div className="p-3 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-theme-primary mb-6">Hodnocení dopravy</h1>
        <div className="bg-navy-800 rounded-xl p-8 border border-navy-700 text-center">
          <div className="text-4xl mb-3">📭</div>
          <div className="text-theme-primary font-semibold text-lg">Zatím žádná hodnocení</div>
          <div className="text-theme-muted text-sm mt-1">
            Hodnocení se zobrazí, jakmile zákazníci začnou hodnotit doručení.
          </div>
        </div>
      </div>
    )
  }

  const statsCards = [
    {
      value: `${data.averageRating?.toFixed(1) ?? '—'} / 5`,
      label: 'Průměrné hodnocení',
      bgColor: '#1e293b',
      valueColor: '#FBBF24',
    },
    {
      value: totalRatings.toLocaleString('cs-CZ'),
      label: 'Celkem hodnocení',
      bgColor: '#1e293b',
      valueColor: '#fff',
    },
    {
      value: `${data.satisfiedPercent?.toFixed(1) ?? '—'} %`,
      label: 'Spokojení zákazníci',
      bgColor: '#1e293b',
      valueColor: '#10B981',
    },
  ]

  // Rating distribution
  const distribution = data.ratingDistribution || {}
  const maxDistCount = Math.max(...Object.values(distribution), 1)

  // Problem breakdown
  const problems = data.problemBreakdown || {}
  const maxProblemCount = Math.max(...Object.values(problems), 1)

  // By carrier
  const byCarrier = data.byCarrier || {}
  const carrierEntries = Object.entries(byCarrier)

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-theme-primary">Hodnocení dopravy</h1>
          <p className="text-sm text-theme-muted mt-1">
            Přehled hodnocení a spokojenosti zákazníků s doručením.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {carrierEntries.length > 0 && (
            <select
              value={shipper}
              onChange={(e) => setShipper(e.target.value)}
              className="bg-navy-800 border border-navy-600 text-theme-primary rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Všichni dopravci</option>
              {carrierEntries.map(([name]) => (
                <option key={name} value={name}>{name}</option>
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

      {/* Stats cards */}
      <StatsCards cards={statsCards} />

      {/* Rating distribution + Problem breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Rating distribution */}
        <div className="col-span-1 sm:col-span-2 bg-navy-800 rounded-xl p-5 border border-navy-700">
          <h2 className="text-lg font-semibold text-theme-primary mb-4">Rozložení hodnocení</h2>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = distribution[String(star)] || 0
              const pct = totalRatings > 0 ? ((count / totalRatings) * 100).toFixed(1) : '0.0'
              const barWidth = maxDistCount > 0 ? (count / maxDistCount) * 100 : 0

              return (
                <div key={star} className="flex items-center gap-3">
                  <span className="text-sm text-theme-secondary w-16 flex items-center gap-1">
                    {star}
                    <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </span>
                  <div className="flex-1 h-4 bg-navy-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: RATING_COLORS[star],
                      }}
                    />
                  </div>
                  <span className="text-sm text-theme-primary font-medium w-10 text-right">{count}</span>
                  <span className="text-sm text-theme-muted w-14 text-right">{pct} %</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Problem breakdown */}
        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
          <h2 className="text-lg font-semibold text-theme-primary mb-4">Oblasti pro zlepšení</h2>
          {Object.keys(problems).length === 0 ? (
            <div className="text-theme-muted text-sm">Žádné nahlášené problémy.</div>
          ) : (
            <div className="space-y-3">
              {Object.entries(problems)
                .sort(([, a], [, b]) => b - a)
                .map(([key, count]) => {
                  const barWidth = maxProblemCount > 0 ? (count / maxProblemCount) * 100 : 0
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-theme-secondary">
                          {PROBLEM_LABELS[key] || key}
                        </span>
                        <span className="text-sm text-theme-primary font-medium">{count}</span>
                      </div>
                      <div className="h-2 bg-navy-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all bg-red-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>

      {/* By carrier table */}
      {carrierEntries.length > 0 && (
        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
          <h2 className="text-lg font-semibold text-theme-primary mb-4">Hodnocení podle dopravce</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-600 text-theme-muted text-xs uppercase">
                  <th className="text-left py-3 px-3">Dopravce</th>
                  <th className="text-right py-3 px-3">Průměrné hodnocení</th>
                  <th className="text-center py-3 px-3">Hvězdy</th>
                </tr>
              </thead>
              <tbody>
                {carrierEntries
                  .sort(([, a], [, b]) => b - a)
                  .map(([carrier, avgRating]) => (
                    <tr key={carrier} className="border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors">
                      <td className="py-3 px-3 text-theme-primary font-medium">{carrier}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={`font-semibold ${
                          avgRating >= 4.5 ? 'text-green-400' :
                          avgRating >= 3.5 ? 'text-blue-400' :
                          avgRating >= 2.5 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {avgRating.toFixed(1)} / 5
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <StarRating rating={avgRating} />
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
