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
    const hId = parseInt(hunterId)
    if (!hId) return
    setSelectedHunter(hId)
    try {
      const res = await api.post('/hunters/assign', {
        deliveryNoteId: packageId,
        hunterId: hId,
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

  return (
    <div className="bg-navy-700 rounded-xl p-4 border border-navy-600">
      {/* Single row: label + dropdown + error btn + status */}
      <div className="flex items-center gap-3">
        <span className="text-base font-bold text-theme-secondary shrink-0">Szykoval:</span>
        <select
          value={selectedHunter || ''}
          onChange={e => handleAssign(e.target.value)}
          className="flex-1 bg-navy-900 border border-navy-600 text-theme-primary rounded-lg px-3 py-2.5 text-base outline-none focus:border-brand-orange min-w-0"
        >
          <option value="">— vyber —</option>
          {hunters.map(h => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>

        {selectedHunter && !showErrorPanel && (
          <button
            onClick={() => setShowErrorPanel(true)}
            className="bg-red-900/50 hover:bg-red-900/70 border border-red-700 text-red-400 px-4 py-2.5 rounded-lg text-base font-bold shrink-0 transition-colors"
          >
            Chyba
          </button>
        )}

        {savedMsg && (
          <span className="text-green-400 text-sm font-bold shrink-0">{savedMsg}</span>
        )}
      </div>

      {/* Error type selection — inline row */}
      {showErrorPanel && selectedHunter && (
        <div className="flex items-center gap-2 mt-3">
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

      {/* Compact error badges */}
      {errors.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
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
