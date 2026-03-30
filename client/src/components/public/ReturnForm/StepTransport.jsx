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

  // Fetch GoPay payment links from backend
  useEffect(() => {
    axios.get(`${apiBase}/retino/public/returns/payment-links`)
      .then(res => setPaymentLinks(res.data))
      .catch(() => {})
  }, [])

  // Check if returning from GoPay payment (URL has ?paid=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('paid') === '1') {
      setPaid(true)
      updateForm({ shippingPaid: true })
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const SHIPPING_OPTIONS = [
    { id: 'zasilkovna_drop_off', carrier: 'zasilkovna', method: 'drop_off',
      label: t('transport.zasilkovna'), description: t('transport.zasilkovnaDesc'), cost: 89, icon: '📦' },
    { id: 'gls_drop_off', carrier: 'gls', method: 'drop_off',
      label: t('transport.gls'), description: t('transport.glsDesc'), cost: 99, icon: '🟠' },
    { id: 'self_ship', carrier: 'self', method: 'self_ship',
      label: t('transport.self'), description: t('transport.selfDesc'), cost: 0, icon: '✉️' },
  ]

  const handleSelect = (option) => {
    setSelected(option)
    setPickupPoint(null)
    // Reset payment if switching carrier
    if (formData.shippingOption?.id !== option.id) {
      setPaid(false)
      updateForm({ shippingPaid: false })
    }
  }

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

  const needsPayment = selected && selected.cost > 0
  const isPaid = paid || !needsPayment

  const canProceed = () => {
    if (!selected) return false
    if (selected.carrier === 'zasilkovna' && !pickupPoint) return false
    if (needsPayment && !paid) return false
    return true
  }

  const handlePay = () => {
    if (!selected || !paymentLinks) return
    // Save form state before redirect
    updateForm({
      shippingOption: selected,
      shippingMethod: selected.method,
      shippingData: { carrier: selected.carrier, shippingMethod: selected.method, cost: selected.cost, pickupPoint: pickupPoint || null },
    })
    // Get payment link for carrier
    const link = paymentLinks[selected.carrier]
    if (!link) {
      alert('Platební odkaz není k dispozici')
      return
    }
    // Redirect to GoPay — successURL will come back with ?paid=1
    window.location.href = link
  }

  const handleNext = () => {
    updateForm({
      shippingOption: selected,
      shippingMethod: selected.method,
      shippingPaid: paid,
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

      {/* Zásilkovna pickup point */}
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

      {/* GLS info */}
      {selected?.carrier === 'gls' && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <div className="text-sm text-orange-800"><strong>GLS:</strong> {t('transport.glsInfo')}</div>
        </div>
      )}

      {/* Self-ship info */}
      {selected?.method === 'self_ship' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="text-sm text-yellow-800">
            <strong>{t('transport.selfInfo')}</strong><br />
            MROAUTO AUTODÍLY s.r.o.<br />{t('transport.selfAddress')}
          </div>
        </div>
      )}

      {/* Payment section */}
      {needsPayment && (
        <div className={`rounded-lg p-4 mb-6 border ${paid ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
          {paid ? (
            <div className="flex items-center gap-2 text-green-700">
              <span className="text-xl">✅</span>
              <span className="font-semibold">{t('transport.paid')} — {selected.cost} Kč</span>
            </div>
          ) : (
            <>
              <p className="text-sm text-orange-800 mb-3">{t('transport.payFirst')}</p>
              <button onClick={handlePay}
                className="w-full bg-[#2ECC71] hover:bg-[#27ae60] text-white py-3 rounded-lg font-bold text-lg transition-colors">
                {t('transport.payButton')} {selected.cost} Kč
              </button>
            </>
          )}
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
