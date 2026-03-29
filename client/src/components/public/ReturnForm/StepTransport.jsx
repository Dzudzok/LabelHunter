import { useState, useEffect, useCallback } from 'react'

const SHIPPING_OPTIONS = [
  {
    id: 'zasilkovna_drop_off',
    carrier: 'zasilkovna',
    method: 'drop_off',
    label: 'Zásilkovna — výdejní místo',
    description: 'Odevzdejte balík na zvoleném výdejním místě Zásilkovny',
    cost: 89,
    icon: '📦',
  },
  {
    id: 'cp_drop_off',
    carrier: 'cp',
    method: 'drop_off',
    label: 'Česká pošta — podání na pobočce',
    description: 'Podejte balík na kterékoli pobočce České pošty',
    cost: 99,
    icon: '🏤',
  },
  {
    id: 'ppl_courier',
    carrier: 'ppl',
    method: 'courier_pickup',
    label: 'PPL — svoz kurýrem',
    description: 'Kurýr PPL vyzvedne balík na vaší adrese',
    cost: 149,
    icon: '🚚',
  },
  {
    id: 'self_ship',
    carrier: 'self',
    method: 'self_ship',
    label: 'Vlastní doprava',
    description: 'Odešlete balík na vlastní náklady vlastním dopravcem',
    cost: 0,
    icon: '✉️',
  },
]

export default function StepTransport({ formData, updateForm, onNext, onBack }) {
  const [selected, setSelected] = useState(formData.shippingOption || null)
  const [pickupPoint, setPickupPoint] = useState(formData.shippingData?.pickupPoint || null)
  const [customerAddress, setCustomerAddress] = useState(formData.shippingData?.customerAddress || {
    street: '', city: '', zip: '', country: 'CZ',
  })

  const handleSelect = (option) => {
    setSelected(option)
    setPickupPoint(null)
  }

  // Zásilkovna widget
  const openZasilkovnaWidget = useCallback(() => {
    if (typeof window.Packeta === 'undefined') {
      alert('Widget Zásilkovny se nepodařilo načíst. Zkuste to prosím znovu.')
      return
    }
    window.Packeta.Widget.pick(
      import.meta.env.VITE_ZASILKOVNA_KEY || 'e0794fa94f498c06',
      (point) => {
        if (point) {
          setPickupPoint({
            id: String(point.id),
            name: point.nameStreet || point.name,
            address: `${point.street || ''}, ${point.city || ''} ${point.zip || ''}`.trim(),
          })
        }
      },
      { country: 'cz', language: 'cs' }
    )
  }, [])

  const canProceed = () => {
    if (!selected) return false
    if (selected.carrier === 'zasilkovna' && !pickupPoint) return false
    if (selected.method === 'courier_pickup') {
      return customerAddress.street && customerAddress.city && customerAddress.zip
    }
    return true
  }

  const handleNext = () => {
    updateForm({
      shippingOption: selected,
      shippingMethod: selected.method,
      shippingData: {
        carrier: selected.carrier,
        shippingMethod: selected.method,
        cost: selected.cost,
        pickupPoint: pickupPoint || null,
        customerAddress: selected.method === 'courier_pickup' ? customerAddress : null,
      },
    })
    onNext()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-2">Jak chcete odeslat zboží zpět?</h2>
      <p className="text-sm text-gray-500 mb-6">Vyberte způsob vrácení zboží. U placených variant bude částka účtována při odeslání.</p>

      {/* Zásilkovna widget script */}
      <ZasilkovnaScript />

      {/* Shipping options */}
      <div className="space-y-3 mb-6">
        {SHIPPING_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option)}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
              selected?.id === option.id
                ? 'border-[#1046A0] bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">{option.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-800">{option.label}</span>
                  <span className={`text-sm font-bold ${option.cost > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {option.cost > 0 ? `${option.cost} Kč` : 'Zdarma'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{option.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Zásilkovna pickup point selection */}
      {selected?.carrier === 'zasilkovna' && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Výdejní místo Zásilkovny</span>
            <button
              onClick={openZasilkovnaWidget}
              className="bg-[#BA1B02] text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:opacity-90"
            >
              {pickupPoint ? 'Změnit' : 'Vybrat místo'}
            </button>
          </div>
          {pickupPoint ? (
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="font-medium text-gray-800">{pickupPoint.name}</div>
              <div className="text-sm text-gray-500">{pickupPoint.address}</div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Zvolte výdejní místo kliknutím na tlačítko výše</p>
          )}
        </div>
      )}

      {/* Courier address form */}
      {selected?.method === 'courier_pickup' && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <span className="text-sm font-medium text-gray-700 block mb-3">Adresa pro vyzvednutí</span>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Ulice a číslo popisné"
              value={customerAddress.street}
              onChange={(e) => setCustomerAddress(prev => ({ ...prev, street: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Město"
                value={customerAddress.city}
                onChange={(e) => setCustomerAddress(prev => ({ ...prev, city: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="PSČ"
                value={customerAddress.zip}
                onChange={(e) => setCustomerAddress(prev => ({ ...prev, zip: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Self-ship info */}
      {selected?.method === 'self_ship' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="text-sm text-yellow-800">
            <strong>Adresa pro zaslání:</strong>
            <br />
            MROAUTO AUTODÍLY s.r.o.
            <br />
            {/* Address from env or default */}
            Reklamační oddělení, Průmyslová 1472, 280 02 Kolín
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
          &larr; Zpět
        </button>
        <button
          onClick={handleNext}
          disabled={!canProceed()}
          className="bg-[#1046A0] text-white px-6 py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          Pokračovat
        </button>
      </div>
    </div>
  )
}

/**
 * Loads the Zásilkovna widget script once.
 */
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
