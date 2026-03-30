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
        deliveryNoteId: formData.deliveryNote.id, type: formData.type,
        reasonCode: formData.reasonCode, reasonDetail: formData.reasonDetail || null,
        vehicleInfo: formData.vehicleInfo || null, vin: formData.vin || null,
        workshopName: formData.workshopName || null, workshopAddress: formData.workshopAddress || null,
        extraCostsDescription: formData.extraCostsDescription || null,
        extraCostsAmount: formData.extraCostsAmount ? parseFloat(formData.extraCostsAmount) : null,
        wasMounted: formData.wasMounted, customerName: formData.customerName,
        customerEmail: formData.customerEmail, customerPhone: formData.customerPhone || null,
        bankAccount: formData.bankAccount,
        items: formData.selectedItems.map(item => ({ deliveryNoteItemId: item.id, qtyReturned: item.qtyReturned, condition: item.condition, itemNote: item.itemNote || null, images: [] })),
        shippingMethod: formData.shippingData?.shippingMethod || null, shippingData: formData.shippingData || null,
      })
      console.log('[ReturnForm] Create result:', JSON.stringify(res.data))
      const allUploads = [...(formData.uploadedImages || []), ...(formData.extraCostsReceipts || [])]
      if (allUploads.length > 0 && res.data.accessToken) {
        for (const file of allUploads) {
          try {
            const fd = new FormData()
            fd.append('file', file.file)
            await axios.post(`${apiBase}/retino/public/returns/${res.data.accessToken}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
          } catch {}
        }
      }
      onResult(res.data)
    } catch (err) { setError(err.response?.data?.error || t('confirm.error')) }
    finally { setSubmitting(false) }
  }

  const Section = ({ label, children, icon, bgClass }) => (
    <div className={`rounded-xl p-3.5 mb-3 ${bgClass || 'bg-gray-50'}`}>
      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
        {icon}{label}
      </div>
      {children}
    </div>
  )

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900">{t('confirm.title')}</h2>
        </div>

        <Section label={t('confirm.order')}>
          <div className="font-bold text-gray-800 text-lg">{formData.deliveryNote?.order_number || formData.deliveryNote?.invoice_number}</div>
        </Section>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <Section label={t('confirm.type')}>
            <div className="font-semibold text-gray-800">{TYPE_LABELS[formData.type] || formData.type}</div>
          </Section>
          <Section label={t('confirm.reason')}>
            <div className="font-semibold text-gray-800">{formData.reasonCode}</div>
          </Section>
        </div>

        <Section label={t('confirm.products')}>
          {formData.selectedItems.map((item, i) => (
            <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-gray-700">{item.text} {item.brand && <span className="text-gray-400">({item.brand})</span>}</span>
              <span className="font-semibold text-gray-500">{item.qtyReturned}×</span>
            </div>
          ))}
        </Section>

        {formData.vin && <Section label={t('confirm.vin')}><div className="font-mono font-semibold text-gray-800">{formData.vin}</div></Section>}

        {formData.workshopName && (
          <Section label={t('confirm.workshop')} bgClass="bg-orange-50">
            <div className="font-semibold text-gray-800">{formData.workshopName}</div>
            {formData.workshopAddress && <div className="text-xs text-gray-500">{formData.workshopAddress}</div>}
          </Section>
        )}

        {formData.extraCostsAmount && parseFloat(formData.extraCostsAmount) > 0 && (
          <Section label={t('confirm.extraCosts')} bgClass="bg-purple-50">
            <div className="text-sm text-gray-700">{formData.extraCostsDescription}</div>
            <div className="font-bold text-purple-700 mt-1">{parseFloat(formData.extraCostsAmount).toFixed(2)} CZK</div>
          </Section>
        )}

        {formData.reasonDetail && <Section label={t('confirm.desc')}><div className="text-sm text-gray-700">{formData.reasonDetail}</div></Section>}
        {formData.vehicleInfo && <Section label={t('confirm.vehicle')}><div className="text-sm text-gray-700">{formData.vehicleInfo}</div></Section>}

        {formData.uploadedImages?.length > 0 && (
          <Section label={`${t('confirm.photos')} (${formData.uploadedImages.length})`}>
            <div className="flex gap-2 mt-1">
              {formData.uploadedImages.map((img, i) => (
                <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </Section>
        )}

        {formData.shippingOption && (
          <Section label={t('confirm.shipping')} bgClass="bg-blue-50">
            <div className="flex items-center gap-2">
              <span className="text-xl">{formData.shippingOption.icon}</span>
              <span className="font-semibold text-gray-800">{formData.shippingOption.label}</span>
              <span className={`text-sm font-bold ml-auto px-2 py-0.5 rounded-full ${formData.shippingOption.cost > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                {formData.shippingOption.cost > 0 ? `${formData.shippingOption.cost} Kč` : t('transport.free')}
              </span>
            </div>
            {formData.shippingData?.pickupPoint && (
              <div className="text-sm text-gray-500 mt-1">{formData.shippingData.pickupPoint.name} — {formData.shippingData.pickupPoint.address}</div>
            )}
          </Section>
        )}

        <Section label={t('confirm.bankAccount')} bgClass="bg-green-50">
          <div className="font-mono font-bold text-gray-800">{formData.bankAccount}</div>
        </Section>

        <Section label={t('confirm.contact')}>
          <div className="text-sm text-gray-700">
            {formData.customerName} · {formData.customerEmail}
            {formData.customerPhone && ` · ${formData.customerPhone}`}
          </div>
        </Section>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 p-3 rounded-xl mb-4">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-4">
          <button onClick={onBack} className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            {t('common.back')}
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-2 bg-gradient-to-r from-[#D8112A] to-[#B50E23] text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-red-200 hover:shadow-red-300 hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 transition-all">
            {submitting ? (
              <><svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>{t('confirm.submitting')}</>
            ) : (
              <>{t('confirm.submit')}<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
