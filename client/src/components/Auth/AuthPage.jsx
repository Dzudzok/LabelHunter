import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../services/api'

export default function AuthPage() {
  const navigate = useNavigate()
  const setWorker = useAuthStore(s => s.setWorker)
  const worker = useAuthStore(s => s.worker)

  const [workers, setWorkers] = useState([])
  const [selectedWorker, setSelectedWorker] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (worker) {
      navigate('/', { replace: true })
      return
    }
    api.get('/workers')
      .then(res => {
        setWorkers(res.data.filter(w => w.is_active))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [worker, navigate])

  const handlePinDigit = (digit) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit)
      setError('')
    }
  }

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1))
    setError('')
  }

  const handleSubmit = async () => {
    if (!selectedWorker || pin.length === 0) return
    try {
      const res = await api.post('/workers/verify', {
        workerId: selectedWorker.id,
        pin,
      })
      setWorker(res.data)
      navigate('/', { replace: true })
    } catch {
      setError('Spatny PIN')
      setPin('')
    }
  }

  useEffect(() => {
    if (pin.length === 4) {
      handleSubmit()
    }
  }, [pin])

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-800 flex items-center justify-center">
        <div className="text-2xl text-theme-primary">Nacitani...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-800 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black text-theme-primary mb-2">
          Label<span className="text-brand-orange">Hunter</span>
        </h1>
        <p className="text-xl text-theme-secondary">MROAUTO AUTODILY s.r.o.</p>
      </div>

      {!selectedWorker ? (
        /* Worker selection */
        <div className="w-full max-w-2xl">
          <h2 className="text-2xl font-bold text-center mb-8 text-theme-secondary">
            Vyberte pracovnika
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {workers.map(w => (
              <button
                key={w.id}
                onClick={() => setSelectedWorker(w)}
                className="bg-navy-700 hover:bg-navy-600 border-2 border-navy-600 hover:border-brand-orange rounded-xl p-6 flex flex-col items-center gap-3 transition-colors"
              >
                <div className="w-16 h-16 rounded-full bg-brand-orange flex items-center justify-center text-2xl font-bold text-white">
                  {w.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>
                <span className="text-xl font-semibold text-theme-primary">{w.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* PIN entry */
        <div className="w-full max-w-md">
          <button
            onClick={() => { setSelectedWorker(null); setPin(''); setError('') }}
            className="text-theme-secondary hover:text-theme-primary mb-6 text-lg min-h-0"
          >
            &larr; Zpet
          </button>

          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-brand-orange flex items-center justify-center text-3xl font-bold text-white mx-auto mb-4">
              {selectedWorker.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </div>
            <h2 className="text-2xl font-bold text-theme-primary">{selectedWorker.name}</h2>
            <p className="text-theme-secondary mt-1">Zadejte PIN</p>
          </div>

          {/* PIN dots */}
          <div className="flex justify-center gap-4 mb-8">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-5 h-5 rounded-full ${
                  i < pin.length ? 'bg-brand-orange' : 'bg-navy-600'
                }`}
              />
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div className="text-center text-red-500 text-xl font-bold mb-4 animate-pulse">
              {error}
            </div>
          )}

          {/* PIN pad */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
              <button
                key={digit}
                onClick={() => handlePinDigit(String(digit))}
                className="bg-navy-700 hover:bg-navy-600 border border-navy-600 rounded-xl text-3xl font-bold text-theme-primary h-20 transition-colors"
              >
                {digit}
              </button>
            ))}
            <button
              onClick={handleBackspace}
              className="bg-navy-700 hover:bg-navy-600 border border-navy-600 rounded-xl text-2xl text-theme-secondary h-20 transition-colors"
            >
              &larr;
            </button>
            <button
              onClick={() => handlePinDigit('0')}
              className="bg-navy-700 hover:bg-navy-600 border border-navy-600 rounded-xl text-3xl font-bold text-theme-primary h-20 transition-colors"
            >
              0
            </button>
            <button
              onClick={handleSubmit}
              className="bg-brand-orange hover:bg-brand-orange-dark rounded-xl text-2xl font-bold text-white h-20 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
