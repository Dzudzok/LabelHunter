import { useState } from 'react'
import axios from 'axios'
import { useLang } from './i18n'

const apiBase = import.meta.env.VITE_API_URL || '/api'

export default function Step4Confirm({ formData, onBack, onResult }) {
  const { t } = useLang()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const TYPE_LABELS = { return: t('details.type.return'), complaint: t('details.type.complaint'), warranty: t('details.type.warranty') }

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
        vin: formData.vin || null,
        workshopName: formData.workshopName || null,
        workshopAddress: formData.workshopAddress || null,
        extraCostsDescription: formData.extraCostsDescription || null,
        extraCostsAmount: formData.extraCostsAmount ? parseFloat(formData.extraCostsAmount) : null,
        wasMounted: formData.wasMounted,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone || null,
        bankAccount: formData.bankAccount,
        items: formData.selectedItems.map(item => ({
          deliveryNoteItemId: item.id, qtyReturned: item.qtyReturned,
          condition: item.condition, itemNote: item.itemNote || null, images: [],
        })),
        shippingMethod: formData.shippingData?.shippingMethod || null,
        shippingData: formData.shippingData || null,
      })

      // Upload images + receipts
      const allUploads = [...(formData.uploadedImages || []), ...(formData.extraCostsReceipts || [])]
      if (allUploads.length > 0 && res.data.accessToken) {
        for (const file of allUploads) {
          try {
            const fd = new FormData()
            fd.append('file', file.file)
            await axios.post(`${apiBase}/retino/public/returns/${res.data.accessToken}/upload`, fd,
              { headers: { 'Content-Type': 'multipart/form-data' } })
          } catch {}
        }
      }
      console.log('[ReturnForm] Create result:', JSON.stringify(res.data))
      onResult(res.data)
    } catch (err) {
      setError(err.response?.data?.error || t('confirm.error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">{t('confirm.title')}</h2>

      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <div className="text-sm text-gray-500">{t('confirm.order')}</div>
        <div className="font-medium text-gray-800">{formData.deliveryNote?.order_number || formData.deliveryNote?.invoice_number}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm text-gray-500">{t('confirm.type')}</div>
          <div className="font-medium text-gray-800">{TYPE_LABELS[formData.type] || formData.type}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm text-gray-500">{t('confirm.reason')}</div>
          <div className="font-medium text-gray-800">{formData.reasonCode}</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-sm font-medium text-gray-700 mb-2">{t('confirm.products')}</div>
        {formData.selectedItems.map((item, i) => (
          <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-100">
            <span>{item.text} {item.brand && <span className="text-gray-400">({item.brand})</span>}</span>
            <span className="text-gray-600">{item.qtyReturned}x</span>
          </div>
        ))}
      </div>

      {formData.vin && (
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="text-sm text-gray-500">{t('confirm.vin')}</div>
          <div className="text-sm text-gray-800 font-mono">{formData.vin}</div>
        </div>
      )}

      {formData.workshopName && (
        <div className="bg-orange-50 rounded-lg p-3 mb-4">
          <div className="text-sm text-gray-500">{t('confirm.workshop')}</div>
          <div className="text-sm text-gray-800">{formData.workshopName}</div>
          {formData.workshopAddress && <div className="text-xs text-gray-500">{formData.workshopAddress}</div>}
        </div>
      )}

      {formData.extraCostsAmount && parseFloat(formData.extraCostsAmount) > 0 && (
        <div className="bg-purple-50 rounded-lg p-3 mb-4">
          <div className="text-sm text-gray-500">{t('confirm.extraCosts')}</div>
          <div className="text-sm text-gray-800">{formData.extraCostsDescription}</div>
          <div className="font-medium text-purple-700">{parseFloat(formData.extraCostsAmount).toFixed(2)} CZK</div>
          {formData.extraCostsReceipts?.length > 0 && (
            <div className="text-xs text-gray-500 mt-1">{t('confirm.documents')}: {formData.extraCostsReceipts.length} {t('confirm.files')}</div>
          )}
        </div>
      )}

      {formData.reasonDetail && (
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="text-sm text-gray-500">{t('confirm.desc')}</div>
          <div className="text-sm text-gray-800">{formData.reasonDetail}</div>
        </div>
      )}

      {formData.vehicleInfo && (
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="text-sm text-gray-500">{t('confirm.vehicle')}</div>
          <div className="text-sm text-gray-800">{formData.vehicleInfo}</div>
        </div>
      )}

      {formData.uploadedImages?.length > 0 && (
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-2">{t('confirm.photos')} ({formData.uploadedImages.length})</div>
          <div className="flex gap-2">
            {formData.uploadedImages.map((img, i) => (
              <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border">
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {formData.shippingOption && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="text-sm text-gray-500">{t('confirm.shipping')}</div>
          <div className="font-medium text-gray-800">
            {formData.shippingOption.icon} {formData.shippingOption.label}
            <span className={`ml-2 text-sm font-bold ${formData.shippingOption.cost > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {formData.shippingOption.cost > 0 ? `${formData.shippingOption.cost} Kč` : t('transport.free')}
            </span>
          </div>
          {formData.shippingData?.pickupPoint && (
            <div className="text-sm text-gray-600 mt-1">{formData.shippingData.pickupPoint.name} — {formData.shippingData.pickupPoint.address}</div>
          )}
        </div>
      )}

      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
        <div className="text-sm text-gray-500">{t('confirm.bankAccount')}</div>
        <div className="font-medium text-gray-800 font-mono">{formData.bankAccount}</div>
      </div>

      <div className="bg-gray-50 rounded-lg p-3 mb-6">
        <div className="text-sm text-gray-500">{t('confirm.contact')}</div>
        <div className="text-sm text-gray-800">
          {formData.customerName} | {formData.customerEmail}
          {formData.customerPhone && ` | ${formData.customerPhone}`}
        </div>
      </div>

      {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</div>}

      <div className="flex justify-between">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 text-sm font-medium">&larr; {t('common.back')}</button>
        <button onClick={handleSubmit} disabled={submitting}
          className="bg-[#D8112A] text-white px-8 py-3 rounded-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
          {submitting ? t('confirm.submitting') : t('confirm.submit')}
        </button>
      </div>
    </div>
  )
}
