import { useState, useEffect } from 'react'
import { api } from '../../services/api'

export default function TransportMapModal({ onClose }) {
  const [rows, setRows] = useState([])
  const [shippers, setShippers] = useState([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.get('/config/transport-map').then(r => setRows(r.data)).catch(console.error)
    api.get('/labelprinter/shippers')
      .then(r => setShippers(Array.isArray(r.data) ? r.data : (r.data?.data || [])))
      .catch(console.error)
  }, [])

  const update = (i, field, value) => {
    setRows(prev => prev.map((row, idx) =>
      idx === i ? { ...row, [field]: value || null, ...(field === 'shipperCode' ? { serviceCode: null } : {}) } : row
    ))
  }

  const addRow = () => {
    setRows(prev => [...prev, { nextisName: '', shipperCode: null, serviceCode: null }])
  }

  const removeRow = (i) => {
    setRows(prev => prev.filter((_, idx) => idx !== i))
  }

  const save = async () => {
    setSaving(true)
    setMsg('')
    try {
      await api.put('/config/transport-map', rows)
      setMsg('✓ Zapisano')
      setTimeout(() => setMsg(''), 3000)
    } catch (err) {
      setMsg('✗ Błąd: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const servicesFor = (code) => shippers.find(s => s.code === code)?.services || []

  return (
    <div className="fixed inset-0 overlay-bg z-50 flex items-start justify-center pt-8 px-4 overflow-y-auto">
      <div className="bg-navy-800 border border-navy-600 rounded-2xl w-full max-w-4xl">
        {/* Nagłówek */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700">
          <h2 className="text-xl font-bold text-theme-primary">Mapowanie przewoźników (LP)</h2>
          <button onClick={onClose} className="text-theme-secondary hover:text-theme-primary text-2xl min-h-0 leading-none">&times;</button>
        </div>

        {/* Tabela */}
        <div className="px-6 py-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-theme-secondary text-left border-b border-navy-700">
                <th className="pb-2 pr-4 font-semibold">Nazwa usługi (LP)</th>
                <th className="pb-2 pr-4 font-semibold">Przewoźnik (LP)</th>
                <th className="pb-2 pr-4 font-semibold">Usługa (LP)</th>
                <th className="pb-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-navy-700/50">
                  <td className="py-2 pr-4">
                    <input
                      value={row.nextisName || ''}
                      onChange={e => update(i, 'nextisName', e.target.value)}
                      className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-theme-primary text-sm outline-none focus:border-brand-orange"
                      placeholder="Nazwa usługi z LP (transport_name)..."
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <select
                      value={row.shipperCode || ''}
                      onChange={e => update(i, 'shipperCode', e.target.value)}
                      className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-theme-primary text-sm outline-none focus:border-brand-orange"
                    >
                      <option value="">— Odbiór osobisty —</option>
                      {shippers.map(s => (
                        <option key={s.code} value={s.code}>{s.name || s.code} ({s.code})</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-4">
                    {row.shipperCode ? (
                      <select
                        value={row.serviceCode || ''}
                        onChange={e => update(i, 'serviceCode', e.target.value)}
                        className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-theme-primary text-sm outline-none focus:border-brand-orange"
                      >
                        <option value="">— Wybierz usługę —</option>
                        {servicesFor(row.shipperCode).map(svc => (
                          <option key={svc.code} value={svc.code}>
                            {svc.code}{svc.name ? ` — ${svc.name}` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-theme-muted px-3">—</span>
                    )}
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => removeRow(i)}
                      className="text-red-500 hover:text-red-300 px-2 py-1 min-h-0 text-lg leading-none"
                      title="Usuń wiersz"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            onClick={addRow}
            className="mt-3 text-brand-orange hover:text-orange-300 text-sm font-semibold min-h-0"
          >
            + Dodaj wiersz
          </button>
        </div>

        {/* Stopka */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-navy-700">
          <span className={`text-sm font-semibold ${msg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
            {msg}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="bg-navy-600 hover:bg-navy-500 text-theme-secondary px-5 py-2 rounded-xl text-base font-semibold min-h-0"
            >
              Zamknij
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="bg-brand-orange hover:bg-orange-500 text-white px-6 py-2 rounded-xl text-base font-bold disabled:opacity-50 min-h-0"
            >
              {saving ? 'Zapisuję...' : 'Zapisz'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
