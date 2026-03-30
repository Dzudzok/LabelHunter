import { useState, useEffect } from 'react'
import axios from 'axios'
import { useLang } from './i18n'

const apiBase = import.meta.env.VITE_API_URL || '/api'

export default function Step3Details({ formData, updateForm, onNext, onBack }) {
  const { t } = useLang()
  const [reasons, setReasons] = useState([])
  const [selectedReason, setSelectedReason] = useState(null)

  const isComplaint = formData.type === 'complaint'
  const isWarranty = formData.type === 'warranty'

  useEffect(() => {
    axios.get(`${apiBase}/retino/public/returns/reasons`, { params: { type: formData.type } })
      .then(res => setReasons(res.data)).catch(() => {})
  }, [formData.type])

  const handleReasonChange = (code) => {
    const reason = reasons.find(r => r.code === code) || null
    setSelectedReason(reason)
    updateForm({ reasonCode: code, reasonLabel: reason?.label_cs || code })
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    const newImages = []
    for (const file of files) {
      try {
        const base64 = await new Promise((r) => { const reader = new FileReader(); reader.onload = () => r(reader.result); reader.readAsDataURL(file) })
        newImages.push({ file, preview: base64, name: file.name })
      } catch {}
    }
    updateForm({ uploadedImages: [...(formData.uploadedImages || []), ...newImages] })
  }

  const handleReceiptUpload = async (e) => {
    const files = Array.from(e.target.files)
    const newReceipts = []
    for (const file of files) {
      try {
        const base64 = await new Promise((r) => { const reader = new FileReader(); reader.onload = () => r(reader.result); reader.readAsDataURL(file) })
        newReceipts.push({ file, preview: base64, name: file.name })
      } catch {}
    }
    updateForm({ extraCostsReceipts: [...(formData.extraCostsReceipts || []), ...newReceipts] })
  }

  const canProceed = () => {
    if (!formData.reasonCode || !formData.bankAccount?.trim()) return false
    if (selectedReason?.requires_photos && (formData.uploadedImages || []).length < (selectedReason?.min_photos || 0)) return false
    if (isComplaint && !formData.vin?.trim()) return false
    return true
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:bg-white focus:border-[#1046A0] focus:ring-2 focus:ring-blue-100 outline-none transition-all"
  const labelCls = "block text-sm font-semibold text-gray-700 mb-1.5"

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900">{t('details.title')}</h2>
        </div>

        {/* Type pills */}
        <div className="mb-5">
          <label className={labelCls}>{t('details.typeLabel')}</label>
          <div className="flex gap-2">
            {[{ value: 'return', key: 'details.type.return', color: 'blue' }, { value: 'complaint', key: 'details.type.complaint', color: 'red' }, { value: 'warranty', key: 'details.type.warranty', color: 'purple' }].map(tp => (
              <button key={tp.value}
                onClick={() => { updateForm({ type: tp.value, reasonCode: '' }); setSelectedReason(null) }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  formData.type === tp.value
                    ? 'bg-gradient-to-r from-[#1046A0] to-[#0d3a85] text-white shadow-md'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>{t(tp.key)}</button>
            ))}
          </div>
        </div>

        {/* Reason */}
        <div className="mb-4">
          <label className={labelCls}>{t('details.reasonLabel')} <span className="text-red-500">*</span></label>
          <select value={formData.reasonCode} onChange={(e) => handleReasonChange(e.target.value)} className={inputCls}>
            <option value="">{t('details.reasonPlaceholder')}</option>
            {reasons.map(r => <option key={r.code} value={r.code}>{r.label_cs}</option>)}
          </select>
        </div>

        {/* Vehicle + VIN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className={labelCls}>{t('details.vehicleLabel')}</label>
            <input type="text" value={formData.vehicleInfo} onChange={(e) => updateForm({ vehicleInfo: e.target.value })}
              placeholder={t('details.vehiclePlaceholder')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>
              {t('details.vinLabel')} {isComplaint ? <span className="text-red-500">*</span> : <span className="text-gray-400 text-xs">({t('details.vinOptional')})</span>}
            </label>
            <input type="text" value={formData.vin || ''} onChange={(e) => updateForm({ vin: e.target.value.toUpperCase() })}
              placeholder={t('details.vinPlaceholder')} maxLength={17} className={`${inputCls} font-mono`} />
            {isComplaint && !formData.vin?.trim() && <p className="text-xs text-red-500 mt-1">{t('details.vinRequired')}</p>}
          </div>
        </div>

        {/* Workshop — complaints/warranty */}
        {(isComplaint || isWarranty) && (
          <div className="mb-4 p-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              <label className="text-sm font-bold text-orange-800">{t('details.workshopTitle')}</label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="text" value={formData.workshopName || ''} onChange={(e) => updateForm({ workshopName: e.target.value })}
                placeholder={t('details.workshopName')} className={inputCls} />
              <input type="text" value={formData.workshopAddress || ''} onChange={(e) => updateForm({ workshopAddress: e.target.value })}
                placeholder={t('details.workshopAddress')} className={inputCls} />
            </div>
          </div>
        )}

        {/* Was mounted */}
        {selectedReason?.blocks_if_mounted && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={formData.wasMounted} onChange={(e) => updateForm({ wasMounted: e.target.checked })} className="w-4 h-4 rounded" />
              <span className="font-medium">{t('details.mountedLabel')}</span>
            </label>
            {formData.wasMounted && <p className="text-xs text-yellow-700 mt-1.5 ml-6">{t('details.mountedWarning')}</p>}
          </div>
        )}

        {/* Description */}
        <div className="mb-4">
          <label className={labelCls}>{t('details.descLabel')}</label>
          <textarea value={formData.reasonDetail} onChange={(e) => updateForm({ reasonDetail: e.target.value })}
            rows={3} placeholder={t('details.descPlaceholder')} className={`${inputCls} resize-none`} />
        </div>

        {/* Extra costs — complaints */}
        {isComplaint && (
          <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              <label className="text-sm font-bold text-purple-800">{t('details.extraCostsTitle')}</label>
            </div>
            <p className="text-xs text-purple-600 mb-3">{t('details.extraCostsDesc')}</p>
            <input type="text" value={formData.extraCostsDescription || ''} onChange={(e) => updateForm({ extraCostsDescription: e.target.value })}
              placeholder={t('details.extraCostsPlaceholder')} className={`${inputCls} mb-2`} />
            <div className="flex gap-2">
              <input type="number" step="0.01" min="0" value={formData.extraCostsAmount || ''} onChange={(e) => updateForm({ extraCostsAmount: e.target.value })}
                placeholder={t('details.extraCostsAmount')} className={`w-36 ${inputCls}`} />
              <label className="flex-1 cursor-pointer bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-semibold px-4 py-3 rounded-xl transition-colors flex items-center justify-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                {t('details.extraCostsAttach')}
                <input type="file" accept="image/*,application/pdf" multiple onChange={handleReceiptUpload} className="hidden" />
              </label>
            </div>
            {(formData.extraCostsReceipts || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {formData.extraCostsReceipts.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs px-2.5 py-1 rounded-lg">
                    {r.name}
                    <button onClick={() => updateForm({ extraCostsReceipts: formData.extraCostsReceipts.filter((_, j) => j !== i) })}
                      className="text-purple-400 hover:text-purple-600 font-bold">&times;</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Photos */}
        <div className="mb-4">
          <label className={labelCls}>
            {t('details.photosLabel')}
            {selectedReason?.requires_photos && <span className="text-red-500 ml-1">({t('details.photosRequired', { n: selectedReason.min_photos })})</span>}
          </label>
          <label className="block w-full border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-[#1046A0] hover:bg-blue-50/30 transition-all">
            <svg className="w-8 h-8 mx-auto text-gray-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span className="text-sm text-gray-500">{t('details.photosLabel')}</span>
            <input type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
          </label>
          {(formData.uploadedImages || []).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {formData.uploadedImages.map((img, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-gray-100 shadow-sm">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => updateForm({ uploadedImages: formData.uploadedImages.filter((_, j) => j !== i) })}
                    className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 text-xs rounded-bl-lg font-bold">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Phone + Bank */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className={labelCls}>{t('details.phoneLabel')}</label>
            <input type="tel" value={formData.customerPhone} onChange={(e) => updateForm({ customerPhone: e.target.value })} placeholder="+420..." className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('details.bankLabel')} <span className="text-red-500">*</span></label>
            <input type="text" value={formData.bankAccount || ''} onChange={(e) => updateForm({ bankAccount: e.target.value })}
              placeholder={t('details.bankPlaceholder')} className={`${inputCls} font-mono`} />
            {!formData.bankAccount?.trim() && <p className="text-xs text-red-500 mt-1">{t('details.bankRequired')}</p>}
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-4">{t('details.bankHint')}</p>

        <NavButtons onBack={onBack} onNext={onNext} disabled={!canProceed()} t={t} />
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
