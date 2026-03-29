import { useState } from 'react'
import axios from 'axios'

const apiBase = import.meta.env.VITE_API_URL || '/api'

const TYPE_LABELS = { return: 'Vrácení', complaint: 'Reklamace', warranty: 'Záruka' }

export default function Step4Confirm({ formData, onBack, onResult }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')

    try {
      const res = await axios.post(`${apiBase}/retino/public/returns/create`, {
        deliveryNoteId: formData.deliveryNote.id,
        type: formData.type,
        reasonCode: formData.reasonCode,
        reasonDetail: formData.reasonDetail || null,
        vehicleInfo: formData.vehicleInfo || null,
        wasMounted: formData.wasMounted,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone || null,
        items: formData.selectedItems.map(item => ({
          deliveryNoteItemId: item.id,
          qtyReturned: item.qtyReturned,
          condition: item.condition,
          itemNote: item.itemNote || null,
          images: [],
        })),
        shippingMethod: formData.shippingData?.shippingMethod || null,
        shippingData: formData.shippingData || null,
      })

      // Upload images if we have them and got an accessToken
      if (formData.uploadedImages?.length > 0 && res.data.accessToken) {
        for (const img of formData.uploadedImages) {
          try {
            const fd = new FormData()
            fd.append('file', img.file)
            await axios.post(
              `${apiBase}/retino/public/returns/${res.data.accessToken}/upload`,
              fd,
              { headers: { 'Content-Type': 'multipart/form-data' } }
            )
          } catch { /* image upload failure is non-critical */ }
        }
      }

      onResult(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Nepodařilo se odeslat žádost')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Shrnutí žádosti</h2>

      {/* Order info */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <div className="text-sm text-gray-500">Objednávka</div>
        <div className="font-medium text-gray-800">
          {formData.deliveryNote?.order_number || formData.deliveryNote?.invoice_number}
        </div>
      </div>

      {/* Type & reason */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm text-gray-500">Typ</div>
          <div className="font-medium text-gray-800">{TYPE_LABELS[formData.type] || formData.type}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm text-gray-500">Důvod</div>
          <div className="font-medium text-gray-800">{formData.reasonCode}</div>
        </div>
      </div>

      {/* Products */}
      <div className="mb-4">
        <div className="text-sm font-medium text-gray-700 mb-2">Produkty k vrácení:</div>
        {formData.selectedItems.map((item, i) => (
          <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-100">
            <span>{item.text} {item.brand && <span className="text-gray-400">({item.brand})</span>}</span>
            <span className="text-gray-600">{item.qtyReturned}x</span>
          </div>
        ))}
      </div>

      {/* Details */}
      {formData.reasonDetail && (
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="text-sm text-gray-500">Popis</div>
          <div className="text-sm text-gray-800">{formData.reasonDetail}</div>
        </div>
      )}
      {formData.vehicleInfo && (
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="text-sm text-gray-500">Vozidlo</div>
          <div className="text-sm text-gray-800">{formData.vehicleInfo}</div>
        </div>
      )}

      {/* Photos */}
      {formData.uploadedImages?.length > 0 && (
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-2">Fotografie ({formData.uploadedImages.length})</div>
          <div className="flex gap-2">
            {formData.uploadedImages.map((img, i) => (
              <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border">
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shipping */}
      {formData.shippingOption && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="text-sm text-gray-500">Doprava zpět</div>
          <div className="font-medium text-gray-800">
            {formData.shippingOption.icon} {formData.shippingOption.label}
            <span className={`ml-2 text-sm font-bold ${formData.shippingOption.cost > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {formData.shippingOption.cost > 0 ? `${formData.shippingOption.cost} Kč` : 'Zdarma'}
            </span>
          </div>
          {formData.shippingData?.pickupPoint && (
            <div className="text-sm text-gray-600 mt-1">
              {formData.shippingData.pickupPoint.name} — {formData.shippingData.pickupPoint.address}
            </div>
          )}
          {formData.shippingData?.customerAddress?.street && (
            <div className="text-sm text-gray-600 mt-1">
              {formData.shippingData.customerAddress.street}, {formData.shippingData.customerAddress.city} {formData.shippingData.customerAddress.zip}
            </div>
          )}
        </div>
      )}

      {/* Contact */}
      <div className="bg-gray-50 rounded-lg p-3 mb-6">
        <div className="text-sm text-gray-500">Kontakt</div>
        <div className="text-sm text-gray-800">
          {formData.customerName} | {formData.customerEmail}
          {formData.customerPhone && ` | ${formData.customerPhone}`}
        </div>
      </div>

      {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</div>}

      <div className="flex justify-between">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
          &larr; Zpět
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-[#D8112A] text-white px-8 py-3 rounded-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitting ? 'Odesílám...' : 'Odeslat žádost'}
        </button>
      </div>
    </div>
  )
}
