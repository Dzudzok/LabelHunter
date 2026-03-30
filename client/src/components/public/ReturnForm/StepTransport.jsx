import { useState, useEffect, useCallback } from 'react'
import { useLang } from './i18n'
import axios from 'axios'

const apiBase = import.meta.env.VITE_API_URL || '/api'

export default function StepTransport({ formData, updateForm, onNext, onBack }) {
  const { t } = useLang()
  const [selected, setSelected] = useState(formData.shippingOption || null)
  const [pickupPoint, setPickupPoint] = useState(formData.shippingData?.pickupPoint || null)
  const [paid, setPaid] = useState(formData.shippingPaid || false)
  const [paymentLinks, setPaymentLinks] = useState(null)

  useEffect(() => {
    axios.get(`${apiBase}/retino/public/returns/payment-links`).then(res => setPaymentLinks(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('paid') === '1') {
      setPaid(true)
      updateForm({ shippingPaid: true })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const SHIPPING_OPTIONS = [
    { id: 'zasilkovna_drop_off', carrier: 'zasilkovna', method: 'drop_off',
      label: t('transport.zasilkovna'), description: t('transport.zasilkovnaDesc'), cost: 89, icon: '📦', color: 'from-red-500 to-red-600' },
    { id: 'gls_drop_off', carrier: 'gls', method: 'drop_off',
      label: t('transport.gls'), description: t('transport.glsDesc'), cost: 99, icon: '🟠', color: 'from-orange-500 to-orange-600' },
    { id: 'self_ship', carrier: 'self', method: 'self_ship',
      label: t('transport.self'), description: t('transport.selfDesc'), cost: 0, icon: '✉️', color: 'from-gray-500 to-gray-600' },
  ]

  const handleSelect = (option) => {
    setSelected(option)
    setPickupPoint(null)
    if (formData.shippingOption?.id !== option.id) { setPaid(false); updateForm({ shippingPaid: false }) }
  }

  const openZasilkovnaWidget = useCallback(() => {
    if (typeof window.Packeta === 'undefined') { alert('Zásilkovna widget error'); return }
    window.Packeta.Widget.pick(
      import.meta.env.VITE_ZASILKOVNA_KEY || 'e0794fa94f498c06',
      (point) => {
        if (point) setPickupPoint({ id: String(point.id), name: point.nameStreet || point.name, address: `${point.street || ''}, ${point.city || ''} ${point.zip || ''}`.trim() })
      },
      { country: 'cz', language: 'cs' }
    )
  }, [])

  const needsPayment = selected && selected.cost > 0
  const canProceed = () => {
    if (!selected) return false
    if (selected.carrier === 'zasilkovna' && !pickupPoint) return false
    if (needsPayment && !paid) return false
    return true
  }

  const handlePay = () => {
    if (!selected || !paymentLinks) return
    updateForm({ shippingOption: selected, shippingMethod: selected.method, shippingData: { carrier: selected.carrier, shippingMethod: selected.method, cost: selected.cost, pickupPoint: pickupPoint || null } })
    if (paymentLinks.testMode) { setPaid(true); updateForm({ shippingPaid: true }); return }
    const link = paymentLinks[selected.carrier]
    if (!link) { alert('Platební odkaz není k dispozici'); return }
    window.location.href = link
  }

  const handleNext = () => {
    updateForm({ shippingOption: selected, shippingMethod: selected.method, shippingPaid: paid, shippingData: { carrier: selected.carrier, shippingMethod: selected.method, cost: selected.cost, pickupPoint: pickupPoint || null } })
    onNext()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900">{t('transport.title')}</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6 ml-[52px]">{t('transport.desc')}</p>
        <ZasilkovnaScript />

        <div className="space-y-3 mb-6">
          {SHIPPING_OPTIONS.map((option) => (
            <button key={option.id} onClick={() => handleSelect(option)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                selected?.id === option.id ? 'border-[#1046A0] bg-blue-50/50 shadow-sm' : 'border-gray-100 hover:border-gray-200'
              }`}>
              <div className="flex items-center gap-4">
                <span className="text-3xl">{option.icon}</span>
                <div className="flex-1">
                  <div className="font-bold text-gray-800">{option.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{option.description}</div>
                </div>
                <div className={`text-sm font-extrabold px-3 py-1 rounded-full ${option.cost > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                  {option.cost > 0 ? `${option.cost} Kč` : t('transport.free')}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Zásilkovna pickup */}
        {selected?.carrier === 'zasilkovna' && (
          <div className="bg-gray-50 rounded-xl p-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">{t('transport.pickupPoint')}</span>
              <button onClick={openZasilkovnaWidget} className="bg-[#BA1B02] text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity">
                {pickupPoint ? t('transport.changePoint') : t('transport.selectPoint')}
              </button>
            </div>
            {pickupPoint ? (
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="font-semibold text-gray-800">{pickupPoint.name}</div>
                <div className="text-sm text-gray-500">{pickupPoint.address}</div>
              </div>
            ) : <p className="text-sm text-gray-400">{t('transport.selectPointHint')}</p>}
          </div>
        )}

        {selected?.carrier === 'gls' && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-5 text-sm text-orange-800">
            <strong>GLS:</strong> {t('transport.glsInfo')}
          </div>
        )}

        {selected?.method === 'self_ship' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-5 text-sm text-yellow-800">
            <strong>{t('transport.selfInfo')}</strong><br />MROAUTO AUTODÍLY s.r.o.<br />{t('transport.selfAddress')}
          </div>
        )}

        {/* Payment */}
        {needsPayment && (
          <div className={`rounded-xl p-5 mb-5 border-2 transition-all ${paid ? 'bg-green-50 border-green-200' : 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200'}`}>
            {paid ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                  <div className="font-bold text-green-800">{t('transport.paid')}</div>
                  <div className="text-sm text-green-600">{selected.cost} Kč</div>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-orange-800 font-medium mb-3">{t('transport.payFirst')}</p>
                <button onClick={handlePay}
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-3.5 rounded-xl font-bold text-lg shadow-lg shadow-green-200 hover:shadow-green-300 hover:scale-[1.01] transition-all">
                  {t('transport.payButton')} {selected.cost} Kč
                </button>
              </>
            )}
          </div>
        )}

        <NavButtons onBack={onBack} onNext={handleNext} disabled={!canProceed()} t={t} />
      </div>
    </div>
  )
}

function NavButtons({ onBack, onNext, disabled, t }) {
  return (
    <div className="flex items-center justify-between pt-2">
      <button onClick={onBack} className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        {t('common.back')}
      </button>
      <button onClick={onNext} disabled={disabled}
        className="flex items-center gap-1.5 bg-gradient-to-r from-[#1046A0] to-[#0d3a85] text-white px-6 py-2.5 rounded-xl font-semibold shadow-md shadow-blue-200 hover:shadow-blue-300 hover:scale-[1.01] disabled:opacity-40 disabled:hover:scale-100 transition-all">
        {t('common.continue')}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  )
}

function ZasilkovnaScript() {
  useEffect(() => {
    if (document.getElementById('zasilkovna-widget-script')) return
    const s = document.createElement('script')
    s.id = 'zasilkovna-widget-script'
    s.src = 'https://widget.packeta.com/v6/www/js/library.js'
    s.async = true
    document.head.appendChild(s)
  }, [])
  return null
}
