import { useState, useEffect } from 'react'
import { usePackageStore } from '../../store/packageStore'
import CarrierLogo from '../retino/tracking/CarrierLogo'

const STATUS_LABEL = {
  pending: 'Oczekuje',
  scanning: 'Skanowanie',
  verified: 'Sprawdzono',
  label_generated: 'Etykieta',
  shipped: 'Wysłano',
  delivered: 'Doręczono',
  returned: 'Zwrócono',
  problem: 'Problem',
}
const STATUS_COLOR = {
  pending: 'bg-gray-500',
  scanning: 'bg-yellow-500',
  verified: 'bg-blue-400',
  label_generated: 'bg-blue-600',
  shipped: 'bg-green-500',
  delivered: 'bg-green-700',
  returned: 'bg-gray-600',
  problem: 'bg-red-500',
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

export default function StatsModal({ date, onClose }) {
  const { fetchStats } = usePackageStore()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(date)

  useEffect(() => {
    setLoading(true)
    fetchStats(selectedDate)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedDate])

  const maxShipper = stats ? Math.max(...Object.values(stats.byShipper || {}), 1) : 1
  const maxWorkerScanned = stats ? Math.max(...(stats.workers || []).map(w => w.scanned), 1) : 1
  const maxWorkerLabeled = stats ? Math.max(...(stats.workers || []).map(w => w.labeled), 1) : 1

  return (
    <div className="fixed inset-0 overlay-bg z-50 flex items-start justify-center pt-4 px-4 overflow-y-auto">
      <div className="bg-navy-800 border border-navy-600 rounded-2xl w-full max-w-4xl mb-8">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-theme-primary">Statystyki</h2>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-navy-900 border border-navy-600 rounded-lg px-3 py-1 text-theme-primary text-sm outline-none focus:border-brand-orange"
            />
          </div>
          <button onClick={onClose} className="text-theme-secondary hover:text-theme-primary text-2xl min-h-0 leading-none">&times;</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-theme-secondary text-lg">Ładowanie statystyk...</div>
        ) : !stats ? (
          <div className="flex items-center justify-center py-20 text-red-400">Błąd ładowania</div>
        ) : (
          <div className="px-6 py-6 flex flex-col gap-6">

            {/* Top summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-navy-700 rounded-xl p-5 border border-navy-600 text-center">
                <div className="text-4xl font-black text-theme-primary">{stats.total}</div>
                <div className="text-theme-secondary mt-1 text-sm font-semibold uppercase tracking-wide">Razem</div>
              </div>
              <div className="bg-green-900/40 rounded-xl p-5 border border-green-700 text-center">
                <div className="text-4xl font-black text-green-400">{stats.done}</div>
                <div className="text-theme-secondary mt-1 text-sm font-semibold uppercase tracking-wide">Wysłano</div>
              </div>
              <div className="bg-red-900/30 rounded-xl p-5 border border-red-800 text-center">
                <div className="text-4xl font-black text-red-400">{stats.pending}</div>
                <div className="text-theme-secondary mt-1 text-sm font-semibold uppercase tracking-wide">Do realizacji</div>
              </div>
            </div>

            {/* Labels per minute */}
            {(stats.labelsPerMinute || stats.currentTempo) && (
              <div className="bg-navy-700 rounded-xl p-5 border border-navy-600">
                <h3 className="text-base font-bold text-theme-secondary mb-3 uppercase tracking-wide">Tempo pracy</h3>
                <div className="flex gap-8">
                  {stats.currentTempo && (
                    <div className="flex items-center gap-3">
                      <div className="text-3xl font-black text-green-400">{stats.currentTempo}</div>
                      <div className="text-theme-secondary text-sm">/ min<br/><span className="text-xs text-theme-muted">ostatnie 30 min</span></div>
                    </div>
                  )}
                  {stats.labelsPerMinute && (
                    <div className="flex items-center gap-3">
                      <div className="text-3xl font-black text-brand-orange">{stats.labelsPerMinute}</div>
                      <div className="text-theme-secondary text-sm">/ min<br/><span className="text-xs text-theme-muted">średnia dnia</span></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* By status */}
              <div className="bg-navy-700 rounded-xl p-5 border border-navy-600">
                <h3 className="text-base font-bold text-theme-secondary mb-4 uppercase tracking-wide">Wg statusu</h3>
                <div className="flex flex-col gap-3">
                  {Object.entries(stats.byStatus || {})
                    .sort((a, b) => b[1] - a[1])
                    .map(([status, count]) => (
                      <div key={status}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[status] || 'bg-gray-500'}`} />
                            <span className="text-theme-secondary">{STATUS_LABEL[status] || status}</span>
                          </span>
                        </div>
                        <Bar value={count} max={stats.total} color={STATUS_COLOR[status] || 'bg-gray-500'} />
                      </div>
                    ))}
                </div>
              </div>

              {/* By shipper */}
              <div className="bg-navy-700 rounded-xl p-5 border border-navy-600">
                <h3 className="text-base font-bold text-theme-secondary mb-4 uppercase tracking-wide">Wg przewoźnika</h3>
                {Object.keys(stats.byShipper || {}).length === 0 ? (
                  <div className="text-theme-muted text-sm">Brak przesyłek z przewoźnikiem</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {Object.entries(stats.byShipper)
                      .sort((a, b) => b[1] - a[1])
                      .map(([shipper, count]) => (
                        <div key={shipper}>
                          <div className="mb-1"><CarrierLogo carrier={shipper} size="sm" showFlag={false} /></div>
                          <Bar value={count} max={maxShipper} color="bg-brand-orange" />
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* By worker */}
              <div className="bg-navy-700 rounded-xl p-5 border border-navy-600 md:col-span-2">
                <h3 className="text-base font-bold text-theme-secondary mb-4 uppercase tracking-wide">Pracownicy</h3>
                {(stats.workers || []).length === 0 ? (
                  <div className="text-theme-muted text-sm">Brak danych o pracownikach (dane zbierane od teraz)</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {stats.workers.sort((a, b) => (b.scanned + b.labeled) - (a.scanned + a.labeled)).map((w, i) => (
                      <div key={i} className="bg-navy-800 rounded-xl p-4 border border-navy-600">
                        <div className="text-theme-primary font-bold text-base mb-3">{w.name}</div>
                        <div className="flex flex-col gap-2">
                          <div>
                            <div className="text-theme-secondary text-xs mb-1">Kontrolował</div>
                            <Bar value={w.scanned} max={maxWorkerScanned} color="bg-blue-500" />
                          </div>
                          <div>
                            <div className="text-theme-secondary text-xs mb-1">Drukował etykiety</div>
                            <Bar value={w.labeled} max={maxWorkerLabeled} color="bg-green-500" />
                          </div>
                          {w.labelsPerMinute && (
                            <div className="text-xs text-theme-muted mt-1">
                              Tempo: <span className="text-brand-orange font-bold">{w.labelsPerMinute}</span> etykiet/min
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* History */}
            {(stats.history || []).length > 0 && (
              <div className="bg-navy-700 rounded-xl border border-navy-600 overflow-hidden">
                <div className="px-5 py-3 border-b border-navy-600">
                  <h3 className="text-base font-bold text-theme-secondary uppercase tracking-wide">Historia druków</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-theme-muted text-left border-b border-navy-600 text-xs uppercase">
                        <th className="px-4 py-2 font-semibold">Czas</th>
                        <th className="px-4 py-2 font-semibold">Faktura</th>
                        <th className="px-4 py-2 font-semibold">Klient</th>
                        <th className="px-4 py-2 font-semibold">Przewoźnik</th>
                        <th className="px-4 py-2 font-semibold">Kontrolował</th>
                        <th className="px-4 py-2 font-semibold">Drukował</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.history.map((h, i) => (
                        <tr key={i} className="border-b border-navy-600/50 hover:bg-navy-600/30">
                          <td className="px-4 py-2 text-theme-secondary whitespace-nowrap">
                            {h.label_generated_at
                              ? new Date(h.label_generated_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </td>
                          <td className="px-4 py-2 text-theme-primary font-mono font-semibold">
                            {h.invoice_number || h.doc_number}
                          </td>
                          <td className="px-4 py-2 text-theme-secondary truncate max-w-[140px]">{h.customer_name}</td>
                          <td className="px-4 py-2">
                            {h.shipper_code && (
                              <CarrierLogo carrier={h.shipper_code} size="xs" showFlag={false} />
                            )}
                          </td>
                          <td className="px-4 py-2 text-theme-secondary">{h.scan_worker || <span className="text-theme-muted">—</span>}</td>
                          <td className="px-4 py-2 text-theme-secondary">{h.label_worker || <span className="text-theme-muted">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
