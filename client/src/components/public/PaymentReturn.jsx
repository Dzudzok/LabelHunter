import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'

const apiBase = import.meta.env.VITE_API_URL || '/api'

export default function PaymentReturn() {
  const { shipmentId, accessToken } = useParams()
  const [searchParams] = useSearchParams()
  const status = searchParams.get('status')

  const [state, setState] = useState('loading') // loading, generating, success, failed, error
  const [labelUrl, setLabelUrl] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (status === 'fail') {
      setState('failed')
      return
    }

    // Payment success — generate label
    setState('generating')
    axios.post(`${apiBase}/retino/public/returns/payment-complete/${shipmentId}/${accessToken}`)
      .then(res => {
        setState('success')
        setLabelUrl(res.data.labelUrl || null)
      })
      .catch(err => {
        const msg = err.response?.data?.error || 'Chyba při generování štítku'
        // If already generated, still show success
        if (err.response?.data?.currentStatus === 'label_generated') {
          setState('success')
        } else {
          setState('error')
          setErrorMsg(msg)
        }
      })
  }, [shipmentId, accessToken, status])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1046A0] text-white">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <img src="/Mroauto_1994.png" alt="MROAUTO" className="h-10 object-contain" onError={(e) => { e.target.style.display = 'none' }} />
          <div>
            <div className="font-bold text-lg">MROAUTO</div>
            <div className="text-xs opacity-80">RETURO — Zpětná doprava</div>
          </div>
        </div>
        <div className="h-1 bg-[#D8112A]" />
      </div>

      <div className="max-w-lg mx-auto px-4 py-12">
        {state === 'loading' && (
          <div className="text-center text-gray-500">Načítání...</div>
        )}

        {state === 'generating' && (
          <div className="text-center">
            <div className="text-4xl mb-4">⏳</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Generuji přepravní štítek...</h2>
            <p className="text-gray-500">Platba proběhla úspěšně. Štítek se generuje, prosím vyčkejte.</p>
          </div>
        )}

        {state === 'success' && (
          <div className="text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Platba úspěšná!</h2>
            <p className="text-gray-600 mb-6">Váš přepravní štítek je připraven ke stažení.</p>

            {labelUrl && (
              <div className="mb-6">
                <a
                  href={labelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-[#D8112A] text-white px-8 py-4 rounded-lg font-bold text-lg hover:opacity-90 transition-opacity"
                >
                  Stáhnout štítek (PDF)
                </a>
                <p className="text-sm text-gray-500 mt-3">
                  Vytiskněte štítek a nalepte jej na balík před odesláním.
                </p>
              </div>
            )}

            <a
              href={`/vraceni/stav/${accessToken}`}
              className="inline-block bg-[#1046A0] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Sledovat stav žádosti
            </a>
          </div>
        )}

        {state === 'failed' && (
          <div className="text-center">
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Platba nebyla dokončena</h2>
            <p className="text-gray-600 mb-6">
              Platba nebyla provedena nebo byla zrušena. Štítek nebyl vygenerován.
            </p>
            <a
              href={`/vraceni/stav/${accessToken}`}
              className="inline-block bg-[#1046A0] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Zpět na stav žádosti
            </a>
          </div>
        )}

        {state === 'error' && (
          <div className="text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Chyba</h2>
            <p className="text-red-500 mb-6">{errorMsg}</p>
            <a
              href={`/vraceni/stav/${accessToken}`}
              className="inline-block bg-[#1046A0] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Zpět na stav žádosti
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
