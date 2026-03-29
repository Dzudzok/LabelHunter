import { useState, useEffect } from 'react'
import { api } from '../../../services/api'

const ICONS = ['box', 'refresh', 'alert', 'shield', 'tool', 'truck', 'star']
const COLORS = ['#3B82F6', '#EF4444', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#6366F1']

export default function CaseTypes() {
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // id or 'new'
  const [form, setForm] = useState({ code: '', nameCz: '', color: '#3B82F6', icon: 'box', enabled: true, sortOrder: 99 })

  const fetchTypes = async () => {
    setLoading(true)
    try {
      const res = await api.get('/retino/case-types')
      setTypes(res.data || [])
    } catch { /* */ }
    setLoading(false)
  }

  useEffect(() => { fetchTypes() }, [])

  const startEdit = (ct) => {
    setEditing(ct.id)
    setForm({ code: ct.code, nameCz: ct.name_cs, color: ct.color, icon: ct.icon, enabled: ct.enabled, sortOrder: ct.sort_order })
  }

  const startNew = () => {
    setEditing('new')
    setForm({ code: '', nameCz: '', color: '#3B82F6', icon: 'box', enabled: true, sortOrder: 99 })
  }

  const save = async () => {
    try {
      if (editing === 'new') {
        await api.post('/retino/case-types', form)
      } else {
        await api.patch(`/retino/case-types/${editing}`, form)
      }
      setEditing(null)
      fetchTypes()
    } catch (err) {
      alert(err.response?.data?.error || 'Chyba')
    }
  }

  const remove = async (id) => {
    if (!confirm('Opravdu smazat tento typ?')) return
    try {
      await api.delete(`/retino/case-types/${id}`)
      fetchTypes()
    } catch (err) {
      alert(err.response?.data?.error || 'Chyba')
    }
  }

  const toggleEnabled = async (ct) => {
    try {
      await api.patch(`/retino/case-types/${ct.id}`, { enabled: !ct.enabled })
      fetchTypes()
    } catch { /* */ }
  }

  return (
    <div className="bg-navy-900 text-theme-primary p-3 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-bold">Typy případů</h1>
        <button onClick={startNew} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold">
          Přidat typ
        </button>
      </div>

      {/* Edit/New form */}
      {editing && (
        <div className="bg-navy-800 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-theme-muted block mb-1">Kód</label>
              <input type="text" value={form.code} onChange={e => setForm({...form, code: e.target.value})}
                disabled={editing !== 'new'}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary disabled:opacity-50" placeholder="damage" />
            </div>
            <div>
              <label className="text-xs text-theme-muted block mb-1">Název (CZ)</label>
              <input type="text" value={form.nameCz} onChange={e => setForm({...form, nameCz: e.target.value})}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary" placeholder="Poškození" />
            </div>
            <div>
              <label className="text-xs text-theme-muted block mb-1">Pořadí</label>
              <input type="number" value={form.sortOrder} onChange={e => setForm({...form, sortOrder: parseInt(e.target.value) || 0})}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary" />
            </div>
          </div>
          <div>
            <label className="text-xs text-theme-muted block mb-1">Barva</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm({...form, color: c})}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-theme-muted block mb-1">Ikona</label>
            <div className="flex gap-2">
              {ICONS.map(i => (
                <button key={i} onClick={() => setForm({...form, icon: i})}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${form.icon === i ? 'bg-blue-600 text-white' : 'bg-navy-700 text-theme-muted'}`}>
                  {i}
                </button>
              ))}
            </div>
          </div>
          {/* Preview */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-theme-muted">Náhled:</span>
            <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: form.color }}>
              {form.nameCz || 'Typ'}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold">Uložit</button>
            <button onClick={() => setEditing(null)} className="text-theme-muted hover:text-theme-primary text-sm">Zrušit</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-theme-muted py-12">Načítání...</div>
      ) : (
        <div className="space-y-2">
          {types.map(ct => (
            <div key={ct.id} className="bg-navy-800 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: ct.color }}>
                  {ct.name_cs}
                </span>
                <span className="text-xs text-theme-muted font-mono">{ct.code}</span>
                {ct.is_system && <span className="text-[10px] text-theme-muted bg-navy-600 px-1.5 py-0.5 rounded">systém</span>}
                {!ct.enabled && <span className="text-[10px] text-red-400 bg-red-900/20 px-1.5 py-0.5 rounded">vypnuto</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleEnabled(ct)}
                  className={`text-xs ${ct.enabled ? 'text-yellow-400' : 'text-green-400'}`}>
                  {ct.enabled ? 'Vypnout' : 'Zapnout'}
                </button>
                <button onClick={() => startEdit(ct)} className="text-xs text-blue-400 hover:text-blue-300">Upravit</button>
                {!ct.is_system && (
                  <button onClick={() => remove(ct.id)} className="text-xs text-red-400 hover:text-red-300">Smazat</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
