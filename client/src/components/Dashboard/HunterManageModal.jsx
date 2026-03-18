import { useState, useEffect } from 'react'
import { api } from '../../services/api'

export default function HunterManageModal({ onClose }) {
  const [hunters, setHunters] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchHunters = async () => {
    try {
      const res = await api.get('/hunters')
      setHunters(res.data)
    } catch (err) {
      console.error('Failed to fetch hunters:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchHunters() }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    try {
      await api.post('/hunters', { name: newName.trim() })
      setNewName('')
      fetchHunters()
    } catch (err) {
      console.error('Failed to add hunter:', err)
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Opravdu smazat tohoto szykowacza?')) return
    try {
      await api.delete(`/hunters/${id}`)
      fetchHunters()
    } catch (err) {
      console.error('Failed to delete hunter:', err)
    }
  }

  const handleToggleActive = async (hunter) => {
    try {
      await api.put(`/hunters/${hunter.id}`, { active: !hunter.active })
      fetchHunters()
    } catch (err) {
      console.error('Failed to toggle hunter:', err)
    }
  }

  return (
    <div className="fixed inset-0 overlay-bg z-50 flex items-start justify-center pt-12 px-4">
      <div className="bg-navy-800 border border-navy-600 rounded-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700">
          <h2 className="text-xl font-bold text-theme-primary">Szykowacze (Hunters)</h2>
          <button onClick={onClose} className="text-theme-secondary hover:text-theme-primary text-2xl min-h-0 leading-none">&times;</button>
        </div>

        <div className="px-6 py-4">
          {/* Add form */}
          <form onSubmit={handleAdd} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Imię i Nazwisko..."
              className="flex-1 bg-navy-900 border border-navy-600 text-theme-primary rounded-lg px-3 py-2 text-base outline-none focus:border-brand-orange"
            />
            <button
              type="submit"
              disabled={adding || !newName.trim()}
              className="bg-brand-orange hover:bg-brand-orange-dark text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50 transition-colors"
            >
              {adding ? '...' : 'Dodaj'}
            </button>
          </form>

          {/* List */}
          {loading ? (
            <div className="text-center py-8 text-theme-muted">Ładowanie...</div>
          ) : hunters.length === 0 ? (
            <div className="text-center py-8 text-theme-muted">Brak szykowaczy</div>
          ) : (
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {hunters.map(h => (
                <div key={h.id} className={`flex items-center justify-between rounded-lg px-4 py-3 border ${
                  h.active ? 'bg-navy-700 border-navy-600' : 'bg-navy-800 border-navy-700 opacity-60'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${h.active ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span className="text-theme-primary font-semibold">{h.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(h)}
                      className="text-theme-muted hover:text-theme-primary text-xs px-2 py-1 rounded transition-colors"
                    >
                      {h.active ? 'Dezaktywuj' : 'Aktywuj'}
                    </button>
                    <button
                      onClick={() => handleDelete(h.id)}
                      className="text-red-400 hover:text-red-300 text-lg px-2 transition-colors"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
