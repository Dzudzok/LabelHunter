import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../services/api'
import StatsCards from '../shared/StatsCards'

const PERIOD_OPTIONS = [
  { label: '7d', value: '7' },
  { label: '14d', value: '14' },
  { label: '30d', value: '30' },
  { label: '90d', value: '90' },
]

function formatCZK(val) {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(val)
}

export default function CostAnalysis() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState('30')
  const [importResult, setImportResult] = useState(null)
  const [importing, setImporting] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState({
    tracking_number: '',
    shipper_code: '',
    cost_amount: '',
    revenue_amount: '',
    weight_kg: '',
    invoice_number: '',
    invoice_date: '',
  })
  const [manualMsg, setManualMsg] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/retino/costs/analytics', { params: { days } })
      setData(res.data)
    } catch (err) {
      console.error('Failed to load cost analytics:', err)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCSVUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const text = await file.text()
      const res = await api.post('/retino/costs/import', text, {
        headers: { 'Content-Type': 'text/plain' },
      })
      setImportResult(res.data)
      fetchData()
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || err.message })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const handleManualSubmit = async (e) => {
    e.preventDefault()
    setManualMsg(null)
    try {
      await api.post('/retino/costs', {
        ...manualForm,
        cost_amount: parseFloat(manualForm.cost_amount) || 0,
        revenue_amount: parseFloat(manualForm.revenue_amount) || 0,
        weight_kg: manualForm.weight_kg ? parseFloat(manualForm.weight_kg) : null,
      })
      setManualMsg({ ok: true, text: 'Záznam uložen' })
      setManualForm({ tracking_number: '', shipper_code: '', cost_amount: '', revenue_amount: '', weight_kg: '', invoice_number: '', invoice_date: '' })
      fetchData()
    } catch (err) {
      setManualMsg({ ok: false, text: err.response?.data?.error || err.message })
    }
  }

  const statsCards = data ? [
    { label: 'Celkové příjmy', value: formatCZK(data.totalRevenue), bgColor: '#064e3b', valueColor: '#34d399', labelColor: '#6ee7b7' },
    { label: 'Celkové náklady', value: formatCZK(data.totalCost), bgColor: '#7f1d1d', valueColor: '#f87171', labelColor: '#fca5a5' },
    { label: 'Celková marže', value: formatCZK(data.totalMargin), bgColor: '#1e3a5f', valueColor: '#60a5fa', labelColor: '#93c5fd' },
    { label: 'Marže %', value: `${data.marginPercent}%`, bgColor: '#4c1d95', valueColor: '#a78bfa', labelColor: '#c4b5fd' },
  ] : []

  const carriers = data ? Object.entries(data.byCarrier).sort((a, b) => b[1].revenue - a[1].revenue) : []

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold text-theme-primary">Analýza nákladů</h1>
        <div className="flex gap-1 bg-navy-800 rounded-lg p-1">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                days === opt.value
                  ? 'bg-orange-500 text-white'
                  : 'text-theme-muted hover:text-theme-primary hover:bg-navy-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-theme-muted">Načítání...</div>
      ) : data ? (
        <>
          {/* Stats cards */}
          <StatsCards cards={statsCards} />

          <div className="text-xs text-theme-muted mb-6">
            Analyzováno zásilek: {data.analyzedShipments} | Nespárované faktury: {data.unmatchedInvoices}
          </div>

          {/* By carrier table */}
          <div className="bg-navy-800 rounded-xl overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-navy-700">
              <h2 className="text-sm font-semibold text-theme-primary">Podle dopravce</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-theme-muted text-xs border-b border-navy-700">
                    <th className="text-left px-4 py-2.5 font-medium">Dopravce</th>
                    <th className="text-right px-4 py-2.5 font-medium">Příjmy</th>
                    <th className="text-right px-4 py-2.5 font-medium">Náklady</th>
                    <th className="text-right px-4 py-2.5 font-medium">Marže</th>
                    <th className="text-right px-4 py-2.5 font-medium">Marže %</th>
                    <th className="text-right px-4 py-2.5 font-medium">Počet</th>
                  </tr>
                </thead>
                <tbody>
                  {carriers.map(([name, c]) => {
                    const pct = c.revenue > 0 ? ((c.margin / c.revenue) * 100).toFixed(1) : '0.0'
                    return (
                      <tr key={name} className="border-b border-navy-700 hover:bg-navy-700/50 transition-colors">
                        <td className="px-4 py-2.5 text-theme-primary font-medium">{name}</td>
                        <td className="px-4 py-2.5 text-right text-green-400">{formatCZK(c.revenue)}</td>
                        <td className="px-4 py-2.5 text-right text-red-400">{formatCZK(c.cost)}</td>
                        <td className="px-4 py-2.5 text-right text-blue-400">{formatCZK(c.margin)}</td>
                        <td className="px-4 py-2.5 text-right text-theme-muted">{pct}%</td>
                        <td className="px-4 py-2.5 text-right text-theme-muted">{c.count}</td>
                      </tr>
                    )
                  })}
                  {carriers.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-theme-muted">Žádná data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly trend */}
          <div className="bg-navy-800 rounded-xl overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-navy-700">
              <h2 className="text-sm font-semibold text-theme-primary">Měsíční trend</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-theme-muted text-xs border-b border-navy-700">
                    <th className="text-left px-4 py-2.5 font-medium">Měsíc</th>
                    <th className="text-right px-4 py-2.5 font-medium">Příjmy</th>
                    <th className="text-right px-4 py-2.5 font-medium">Náklady</th>
                    <th className="text-right px-4 py-2.5 font-medium">Marže</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.byMonth || []).map(m => (
                    <tr key={m.month} className="border-b border-navy-700 hover:bg-navy-700/50 transition-colors">
                      <td className="px-4 py-2.5 text-theme-primary font-medium">{m.month}</td>
                      <td className="px-4 py-2.5 text-right text-green-400">{formatCZK(m.revenue)}</td>
                      <td className="px-4 py-2.5 text-right text-red-400">{formatCZK(m.cost)}</td>
                      <td className="px-4 py-2.5 text-right text-blue-400">{formatCZK(m.margin)}</td>
                    </tr>
                  ))}
                  {(!data.byMonth || data.byMonth.length === 0) && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-theme-muted">Žádná data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* CSV import */}
          <div className="bg-navy-800 rounded-xl p-4 mb-6">
            <h2 className="text-sm font-semibold text-theme-primary mb-3">Import CSV</h2>
            <p className="text-xs text-theme-muted mb-3">
              Sloupce: tracking_number, shipper_code, cost_amount, revenue_amount, weight_kg, invoice_number, invoice_date
            </p>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer bg-navy-700 hover:bg-navy-600 text-theme-primary text-xs font-medium px-4 py-2 rounded-lg transition-colors">
                {importing ? 'Importuji...' : 'Vybrat CSV soubor'}
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleCSVUpload}
                  disabled={importing}
                  className="hidden"
                />
              </label>
            </div>
            {importResult && (
              <div className={`mt-3 text-xs p-3 rounded-lg ${importResult.error ? 'bg-red-900/30 text-red-300' : 'bg-green-900/30 text-green-300'}`}>
                {importResult.error
                  ? `Chyba: ${importResult.error}`
                  : `Importováno: ${importResult.imported} | Spárováno: ${importResult.matched} | Nespárováno: ${importResult.unmatched}`
                }
              </div>
            )}
          </div>

          {/* Manual entry */}
          <div className="bg-navy-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowManual(!showManual)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-navy-700/50 transition-colors"
            >
              <h2 className="text-sm font-semibold text-theme-primary">Ruční zadání</h2>
              <svg className={`w-4 h-4 text-theme-muted transition-transform ${showManual ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {showManual && (
              <form onSubmit={handleManualSubmit} className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { key: 'tracking_number', label: 'Tracking číslo', required: true },
                    { key: 'shipper_code', label: 'Dopravce' },
                    { key: 'cost_amount', label: 'Náklady (Kč)', type: 'number' },
                    { key: 'revenue_amount', label: 'Příjmy (Kč)', type: 'number' },
                    { key: 'weight_kg', label: 'Váha (kg)', type: 'number' },
                    { key: 'invoice_number', label: 'Číslo faktury' },
                    { key: 'invoice_date', label: 'Datum faktury', type: 'date' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-theme-muted block mb-1">{f.label}</label>
                      <input
                        type={f.type || 'text'}
                        value={manualForm[f.key]}
                        onChange={e => setManualForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                        required={f.required}
                        step={f.type === 'number' ? '0.01' : undefined}
                        className="w-full bg-navy-700 border border-navy-700 rounded-lg px-3 py-2 text-sm text-theme-primary placeholder-theme-muted focus:outline-none focus:border-orange-500/50"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    Uložit
                  </button>
                  {manualMsg && (
                    <span className={`text-xs ${manualMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
                      {manualMsg.text}
                    </span>
                  )}
                </div>
              </form>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-theme-muted">Nepodařilo se načíst data</div>
      )}
    </div>
  )
}
