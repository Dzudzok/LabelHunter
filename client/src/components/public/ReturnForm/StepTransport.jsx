import { useState, useEffect, useCallback } from 'react'
import { useLang } from './i18n'

export default function StepTransport({ formData, updateForm, onNext, onBack }) {
  const { t } = useLang()
  const [selected, setSelected] = useState(formData.shippingOption || null)
  const [pickupPoint, setPickupPoint] = useState(formData.shippingData?.pickupPoint || null)

  const SHIPPING_OPTIONS = [
    { id: 'zasilkovna_drop_off', carrier: 'zasilkovna', method: 'drop_off',
      label: t('transport.zasilkovna'), description: t('transport.zasilkovnaDesc'), cost: 89, icon: '📦' },
    { id: 'gls_drop_off', carrier: 'gls', method: 'drop_off',
      label: t('transport.gls'), description: t('transport.glsDesc'), cost: 99, icon: '🟠' },
    { id: 'self_ship', carrier: 'self', method: 'self_ship',
      label: t('transport.self'), description: t('transport.selfDesc'), cost: 0, icon: '✉️' },
  ]

  const handleSelect = (option) => { setSelected(option); setPickupPoint(null) }

  const openZasilkovnaWidget = useCallback(() => {
    if (typeof window.Packeta === 'undefined') { alert('Zásilkovna widget error'); return }
    window.Packeta.Widget.pick(
      import.meta.env.VITE_ZASILKOVNA_KEY || 'e0794fa94f498c06',
      (point) => {
        if (point) setPickupPoint({
          id: String(point.id),
          name: point.nameStreet || point.name,
          address: `${point.street || ''}, ${point.city || ''} ${point.zip || ''}`.trim(),
        })
      },
      { country: 'cz', language: 'cs' }
    )
  }, [])

  const canProceed = () => {
    if (!selected) return false
    if (selected.carrier === 'zasilkovna' && !pickupPoint) return false
    return true
  }

  const handleNext = () => {
    updateForm({
      shippingOption: selected,
      shippingMethod: selected.method,
      shippingData: { carrier: selected.carrier, shippingMethod: selected.method, cost: selected.cost, pickupPoint: pickupPoint || null },
    })
    onNext()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-2">{t('transport.title')}</h2>
      <p className="text-sm text-gray-500 mb-6">{t('transport.desc')}</p>
      <ZasilkovnaScript />

      <div className="space-y-3 mb-6">
        {SHIPPING_OPTIONS.map((option) => (
          <button key={option.id} onClick={() => handleSelect(option)}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
              selected?.id === option.id ? 'border-[#1046A0] bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">{option.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-800">{option.label}</span>
                  <span className={`text-sm font-bold ${option.cost > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {option.cost > 0 ? `${option.cost} Kč` : t('transport.free')}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{option.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selected?.carrier === 'zasilkovna' && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{t('transport.pickupPoint')}</span>
            <button onClick={openZasilkovnaWidget}
              className="bg-[#BA1B02] text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:opacity-90">
              {pickupPoint ? t('transport.changePoint') : t('transport.selectPoint')}
            </button>
          </div>
          {pickupPoint ? (
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="font-medium text-gray-800">{pickupPoint.name}</div>
              <div className="text-sm text-gray-500">{pickupPoint.address}</div>
            </div>
          ) : <p className="text-sm text-gray-400">{t('transport.selectPointHint')}</p>}
        </div>
      )}

      {selected?.carrier === 'gls' && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <div className="text-sm text-orange-800"><strong>GLS:</strong> {t('transport.glsInfo')}</div>
        </div>
      )}

      {selected?.method === 'self_ship' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="text-sm text-yellow-800">
            <strong>{t('transport.selfInfo')}</strong><br />
            MROAUTO AUTODÍLY s.r.o.<br />{t('transport.selfAddress')}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 text-sm font-medium">&larr; {t('common.back')}</button>
        <button onClick={handleNext} disabled={!canProceed()}
          className="bg-[#1046A0] text-white px-6 py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-40">
          {t('common.continue')}
        </button>
      </div>
    </div>
  )
}

function ZasilkovnaScript() {
  useEffect(() => {
    if (document.getElementById('zasilkovna-widget-script')) return
    const script = document.createElement('script')
    script.id = 'zasilkovna-widget-script'
    script.src = 'https://widget.packeta.com/v6/www/js/library.js'
    script.async = true
    document.head.appendChild(script)
  }, [])
  return null
}
