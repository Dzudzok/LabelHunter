import { useState, useEffect } from 'react'
import { api } from '../../services/api'

export default function WorkersPanel({ isOpen, onClose }) {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPin, setNewPin] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    if (isOpen) {
      fetchWorkers()
    }
  }, [isOpen])

  const fetchWorkers = async () => {
    try {
      const res = await api.get('/workers')
      setWorkers(res.data)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newName.trim() || !newPin.trim()) return
    try {
      await api.post('/workers', { name: newName, pin: newPin })
      setNewName('')
      setNewPin('')
      setShowAddForm(false)
      fetchWorkers()
    } catch (err) {
      console.error('Add worker error:', err)
    }
  }

  const handleToggleActive = async (worker) => {
    try {
      await api.put(`/workers/${worker.id}`, { is_active: !worker.is_active })
      fetchWorkers()
    } catch (err) {
      console.error('Toggle error:', err)
    }
  }

  const handleEditName = async (workerId) => {
    if (!editName.trim()) return
    try {
      await api.put(`/workers/${workerId}`, { name: editName })
      setEditingId(null)
      setEditName('')
      fetchWorkers()
    } catch (err) {
      console.error('Edit error:', err)
    }
  }

  const handleDelete = async (workerId) => {
    try {
      await api.delete(`/workers/${workerId}`)
      setDeleteConfirm(null)
      fetchWorkers()
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-navy-800 rounded-2xl border border-navy-600 w-full max-w-2xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-navy-700">
          <h2 className="text-2xl font-bold text-theme-primary">Sprava pracovniku</h2>
          <button
            onClick={onClose}
            className="text-theme-secondary hover:text-theme-primary text-2xl min-h-0 px-2"
          >
            &#10005;
          </button>
        </div>

        {/* Workers list */}
        <div className="p-6">
          {loading ? (
            <div className="text-center text-theme-secondary py-8">Nacitani...</div>
          ) : (
            <div className="flex flex-col gap-3">
              {workers.map(w => (
                <div
                  key={w.id}
                  className="bg-navy-700 rounded-xl p-4 border border-navy-600 flex items-center gap-4"
                >
                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0 ${
                    w.is_active ? 'bg-brand-orange' : 'bg-gray-600'
                  }`}>
                    {w.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    {editingId === w.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="bg-navy-900 border border-navy-600 rounded-lg px-3 py-1 text-theme-primary flex-1 min-h-0"
                          autoFocus
                        />
                        <button
                          onClick={() => handleEditName(w.id)}
                          className="bg-green-600 text-white px-3 py-1 rounded-lg min-h-0 text-sm"
                        >
                          Ulozit
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditName('') }}
                          className="text-theme-secondary px-2 min-h-0 text-sm"
                        >
                          Zrusit
                        </button>
                      </div>
                    ) : (
                      <div className="text-lg font-semibold text-theme-primary">{w.name}</div>
                    )}
                  </div>

                  {/* Status badge */}
                  <span className={`text-sm px-3 py-1 rounded-full shrink-0 ${
                    w.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-theme-secondary'
                  }`}>
                    {w.is_active ? 'Aktivni' : 'Neaktivni'}
                  </span>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleActive(w)}
                      className="bg-navy-600 hover:bg-navy-500 text-theme-secondary px-3 py-2 rounded-lg min-h-0 text-sm"
                    >
                      {w.is_active ? 'Deaktivovat' : 'Aktivovat'}
                    </button>
                    <button
                      onClick={() => { setEditingId(w.id); setEditName(w.name) }}
                      className="bg-navy-600 hover:bg-navy-500 text-theme-secondary px-3 py-2 rounded-lg min-h-0 text-sm"
                    >
                      Upravit
                    </button>
                    {deleteConfirm === w.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDelete(w.id)}
                          className="bg-red-600 text-white px-3 py-2 rounded-lg min-h-0 text-sm"
                        >
                          Ano
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-theme-secondary px-2 min-h-0 text-sm"
                        >
                          Ne
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(w.id)}
                        className="bg-red-900/50 hover:bg-red-800 text-red-400 px-3 py-2 rounded-lg min-h-0 text-sm"
                      >
                        Smazat
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add worker form */}
          {showAddForm ? (
            <form onSubmit={handleAdd} className="mt-6 bg-navy-700 rounded-xl p-6 border border-navy-600">
              <h3 className="text-lg font-bold text-theme-primary mb-4">Novy pracovnik</h3>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Jmeno"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-navy-900 border border-navy-600 rounded-lg px-4 py-3 text-lg text-theme-primary placeholder-theme-muted outline-none"
                />
                <input
                  type="password"
                  placeholder="PIN (4 cislice)"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  maxLength={4}
                  className="bg-navy-900 border border-navy-600 rounded-lg px-4 py-3 text-lg text-theme-primary placeholder-theme-muted outline-none"
                />
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-brand-orange hover:bg-brand-orange-dark text-white py-3 rounded-xl font-bold text-lg transition-colors"
                  >
                    Pridat
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddForm(false); setNewName(''); setNewPin('') }}
                    className="flex-1 bg-navy-600 text-theme-secondary py-3 rounded-xl font-bold text-lg"
                  >
                    Zrusit
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-6 w-full bg-navy-700 hover:bg-navy-600 border-2 border-dashed border-navy-600 text-theme-secondary hover:text-theme-primary py-4 rounded-xl text-lg font-semibold transition-colors"
            >
              + Pridat pracovnika
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
