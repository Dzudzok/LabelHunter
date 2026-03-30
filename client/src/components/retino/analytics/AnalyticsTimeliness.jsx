import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../services/api'
import StatsCards from '../shared/StatsCards'

const PERIOD_OPTIONS = [
  { label: '30 dni', value: '30' },
  { label: '60 dni', value: '60' },
  { label: '90 dni', value: '90' },
]

export default function AnalyticsTimeliness() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState('30')
  const [shipper, setShipper] = useState('')
  const [country, setCountry] = useState('')
  const [eddConfig, setEddConfig] = useState([])
  const [editingConfig, setEditingConfig] = useState(null)
  const [savingConfig, setSavingConfig] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = { days }
      if (shipper) params.shipper = shipper
      if (country) params.country = country
      const res = await api.get('/retino/analytics/timeliness', { params })
      setData(res.data)
    } catch (err) {
      console.error('Timeliness fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [days, shipper, country])

  const fetchEddConfig = useCallback(async () => {
    try {
      const res = await api.get('/retino/analytics/edd-config')
      setEddConfig(res.data)
    } catch (err) {
      console.error('EDD config fetch error:', err)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { fetchEddConfig() }, [fetchEddConfig])

  const handleSaveConfig = async (config) => {
    setSavingConfig(true)
    try {
      await api.post('/retino/analytics/edd-config', config)
      setEditingConfig(null)
      fetchEddConfig()
    } catch (err) {
      console.error('Save config error:', err)
    } finally {
      setSavingConfig(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="p-3 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-theme-primary mb-6">Vcasnost zasilek</h1>
        <div className="text-theme-muted">Nacitani dat...</div>
      </div>
    )
  }

  const carriers = Object.entries(data.byCarrier || {}).sort((a, b) => b[1].total - a[1].total)

  // CSS bar segments
  const totalAnalyzed = data.onTime + data.late + data.early
  const onTimePct = totalAnalyzed > 0 ? Math.round((data.onTime / totalAnalyzed) * 100) : 0
  const latePct = totalAnalyzed > 0 ? Math.round((data.late / totalAnalyzed) * 100) : 0
  const earlyPct = totalAnalyzed > 0 ? Math.round((data.early / totalAnalyzed) * 100) : 0

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-theme-primary">Vcasnost zasilek</h1>
          <p className="text-sm text-theme-muted mt-1">
            Porovnani ocekavaneho a skutecneho data doruceni.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data.countries?.length > 1 && (
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="bg-navy-800 border border-navy-600 text-theme-primary rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Vsechny zeme</option>
              {data.countries.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          <select
            value={shipper}
            onChange={(e) => setShipper(e.target.value)}
            className="bg-navy-800 border border-navy-600 text-theme-primary rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Vsichni dopravci</option>
            {carriers.map(([c]) => (
              <option key={c} value={c}>{c}</option>
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

      {/* Stats cards */}
      <StatsCards cards={[
        { label: 'Vcas', value: data.onTime + data.early, bgColor: '#064e3b', valueColor: '#10B981' },
        { label: 'Opozdeno', value: data.late, bgColor: '#7f1d1d', valueColor: '#EF4444' },
        { label: 'Drive', value: data.early, bgColor: '#1e3a5f', valueColor: '#3B82F6' },
        { label: 'Celkem analyzovano', value: data.total, bgColor: '#1e293b', valueColor: '#e2e8f0' },
        { label: 'Vcasnost', value: `${data.onTimePercent} %`, bgColor: '#1e293b', valueColor: data.onTimePercent >= 80 ? '#10B981' : '#F59E0B' },
      ]} />

      {/* Donut visual — CSS colored bar */}
      {totalAnalyzed > 0 && (
        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
          <h2 className="text-lg font-semibold text-theme-primary mb-4">Rozlozeni vcasnosti</h2>
          <div className="flex rounded-lg overflow-hidden h-8 mb-3">
            {earlyPct > 0 && (
              <div
                className="flex items-center justify-center text-xs font-medium text-white"
                style={{ width: `${earlyPct}%`, backgroundColor: '#3B82F6' }}
              >
                {earlyPct > 5 ? `${earlyPct}%` : ''}
              </div>
            )}
            {onTimePct > 0 && (
              <div
                className="flex items-center justify-center text-xs font-medium text-white"
                style={{ width: `${onTimePct}%`, backgroundColor: '#10B981' }}
              >
                {onTimePct > 5 ? `${onTimePct}%` : ''}
              </div>
            )}
            {latePct > 0 && (
              <div
                className="flex items-center justify-center text-xs font-medium text-white"
                style={{ width: `${latePct}%`, backgroundColor: '#EF4444' }}
              >
                {latePct > 5 ? `${latePct}%` : ''}
              </div>
            )}
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3B82F6' }} />
              <span className="text-theme-secondary">Drive ({data.early})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10B981' }} />
              <span className="text-theme-secondary">Vcas ({data.onTime})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#EF4444' }} />
              <span className="text-theme-secondary">Opozdeno ({data.late})</span>
            </div>
          </div>
        </div>
      )}

      {/* In progress */}
      {(data.inProgressOnTime > 0 || data.inProgressLate > 0) && (
        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
          <h2 className="text-lg font-semibold text-theme-primary mb-3">Probihajici zasilky</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-navy-700/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400">{data.inProgressOnTime}</div>
              <div className="text-xs text-theme-muted mt-1">V terminu</div>
            </div>
            <div className="bg-navy-700/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-400">{data.inProgressLate}</div>
              <div className="text-xs text-theme-muted mt-1">Po terminu</div>
            </div>
          </div>
        </div>
      )}

      {/* By carrier table */}
      {carriers.length > 0 && (
        <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
          <h2 className="text-lg font-semibold text-theme-primary mb-4">Vcasnost podle dopravce</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-600 text-theme-muted text-xs uppercase">
                  <th className="text-left py-3 px-3">Dopravce</th>
                  <th className="text-right py-3 px-3">Vcas</th>
                  <th className="text-right py-3 px-3">Opozdeno</th>
                  <th className="text-right py-3 px-3">Drive</th>
                  <th className="text-right py-3 px-3">Celkem</th>
                  <th className="text-right py-3 px-3">Vcasnost %</th>
                </tr>
              </thead>
              <tbody>
                {carriers.map(([carrier, stats]) => (
                  <tr key={carrier} className="border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors">
                    <td className="py-3 px-3 text-theme-primary font-medium">{carrier}</td>
                    <td className="py-3 px-3 text-right text-green-400">{stats.onTime}</td>
                    <td className="py-3 px-3 text-right text-red-400">{stats.late}</td>
                    <td className="py-3 px-3 text-right text-blue-400">{stats.early}</td>
                    <td className="py-3 px-3 text-right text-theme-secondary">{stats.total}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-navy-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(stats.percent, 100)}%`,
                              backgroundColor: stats.percent >= 80 ? '#10B981' : stats.percent >= 60 ? '#F59E0B' : '#EF4444'
                            }}
                          />
                        </div>
                        <span className="text-xs text-theme-secondary w-12 text-right">{Math.round(stats.percent * 10) / 10} %</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDD Config editor */}
      <div className="bg-navy-800 rounded-xl p-5 border border-navy-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-theme-primary">EDD konfigurace</h2>
          <button
            onClick={() => setEditingConfig({ shipper_code: '', country_code: 'CZ', business_days: 3, count_weekends: false })}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            + Pridat
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-600 text-theme-muted text-xs uppercase">
                <th className="text-left py-3 px-3">Dopravce</th>
                <th className="text-left py-3 px-3">Zeme</th>
                <th className="text-right py-3 px-3">Pracovni dny</th>
                <th className="text-center py-3 px-3">Pocita vikendy</th>
                <th className="text-right py-3 px-3">Akce</th>
              </tr>
            </thead>
            <tbody>
              {eddConfig.map((cfg) => (
                <tr key={cfg.id} className="border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors">
                  <td className="py-3 px-3 text-theme-primary font-medium">{cfg.shipper_code}</td>
                  <td className="py-3 px-3 text-theme-secondary">{cfg.country_code}</td>
                  <td className="py-3 px-3 text-right text-theme-secondary">{cfg.business_days}</td>
                  <td className="py-3 px-3 text-center text-theme-secondary">{cfg.count_weekends ? 'Ano' : 'Ne'}</td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => setEditingConfig({ ...cfg })}
                      className="text-blue-400 hover:text-blue-300 text-xs"
                    >
                      Upravit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Inline edit modal */}
        {editingConfig && (
          <div className="mt-4 p-4 bg-navy-700/50 rounded-lg border border-navy-600">
            <h3 className="text-sm font-semibold text-theme-primary mb-3">
              {editingConfig.id ? 'Upravit konfiguraci' : 'Nova konfigurace'}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-theme-muted mb-1">Dopravce</label>
                <input
                  type="text"
                  value={editingConfig.shipper_code}
                  onChange={(e) => setEditingConfig({ ...editingConfig, shipper_code: e.target.value })}
                  className="w-full bg-navy-800 border border-navy-600 text-theme-primary rounded-lg px-3 py-2 text-sm"
                  placeholder="GLS"
                />
              </div>
              <div>
                <label className="block text-xs text-theme-muted mb-1">Zeme</label>
                <input
                  type="text"
                  value={editingConfig.country_code}
                  onChange={(e) => setEditingConfig({ ...editingConfig, country_code: e.target.value })}
                  className="w-full bg-navy-800 border border-navy-600 text-theme-primary rounded-lg px-3 py-2 text-sm"
                  placeholder="CZ"
                />
              </div>
              <div>
                <label className="block text-xs text-theme-muted mb-1">Pracovni dny</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={editingConfig.business_days}
                  onChange={(e) => setEditingConfig({ ...editingConfig, business_days: parseInt(e.target.value) || 1 })}
                  className="w-full bg-navy-800 border border-navy-600 text-theme-primary rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-theme-muted mb-1">Pocita vikendy</label>
                <select
                  value={editingConfig.count_weekends ? 'true' : 'false'}
                  onChange={(e) => setEditingConfig({ ...editingConfig, count_weekends: e.target.value === 'true' })}
                  className="w-full bg-navy-800 border border-navy-600 text-theme-primary rounded-lg px-3 py-2 text-sm"
                >
                  <option value="false">Ne</option>
                  <option value="true">Ano</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => handleSaveConfig(editingConfig)}
                disabled={savingConfig || !editingConfig.shipper_code}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                {savingConfig ? 'Ukladam...' : 'Ulozit'}
              </button>
              <button
                onClick={() => setEditingConfig(null)}
                className="px-4 py-2 bg-navy-700 hover:bg-navy-600 text-theme-secondary text-sm rounded-lg transition-colors"
              >
                Zrusit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
