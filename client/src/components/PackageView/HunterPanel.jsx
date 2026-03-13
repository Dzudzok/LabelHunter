import { useState, useEffect } from 'react'
import { api } from '../../services/api'

const ERROR_TYPES = [
  { value: 'wrong_qty', label: 'Spatne mnozstvi', icon: '#' },
  { value: 'missing_product', label: 'Chybejici zbozi', icon: '!' },
  { value: 'wrong_product', label: 'Jiny tovar', icon: '~' },
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
    setSelectedHunter(hunterId)
    try {
      const res = await api.post('/hunters/assign', {
        deliveryNoteId: packageId,
        hunterId,
        workerId,
        itemsCount: itemsCount || 0,
      })
      setAssignment(res.data)
      setSavedMsg('Szykowacz prirazen')
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
      setSavedMsg('Chyba zaznamenana!')
      setTimeout(() => setSavedMsg(''), 3000)
      // Refresh errors
      const res = await api.get(`/hunters/errors/${packageId}`)
      setErrors(res.data || [])
    } catch (err) {
      console.error('Failed to report error:', err)
    } finally {
      setSavingError(false)
    }
  }

  if (loading) {
    return <div className="text-theme-muted text-sm py-2">Nacitam szykowacze...</div>
  }

  if (hunters.length === 0) {
    return (
      <div className="bg-navy-700 rounded-xl p-4 border border-navy-600">
        <div className="text-theme-muted text-sm">Zadni szykowaczi. Pridejte je pres tlacitko "Hunter" v hlavicce.</div>
      </div>
    )
  }

  const hunterName = hunters.find(h => h.id === selectedHunter)?.name

  return (
    <div className="bg-navy-700 rounded-xl p-4 border border-navy-600">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-theme-primary">Kdo szykoval?</h3>
        {savedMsg && (
          <span className="text-green-400 text-xs font-semibold">{savedMsg}</span>
        )}
      </div>

      {/* Hunter selection grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {hunters.map(h => (
          <button
            key={h.id}
            onClick={() => handleAssign(h.id)}
            className={`px-4 py-3 rounded-lg text-base font-semibold transition-colors ${
              selectedHunter === h.id
                ? 'bg-brand-orange text-white'
                : 'bg-navy-800 border border-navy-600 text-theme-secondary hover:text-theme-primary hover:border-brand-orange'
            }`}
          >
            {h.name}
          </button>
        ))}
      </div>

      {/* Error button — only if hunter is selected */}
      {selectedHunter && (
        <div className="border-t border-navy-600 pt-3 mt-2">
          {!showErrorPanel ? (
            <button
              onClick={() => setShowErrorPanel(true)}
              className="w-full bg-red-900/40 hover:bg-red-900/60 border border-red-700 text-red-400 hover:text-red-300 py-3 rounded-lg text-base font-bold transition-colors"
            >
              Chyba szykowacza ({hunterName})
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-red-400 text-sm font-bold mb-1">
                Typ chyby — {hunterName}:
              </div>
              {ERROR_TYPES.map(et => (
                <button
                  key={et.value}
                  onClick={() => handleReportError(et.value)}
                  disabled={savingError}
                  className="w-full bg-red-900/30 hover:bg-red-900/50 border border-red-700 text-red-300 hover:text-red-200 py-3 rounded-lg text-base font-semibold transition-colors disabled:opacity-50"
                >
                  {et.icon} {et.label}
                </button>
              ))}
              <button
                onClick={() => setShowErrorPanel(false)}
                className="text-theme-muted text-sm hover:text-theme-secondary mt-1"
              >
                Zrusit
              </button>
            </div>
          )}
        </div>
      )}

      {/* Show errors on this package */}
      {errors.length > 0 && (
        <div className="border-t border-navy-600 pt-3 mt-3">
          <div className="text-red-400 text-xs font-bold mb-2">Zaznamenane chyby ({errors.length}):</div>
          {errors.map(e => (
            <div key={e.id} className="flex items-center gap-2 text-xs text-theme-secondary py-1">
              <span className="text-red-400 font-semibold">
                {ERROR_TYPES.find(t => t.value === e.error_type)?.label || e.error_type}
              </span>
              <span className="text-theme-muted">
                — {e.hunters?.name || '?'} — {new Date(e.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
