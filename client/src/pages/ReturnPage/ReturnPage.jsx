import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../services/api'

export default function ReturnPage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCarrier, setSelectedCarrier] = useState('')
  const [carriers, setCarriers] = useState([])
  const [generating, setGenerating] = useState(false)
  const [labelUrl, setLabelUrl] = useState(null)
  const [returnSuccess, setReturnSuccess] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get(`/tracking/public/${token}`),
      api.get('/carriers').catch(() => ({ data: [] })),
    ])
      .then(([trackingRes, carriersRes]) => {
        setData(trackingRes.data)
        setCarriers(carriersRes.data)
        setLoading(false)
      })
      .catch(() => {
        setError('Zasilka nenalezena')
        setLoading(false)
      })
  }, [token])

  const handleGenerateReturn = async () => {
    if (!selectedCarrier) return
    setGenerating(true)
    try {
      const pkg = data?.package || data
      const res = await api.post('/returns', {
        delivery_note_id: pkg.id,
        shipper_code: selectedCarrier,
      })
      setLabelUrl(res.data.label_url)
      setReturnSuccess(true)
    } catch {
      setError('Chyba pri generovani etikety')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-800 flex items-center justify-center">
        <div className="text-xl text-gray-400">Nacitani...</div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-navy-800 flex flex-col items-center justify-center p-6">
        <div className="text-2xl text-red-400 mb-4">{error}</div>
      </div>
    )
  }

  const pkg = data?.package || data

  return (
    <div className="min-h-screen bg-navy-800">
      {/* Header */}
      <div className="bg-navy-900 border-b border-navy-700 px-4 py-6">
        <div className="max-w-xl mx-auto text-center">
          <h1 className="text-3xl font-black text-white">
            MRO<span className="text-brand-orange">AUTO</span>
          </h1>
          <p className="text-gray-400 mt-1">Vraceni zasilky</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6">
        {/* Package info */}
        <div className="bg-navy-700 rounded-xl p-6 border border-navy-600 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Informace o zasilce</h2>
          <div className="space-y-2">
            {pkg?.invoice_number && (
              <div className="flex justify-between">
                <span className="text-gray-500">Faktura</span>
                <span className="text-white font-medium">{pkg.invoice_number}</span>
              </div>
            )}
            {pkg?.order_number && (
              <div className="flex justify-between">
                <span className="text-gray-500">Objednavka</span>
                <span className="text-white font-medium">{pkg.order_number}</span>
              </div>
            )}
            {pkg?.customer_name && (
              <div className="flex justify-between">
                <span className="text-gray-500">Zakaznik</span>
                <span className="text-white font-medium">{pkg.customer_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Return address */}
        <div className="bg-navy-700 rounded-xl p-6 border border-navy-600 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Adresa pro vraceni</h2>
          <div className="text-lg text-gray-300 space-y-1">
            <div className="font-semibold text-white">MROAUTO AUTODILY s.r.o.</div>
            <div>Cs. armady 360</div>
            <div>Pudlov</div>
            <div>735 51 Bohumin</div>
            <div>Ceska republika</div>
          </div>
        </div>

        {returnSuccess ? (
          /* Success state */
          <div className="bg-green-900/30 border border-green-600 rounded-xl p-6 text-center mb-6">
            <div className="text-3xl mb-3 text-green-400">&#10003;</div>
            <h3 className="text-xl font-bold text-green-400 mb-2">
              Etiketa vygenerovana
            </h3>
            <p className="text-gray-400 mb-4">
              Stahni etiketu, vytiskni a prilep na balik.
            </p>
            {labelUrl && (
              <a
                href={labelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-brand-orange hover:bg-brand-orange-dark text-white px-8 py-4 rounded-xl text-xl font-bold transition-colors"
              >
                Stahnout etiketu (PDF)
              </a>
            )}
          </div>
        ) : (
          <>
            {/* Carrier selection */}
            <div className="bg-navy-700 rounded-xl p-6 border border-navy-600 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">Vyber prepravce</h2>
              {carriers.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {carriers.map(carrier => (
                    <button
                      key={carrier.code || carrier.id}
                      onClick={() => setSelectedCarrier(carrier.code || carrier.id)}
                      className={`p-4 rounded-xl border-2 text-lg font-semibold transition-colors ${
                        selectedCarrier === (carrier.code || carrier.id)
                          ? 'border-brand-orange bg-brand-orange/20 text-white'
                          : 'border-navy-600 bg-navy-800 text-gray-400 hover:text-white hover:border-navy-500'
                      }`}
                    >
                      {carrier.name || carrier.code}
                    </button>
                  ))}
                </div>
              ) : (
                <select
                  value={selectedCarrier}
                  onChange={(e) => setSelectedCarrier(e.target.value)}
                  className="w-full bg-navy-900 border border-navy-600 rounded-lg px-4 py-3 text-lg text-white outline-none"
                >
                  <option value="">Vyberte prepravce...</option>
                  <option value="zasilkovna">Zasilkovna</option>
                  <option value="dpd">DPD</option>
                  <option value="ppl">PPL</option>
                  <option value="gls">GLS</option>
                  <option value="cp">Ceska posta</option>
                </select>
              )}
            </div>

            {/* Error display */}
            {error && (
              <div className="text-center text-red-400 font-semibold mb-4">{error}</div>
            )}

            {/* Generate label button */}
            <button
              onClick={handleGenerateReturn}
              disabled={!selectedCarrier || generating}
              className="w-full bg-brand-orange hover:bg-brand-orange-dark disabled:opacity-50 disabled:cursor-not-allowed text-white py-5 rounded-xl text-xl font-bold transition-colors mb-6"
            >
              {generating ? 'Generuji etiketu...' : 'Generovat etiketu pro vraceni'}
            </button>
          </>
        )}

        {/* Contact */}
        <div className="text-center text-gray-500 text-sm pb-8">
          <div>Potrebujete pomoc?</div>
          <a href="mailto:info@mroauto.cz" className="text-brand-orange hover:underline">
            info@mroauto.cz
          </a>
          {' | '}
          <a href="tel:+420774917859" className="text-brand-orange hover:underline">
            +420 774 917 859
          </a>
          <div className="mt-4">MROAUTO AUTODILY s.r.o.</div>
        </div>
      </div>
    </div>
  )
}
