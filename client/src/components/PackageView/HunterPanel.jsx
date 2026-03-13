import { useState, useEffect } from 'react'
import { api } from '../../services/api'

const ERROR_TYPES = [
  { value: 'wrong_qty', label: 'Spatne mnozstvi' },
  { value: 'missing_product', label: 'Chybejici zbozi' },
  { value: 'wrong_product', label: 'Jiny tovar' },
]

export default function HunterPanel({ packageId, workerId, itemsCount }) {
  const [hunters, setHunters] = useState([])
  const [selectedHunter, setSelectedHunter] = useState(null)
  const [assignment, setAssignment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showErrorPanel, setShowErrorPanel] = useState(false)
  const [errors, setErrors] = useState([])
  const [savingError, setSavingError] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const fetchData = async () => {
    try {
      const [huntersRes, assignmentRes, errorsRes] = await Promise.all([
        api.get('/hunters'),
        api.get(`/hunters/assignment/${packageId}`),
        api.get(`/hunters/errors/${packageId}`),
      ])
      const activeHunters = huntersRes.data.filter(h => h.active)
      setHunters(activeHunters)
      if (assignmentRes.data) {
        setAssignment(assignmentRes.data)
        setSelectedHunter(assignmentRes.data.hunter_id)
      }
      setErrors(errorsRes.data || [])
    } catch (err) {
      console.error('Failed to fetch hunter data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [packageId])

  const handleAssign = async (hunterId) => {
    if (!hunterId) return
    setSelectedHunter(hunterId)
    try {
      const res = await api.post('/hunters/assign', {
        deliveryNoteId: packageId,
        hunterId,
        workerId,
        itemsCount: itemsCount || 0,
      })
      setAssignment(res.data)
      setSavedMsg('OK')
      setTimeout(() => setSavedMsg(''), 2000)
    } catch (err) {
      console.error('Failed to assign hunter:', err)
    }
  }

  const handleReportError = async (errorType) => {
    if (!selectedHunter) return
    setSavingError(true)
    try {
      await api.post('/hunters/error', {
        deliveryNoteId: packageId,
        hunterId: selectedHunter,
        workerId,
        errorType,
      })
      setShowErrorPanel(false)
      setSavedMsg('Chyba!')
      setTimeout(() => setSavedMsg(''), 3000)
      const res = await api.get(`/hunters/errors/${packageId}`)
      setErrors(res.data || [])
    } catch (err) {
      console.error('Failed to report error:', err)
    } finally {
      setSavingError(false)
    }
  }

  if (loading) return null
  if (hunters.length === 0) return null

  const hunterName = hunters.find(h => h.id === selectedHunter)?.name

  // Dynamic grid: find longest name to determine max cols
  const longestName = Math.max(...hunters.map(h => h.name.length), 1)
  // ~8ch per character + padding, panel is ~50vw (~700px), so max cols = floor(700 / (longestName * 8 + 24))
  // Simpler heuristic: if names are long (>12ch) use 5 cols, medium (>8ch) use 6, short use 7
  const maxCols = longestName > 14 ? 4 : longestName > 10 ? 5 : longestName > 7 ? 6 : 7
  const cols = Math.min(hunters.length, maxCols)
  const rows = Math.ceil(hunters.length / cols)

  return (
    <div className="bg-navy-700 rounded-xl p-4 border border-navy-600 flex-1 flex flex-col">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="text-lg font-bold text-theme-primary">Szykoval:</h3>
        <div className="flex items-center gap-2">
          {savedMsg && (
            <span className="text-green-400 text-sm font-bold">{savedMsg}</span>
          )}
          {selectedHunter && !showErrorPanel && (
            <button
              onClick={() => setShowErrorPanel(true)}
              className="bg-red-900/50 hover:bg-red-900/70 border border-red-700 text-red-400 px-4 py-2 rounded-lg text-base font-bold transition-colors"
            >
              Chyba
            </button>
          )}
        </div>
      </div>

      {/* Hunter tiles — auto-size to fill available space */}
      <div
        className="grid gap-2 flex-1"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {hunters.map(h => (
          <button
            key={h.id}
            onClick={() => handleAssign(h.id)}
            className={`rounded-lg text-base font-semibold transition-colors flex items-center justify-center px-1 ${
              selectedHunter === h.id
                ? 'bg-brand-orange text-white'
                : 'bg-navy-800 border border-navy-600 text-theme-secondary hover:text-theme-primary hover:border-brand-orange'
            }`}
          >
            {h.name}
          </button>
        ))}
      </div>

      {/* Error type selection — inline row */}
      {showErrorPanel && selectedHunter && (
        <div className="flex items-center gap-2 mt-3 shrink-0">
          {ERROR_TYPES.map(et => (
            <button
              key={et.value}
              onClick={() => handleReportError(et.value)}
              disabled={savingError}
              className="flex-1 bg-red-900/30 hover:bg-red-900/50 border border-red-700 text-red-300 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {et.label}
            </button>
          ))}
          <button
            onClick={() => setShowErrorPanel(false)}
            className="text-theme-muted hover:text-theme-secondary text-xl px-2 shrink-0"
          >
            &times;
          </button>
        </div>
      )}

      {/* Error badges */}
      {errors.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 shrink-0">
          {errors.map(e => (
            <span key={e.id} className="bg-red-900/40 text-red-400 text-sm px-2.5 py-0.5 rounded font-semibold">
              {ERROR_TYPES.find(t => t.value === e.error_type)?.label || e.error_type}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
