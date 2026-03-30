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
    const reason = reasons.find(r => r.code === code)
    setSelectedReason(reason)
    updateForm({ reasonCode: code })
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    const newImages = []
    for (const file of files) {
      try {
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.readAsDataURL(file)
        })
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
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.readAsDataURL(file)
        })
        newReceipts.push({ file, preview: base64, name: file.name })
      } catch {}
    }
    updateForm({ extraCostsReceipts: [...(formData.extraCostsReceipts || []), ...newReceipts] })
  }

  const canProceed = () => {
    if (!formData.reasonCode) return false
    if (!formData.bankAccount?.trim()) return false
    if (selectedReason?.requires_photos && (formData.uploadedImages || []).length < (selectedReason?.min_photos || 0)) return false
    if (isComplaint && !formData.vin?.trim()) return false
    return true
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">{t('details.title')}</h2>

      {/* Type */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('details.typeLabel')}</label>
        <div className="flex gap-2">
          {[{ value: 'return', key: 'details.type.return' }, { value: 'complaint', key: 'details.type.complaint' }, { value: 'warranty', key: 'details.type.warranty' }].map(tp => (
            <button key={tp.value}
              onClick={() => { updateForm({ type: tp.value, reasonCode: '' }); setSelectedReason(null) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                formData.type === tp.value ? 'bg-[#1046A0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>{t(tp.key)}</button>
          ))}
        </div>
      </div>

      {/* Reason */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('details.reasonLabel')} *</label>
        <select value={formData.reasonCode} onChange={(e) => handleReasonChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 outline-none">
          <option value="">{t('details.reasonPlaceholder')}</option>
          {reasons.map(r => <option key={r.code} value={r.code}>{r.label_cs}</option>)}
        </select>
      </div>

      {/* Vehicle */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('details.vehicleLabel')}</label>
        <input type="text" value={formData.vehicleInfo}
          onChange={(e) => updateForm({ vehicleInfo: e.target.value })}
          placeholder={t('details.vehiclePlaceholder')}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 outline-none" />
      </div>

      {/* VIN */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('details.vinLabel')} {isComplaint ? <span className="text-red-500">*</span> : <span className="text-gray-400 text-xs ml-1">({t('details.vinOptional')})</span>}
        </label>
        <input type="text" value={formData.vin || ''}
          onChange={(e) => updateForm({ vin: e.target.value.toUpperCase() })}
          placeholder={t('details.vinPlaceholder')} maxLength={17}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 outline-none font-mono" />
        {isComplaint && !formData.vin?.trim() && (
          <p className="text-xs text-red-500 mt-1">{t('details.vinRequired')}</p>
        )}
      </div>

      {/* Workshop */}
      {(isComplaint || isWarranty) && (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <label className="block text-sm font-semibold text-orange-800 mb-2">{t('details.workshopTitle')}</label>
          <p className="text-xs text-orange-600 mb-3">{t('details.workshopDesc')}</p>
          <div className="space-y-2">
            <input type="text" value={formData.workshopName || ''}
              onChange={(e) => updateForm({ workshopName: e.target.value })}
              placeholder={t('details.workshopName')}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 outline-none" />
            <input type="text" value={formData.workshopAddress || ''}
              onChange={(e) => updateForm({ workshopAddress: e.target.value })}
              placeholder={t('details.workshopAddress')}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 outline-none" />
          </div>
        </div>
      )}

      {/* Was mounted */}
      {selectedReason?.blocks_if_mounted && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={formData.wasMounted}
              onChange={(e) => updateForm({ wasMounted: e.target.checked })} className="w-4 h-4" />
            <span>{t('details.mountedLabel')}</span>
          </label>
          {formData.wasMounted && <div className="text-xs text-yellow-700 mt-1">{t('details.mountedWarning')}</div>}
        </div>
      )}

      {/* Description */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('details.descLabel')}</label>
        <textarea value={formData.reasonDetail} onChange={(e) => updateForm({ reasonDetail: e.target.value })}
          rows={3} placeholder={t('details.descPlaceholder')}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 outline-none resize-none" />
      </div>

      {/* Extra costs — complaints only */}
      {isComplaint && (
        <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <label className="block text-sm font-semibold text-purple-800 mb-2">{t('details.extraCostsTitle')}</label>
          <p className="text-xs text-purple-600 mb-3">{t('details.extraCostsDesc')}</p>
          <div className="space-y-2">
            <input type="text" value={formData.extraCostsDescription || ''}
              onChange={(e) => updateForm({ extraCostsDescription: e.target.value })}
              placeholder={t('details.extraCostsPlaceholder')}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 outline-none" />
            <div className="flex gap-2">
              <input type="number" step="0.01" min="0" value={formData.extraCostsAmount || ''}
                onChange={(e) => updateForm({ extraCostsAmount: e.target.value })}
                placeholder={t('details.extraCostsAmount')}
                className="w-40 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 outline-none" />
              <label className="flex-1 cursor-pointer bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1">
                {t('details.extraCostsAttach')}
                <input type="file" accept="image/*,application/pdf" multiple onChange={handleReceiptUpload} className="hidden" />
              </label>
            </div>
            {(formData.extraCostsReceipts || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {formData.extraCostsReceipts.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded">
                    {r.name}
                    <button onClick={() => updateForm({ extraCostsReceipts: formData.extraCostsReceipts.filter((_, j) => j !== i) })}
                      className="text-purple-400 hover:text-purple-600">&times;</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photos */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('details.photosLabel')}
          {selectedReason?.requires_photos && <span className="text-red-500 ml-1">({t('details.photosRequired', { n: selectedReason.min_photos })})</span>}
        </label>
        <input type="file" accept="image/*" multiple onChange={handleFileUpload}
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100" />
        {(formData.uploadedImages || []).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.uploadedImages.map((img, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                <button onClick={() => updateForm({ uploadedImages: formData.uploadedImages.filter((_, j) => j !== i) })}
                  className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 text-xs rounded-bl-lg">x</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Phone */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('details.phoneLabel')}</label>
        <input type="tel" value={formData.customerPhone}
          onChange={(e) => updateForm({ customerPhone: e.target.value })} placeholder="+420..."
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 outline-none" />
      </div>

      {/* Bank account */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('details.bankLabel')} <span className="text-red-500">*</span>
        </label>
        <input type="text" value={formData.bankAccount || ''}
          onChange={(e) => updateForm({ bankAccount: e.target.value })}
          placeholder={t('details.bankPlaceholder')}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 outline-none font-mono" />
        <p className="text-xs text-gray-400 mt-1">{t('details.bankHint')}</p>
        {!formData.bankAccount?.trim() && <p className="text-xs text-red-500 mt-1">{t('details.bankRequired')}</p>}
      </div>

      <div className="flex justify-between mt-6">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 text-sm font-medium">&larr; {t('common.back')}</button>
        <button onClick={onNext} disabled={!canProceed()}
          className="bg-[#1046A0] text-white px-6 py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-40">
          {t('common.continue')} &rarr;
        </button>
      </div>
    </div>
  )
}
