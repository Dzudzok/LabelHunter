import { useState, useEffect } from 'react'
import { api } from '../../../services/api'

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Číslo' },
  { value: 'select', label: 'Výběr' },
  { value: 'checkbox', label: 'Zaškrtávací pole' },
  { value: 'date', label: 'Datum' },
]

const CASE_TYPES = ['return', 'complaint', 'warranty']
const CASE_TYPE_LABELS = { return: 'Vrácení', complaint: 'Reklamace', warranty: 'Záruka' }

export default function CustomFields() {
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    code: '', labelCs: '', fieldType: 'text', options: '',
    required: false, appliesTo: ['return'], sortOrder: 0,
  })

  const fetchFields = async () => {
    setLoading(true)
    try {
      const res = await api.get('/retino/custom-fields')
      setFields(res.data || [])
    } catch { /* */ }
    setLoading(false)
  }

  useEffect(() => { fetchFields() }, [])

  const startEdit = (f) => {
    setEditing(f.id)
    setForm({
      code: f.code, labelCs: f.label_cs, fieldType: f.field_type,
      options: (f.options || []).join(', '), required: f.required,
      appliesTo: f.applies_to || ['return'], sortOrder: f.sort_order,
    })
  }

  const startNew = () => {
    setEditing('new')
    setForm({ code: '', labelCs: '', fieldType: 'text', options: '', required: false, appliesTo: ['return'], sortOrder: 0 })
  }

  const save = async () => {
    const payload = {
      ...form,
      options: form.fieldType === 'select' ? form.options.split(',').map(o => o.trim()).filter(Boolean) : [],
    }
    try {
      if (editing === 'new') {
        await api.post('/retino/custom-fields', payload)
      } else {
        await api.patch(`/retino/custom-fields/${editing}`, payload)
      }
      setEditing(null)
      fetchFields()
    } catch (err) {
      alert(err.response?.data?.error || 'Chyba')
    }
  }

  const remove = async (id) => {
    if (!confirm('Opravdu smazat?')) return
    await api.delete(`/retino/custom-fields/${id}`)
    fetchFields()
  }

  const toggleActive = async (f) => {
    await api.patch(`/retino/custom-fields/${f.id}`, { isActive: !f.is_active })
    fetchFields()
  }

  const toggleAppliesTo = (type) => {
    setForm(prev => ({
      ...prev,
      appliesTo: prev.appliesTo.includes(type)
        ? prev.appliesTo.filter(t => t !== type)
        : [...prev.appliesTo, type],
    }))
  }

  return (
    <div className="bg-navy-900 text-theme-primary p-3 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-bold">Vlastní pole</h1>
        <button onClick={startNew} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold">
          Přidat pole
        </button>
      </div>

      {editing && (
        <div className="bg-navy-800 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-theme-muted block mb-1">Kód</label>
              <input type="text" value={form.code} onChange={e => setForm({...form, code: e.target.value})}
                disabled={editing !== 'new'}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-theme-muted block mb-1">Název</label>
              <input type="text" value={form.labelCs} onChange={e => setForm({...form, labelCs: e.target.value})}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary" />
            </div>
            <div>
              <label className="text-xs text-theme-muted block mb-1">Typ pole</label>
              <select value={form.fieldType} onChange={e => setForm({...form, fieldType: e.target.value})}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary">
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          {form.fieldType === 'select' && (
            <div>
              <label className="text-xs text-theme-muted block mb-1">Možnosti (čárkou oddělené)</label>
              <input type="text" value={form.options} onChange={e => setForm({...form, options: e.target.value})}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary" placeholder="Možnost 1, Možnost 2, Možnost 3" />
            </div>
          )}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-theme-muted">
              <input type="checkbox" checked={form.required} onChange={e => setForm({...form, required: e.target.checked})} className="w-4 h-4" />
              Povinné
            </label>
            <div className="flex items-center gap-2 text-sm text-theme-muted">
              Platí pro:
              {CASE_TYPES.map(t => (
                <label key={t} className="flex items-center gap-1">
                  <input type="checkbox" checked={form.appliesTo.includes(t)} onChange={() => toggleAppliesTo(t)} className="w-3.5 h-3.5" />
                  {CASE_TYPE_LABELS[t]}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold">Uložit</button>
            <button onClick={() => setEditing(null)} className="text-theme-muted hover:text-theme-primary text-sm">Zrušit</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-center text-theme-muted py-12">Načítání...</div> : (
        <div className="space-y-2">
          {fields.map(f => (
            <div key={f.id} className="bg-navy-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{f.label_cs}</span>
                  <span className="text-xs text-theme-muted font-mono">{f.code}</span>
                  <span className="text-[10px] bg-navy-600 text-theme-muted px-1.5 py-0.5 rounded">{f.field_type}</span>
                  {f.required && <span className="text-[10px] text-red-400">*povinné</span>}
                  {!f.is_active && <span className="text-[10px] text-red-400 bg-red-900/20 px-1 rounded">vypnuto</span>}
                </div>
                <div className="text-xs text-theme-muted mt-1">
                  {(f.applies_to || []).map(t => CASE_TYPE_LABELS[t] || t).join(', ')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActive(f)} className={`text-xs ${f.is_active ? 'text-yellow-400' : 'text-green-400'}`}>
                  {f.is_active ? 'Vypnout' : 'Zapnout'}
                </button>
                <button onClick={() => startEdit(f)} className="text-xs text-blue-400">Upravit</button>
                <button onClick={() => remove(f.id)} className="text-xs text-red-400">Smazat</button>
              </div>
            </div>
          ))}
          {fields.length === 0 && <div className="text-center text-theme-muted py-12">Žádná vlastní pole</div>}
        </div>
      )}
    </div>
  )
}
