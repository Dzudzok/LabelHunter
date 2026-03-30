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
  // Unified import state
  const [importStep, setImportStep] = useState(null) // null | 'preview' | 'mapping'
  const [importFile, setImportFile] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [selectedSheet, setSelectedSheet] = useState(null)
  const [importType, setImportType] = useState('cost') // 'cost' | 'revenue'
  const [columnMap, setColumnMap] = useState({ tracking: '', cost: '', revenue: '', weight: '', invoice: '', date: '' })
  const [shipperCode, setShipperCode] = useState('')
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

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)
    setImportStep('preview')
    setImportResult(null)
    setImportPreview(null)
    setColumnMap({ tracking: '', cost: '', revenue: '', weight: '', invoice: '', date: '' })

    try {
      const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
      const body = isXlsx ? await file.arrayBuffer() : await file.text()
      const res = await api.post('/retino/costs/preview', body, {
        headers: { 'Content-Type': isXlsx ? 'application/octet-stream' : 'text/plain' },
        timeout: 30000,
      })
      setImportPreview(res.data)
      setSelectedSheet(res.data.sheets[0]?.name || null)
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || err.message })
      setImportStep(null)
    }
    e.target.value = ''
  }

  const handleImportMapped = async () => {
    if (!importFile) return
    setImporting(true)
    setImportResult(null)
    try {
      const isXlsx = importFile.name.endsWith('.xlsx') || importFile.name.endsWith('.xls')
      const body = isXlsx ? await importFile.arrayBuffer() : await importFile.text()
      const params = new URLSearchParams()
      if (selectedSheet) params.set('sheet', selectedSheet)
      params.set('importType', importType)
      if (columnMap.tracking) params.set('trackingCol', columnMap.tracking)
      if (columnMap.cost) params.set('costCol', columnMap.cost)
      if (columnMap.revenue) params.set('revenueCol', columnMap.revenue)
      if (columnMap.weight) params.set('weightCol', columnMap.weight)
      if (columnMap.invoice) params.set('invoiceCol', columnMap.invoice)
      if (columnMap.date) params.set('dateCol', columnMap.date)
      if (shipperCode) params.set('shipperCode', shipperCode)

      const res = await api.post(`/retino/costs/import-mapped?${params.toString()}`, body, {
        headers: { 'Content-Type': isXlsx ? 'application/octet-stream' : 'text/plain' },
        timeout: 180000,
      })
      setImportResult(res.data)
      setImportStep(null)
      fetchData()
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || err.message })
    } finally {
      setImporting(false)
    }
  }

  const cancelImport = () => {
    setImportStep(null)
    setImportFile(null)
    setImportPreview(null)
    setImportResult(null)
  }

  const currentSheetData = importPreview?.sheets?.find(s => s.name === selectedSheet)

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
    { label: 'Marže %', value: `${Math.round(data.marginPercent * 10) / 10}%`, bgColor: '#4c1d95', valueColor: '#a78bfa', labelColor: '#c4b5fd' },
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

          {/* Unified import */}
          <div className="bg-navy-800 rounded-xl p-4 mb-6">
            <h2 className="text-sm font-semibold text-theme-primary mb-3">Import dat</h2>

            {!importStep && (
              <>
                <p className="text-xs text-theme-muted mb-3">
                  Nahrajte CSV nebo XLSX soubor. Po nahrání si vyberete arkuš, typ importu a ručně namapujete sloupce.
                </p>
                <label className="cursor-pointer bg-navy-700 hover:bg-navy-600 text-theme-primary text-xs font-medium px-4 py-2 rounded-lg transition-colors inline-block">
                  Nahrát soubor (CSV/XLSX)
                  <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                </label>
              </>
            )}

            {/* Preview + Mapping */}
            {importStep && importPreview && (
              <div className="space-y-4">
                {/* Sheet selector (for XLSX) */}
                {importPreview.sheets.length > 1 && (
                  <div>
                    <label className="text-xs text-theme-muted block mb-1">Arkuš</label>
                    <div className="flex gap-1 flex-wrap">
                      {importPreview.sheets.map(s => (
                        <button key={s.name} onClick={() => { setSelectedSheet(s.name); setColumnMap({ tracking: '', cost: '', revenue: '', weight: '', invoice: '', date: '' }) }}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                            selectedSheet === s.name ? 'bg-blue-600 text-white' : 'bg-navy-700 text-theme-muted hover:bg-navy-600'
                          }`}>
                          {s.name} ({s.totalRows})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Import type */}
                <div>
                  <label className="text-xs text-theme-muted block mb-1">Typ importu</label>
                  <div className="flex gap-2">
                    <button onClick={() => setImportType('cost')}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${importType === 'cost' ? 'bg-red-600 text-white' : 'bg-navy-700 text-theme-muted'}`}>
                      Náklady (faktura od dopravce)
                    </button>
                    <button onClick={() => setImportType('revenue')}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${importType === 'revenue' ? 'bg-green-600 text-white' : 'bg-navy-700 text-theme-muted'}`}>
                      Příjmy (cena dopravy z Nextis)
                    </button>
                  </div>
                </div>

                {/* Sample data table */}
                {currentSheetData && (
                  <div className="overflow-x-auto">
                    <div className="text-xs text-theme-muted mb-1">Náhled ({currentSheetData.totalRows} řádků) — vyberte sloupce níže:</div>
                    <table className="w-full text-[10px] border border-navy-600">
                      <thead>
                        <tr className="bg-navy-700">
                          {currentSheetData.headers.map((h, i) => (
                            <th key={i} className="px-2 py-1.5 text-left text-theme-muted font-medium border-r border-navy-600 whitespace-nowrap max-w-[150px] truncate" title={h}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {currentSheetData.sampleRows.map((row, ri) => (
                          <tr key={ri} className="border-t border-navy-700">
                            {currentSheetData.headers.map((_, ci) => (
                              <td key={ci} className="px-2 py-1 text-theme-secondary border-r border-navy-700 whitespace-nowrap max-w-[150px] truncate" title={row[ci]}>
                                {row[ci] || ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Column mapping */}
                {currentSheetData && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {importType === 'cost' ? (
                      <>
                        <ColSelect label="Tracking *" value={columnMap.tracking} onChange={v => setColumnMap(p => ({ ...p, tracking: v }))} headers={currentSheetData.headers} />
                        <ColSelect label="Náklady (cena)" value={columnMap.cost} onChange={v => setColumnMap(p => ({ ...p, cost: v }))} headers={currentSheetData.headers} />
                        <ColSelect label="Váha" value={columnMap.weight} onChange={v => setColumnMap(p => ({ ...p, weight: v }))} headers={currentSheetData.headers} />
                        <ColSelect label="Číslo faktury" value={columnMap.invoice} onChange={v => setColumnMap(p => ({ ...p, invoice: v }))} headers={currentSheetData.headers} />
                        <ColSelect label="Datum" value={columnMap.date} onChange={v => setColumnMap(p => ({ ...p, date: v }))} headers={currentSheetData.headers} />
                        <div>
                          <label className="text-[10px] text-theme-muted block mb-0.5">Dopravce</label>
                          <input type="text" value={shipperCode} onChange={e => setShipperCode(e.target.value)}
                            placeholder="GLS, PPL..."
                            className="w-full bg-navy-700 border border-navy-600 text-theme-primary rounded px-2 py-1.5 text-xs" />
                        </div>
                      </>
                    ) : (
                      <>
                        <ColSelect label="Číslo faktury *" value={columnMap.invoice} onChange={v => setColumnMap(p => ({ ...p, invoice: v }))} headers={currentSheetData.headers} />
                        <ColSelect label="Cena dopravy *" value={columnMap.revenue} onChange={v => setColumnMap(p => ({ ...p, revenue: v }))} headers={currentSheetData.headers} />
                      </>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <button onClick={handleImportMapped} disabled={importing}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2 rounded-lg transition-colors">
                    {importing ? 'Importuji...' : `Importovat (${importType === 'cost' ? 'náklady' : 'příjmy'})`}
                  </button>
                  <button onClick={cancelImport} className="text-theme-muted text-xs hover:text-theme-primary">Zrušit</button>
                </div>
              </div>
            )}

            {/* Result */}
            {importResult && (
              <div className={`mt-3 text-xs p-3 rounded-lg ${importResult.error ? 'bg-red-900/30 text-red-300' : 'bg-green-900/30 text-green-300'}`}>
                {importResult.error
                  ? `Chyba: ${importResult.error}`
                  : importResult.importType === 'revenue'
                    ? `Řádků: ${importResult.totalRows} | Faktur: ${importResult.uniqueInvoices} | Aktualizováno: ${importResult.updated} | Vytvořeno: ${importResult.created} | Nenalezeno: ${importResult.notFound}`
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

function ColSelect({ label, value, onChange, headers }) {
  return (
    <div>
      <label className="text-[10px] text-theme-muted block mb-0.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-navy-700 border border-navy-600 text-theme-primary rounded px-2 py-1.5 text-xs">
        <option value="">— nevybráno —</option>
        {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
      </select>
    </div>
  )
}
