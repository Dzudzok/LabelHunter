import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../services/api'

const COLOR_PRESETS = [
  { label: 'Červený', color: '#DC2626', bg_color: '#FEE2E2' },
  { label: 'Zelený', color: '#059669', bg_color: '#D1FAE5' },
  { label: 'Modrý', color: '#2563EB', bg_color: '#DBEAFE' },
  { label: 'Žlutý', color: '#D97706', bg_color: '#FEF3C7' },
  { label: 'Oranžový', color: '#EA580C', bg_color: '#FFEDD5' },
  { label: 'Fialový', color: '#7C3AED', bg_color: '#EDE9FE' },
  { label: 'Šedý', color: '#4B5563', bg_color: '#F3F4F6' },
]

export default function TagsManagement() {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#DC2626')
  const [bgColor, setBgColor] = useState('#FEE2E2')
  const [creating, setCreating] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const fetchTags = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/retino/tags')
      setTags(res.data)
    } catch (err) {
      console.error('Failed to fetch tags:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTags() }, [fetchTags])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      await api.post('/retino/tags', { name: name.trim(), color, bg_color: bgColor })
      setName('')
      fetchTags()
    } catch (err) {
      console.error('Failed to create tag:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/retino/tags/${id}`)
      setDeleteConfirm(null)
      fetchTags()
    } catch (err) {
      console.error('Failed to delete tag:', err)
    }
  }

  const applyPreset = (preset) => {
    setColor(preset.color)
    setBgColor(preset.bg_color)
  }

  return (
    <div className="bg-navy-900 text-theme-primary p-3 sm:p-6 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Štítky</h1>

      {/* New tag form */}
      <div className="bg-navy-800 rounded-xl p-4 sm:p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Nový štítek</h2>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm text-theme-muted mb-1">Název</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Název štítku..."
              className="bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary w-full max-w-xs"
            />
          </div>

          {/* Color presets */}
          <div>
            <label className="block text-sm text-theme-muted mb-2">Přednastavené barvy</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="flex items-center gap-1.5 bg-navy-700 hover:bg-navy-600 border border-navy-600 rounded-lg px-3 py-1.5 text-xs transition-colors"
                >
                  <span
                    style={{ color: preset.color, backgroundColor: preset.bg_color }}
                    className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  >
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm text-theme-muted mb-1">Barva textu</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border border-navy-600"
                />
                <span className="text-xs text-theme-muted font-mono">{color}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-theme-muted mb-1">Barva pozadí</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border border-navy-600"
                />
                <span className="text-xs text-theme-muted font-mono">{bgColor}</span>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm text-theme-muted mb-2">Náhled</label>
            <span
              style={{ color, backgroundColor: bgColor }}
              className="px-2 py-0.5 rounded-full text-xs font-semibold"
            >
              {name || 'Příklad'}
            </span>
          </div>

          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors"
          >
            {creating ? 'Vytvářím...' : 'Vytvořit'}
          </button>
        </form>
      </div>

      {/* Existing tags */}
      <div className="bg-navy-800 rounded-xl p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">
          Existující štítky {!loading && <span className="text-theme-muted text-sm font-normal">({tags.length})</span>}
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : tags.length === 0 ? (
          <p className="text-theme-muted text-sm py-8 text-center">Zatím žádné štítky</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="bg-navy-700 rounded-lg p-3 flex items-center justify-between gap-2"
              >
                <span
                  style={{ color: tag.color, backgroundColor: tag.bg_color }}
                  className="px-2 py-0.5 rounded-full text-xs font-semibold"
                >
                  {tag.name}
                </span>

                {deleteConfirm === tag.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(tag.id)}
                      className="text-red-400 hover:text-red-300 text-xs font-semibold"
                    >
                      Ano
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="text-theme-muted hover:text-theme-primary text-xs"
                    >
                      Ne
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(tag.id)}
                    className="text-red-400 hover:text-red-300 text-xs opacity-60 hover:opacity-100 transition-opacity"
                    title="Smazat"
                  >
                    Smazat
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
