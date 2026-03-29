import { useState, useEffect } from 'react'
import axios from 'axios'

const apiBase = import.meta.env.VITE_API_URL || '/api'

export default function Step3Details({ formData, updateForm, onNext, onBack }) {
  const [reasons, setReasons] = useState([])
  const [selectedReason, setSelectedReason] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    axios.get(`${apiBase}/retino/public/returns/reasons`, { params: { type: formData.type } })
      .then(res => setReasons(res.data))
      .catch(() => {})
  }, [formData.type])

  const handleReasonChange = (code) => {
    const reason = reasons.find(r => r.code === code)
    setSelectedReason(reason)
    updateForm({ reasonCode: code })
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setUploading(true)
    const newImages = []
    for (const file of files) {
      try {
        // Convert to base64 so preview survives page lifecycle; actual upload after return creation
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.readAsDataURL(file)
        })
        newImages.push({ file, preview: base64, name: file.name })
      } catch { /* ignore */ }
    }
    updateForm({ uploadedImages: [...(formData.uploadedImages || []), ...newImages] })
    setUploading(false)
  }

  const removeImage = (index) => {
    updateForm({
      uploadedImages: formData.uploadedImages.filter((_, i) => i !== index),
    })
  }

  const canProceed = formData.reasonCode && (
    !selectedReason?.requires_photos ||
    (formData.uploadedImages || []).length >= (selectedReason?.min_photos || 0)
  )

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Detaily žádosti</h2>

      {/* Type */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Typ žádosti</label>
        <div className="flex gap-2">
          {[{ value: 'return', label: 'Vrácení' }, { value: 'complaint', label: 'Reklamace' }, { value: 'warranty', label: 'Záruka' }].map(t => (
            <button
              key={t.value}
              onClick={() => { updateForm({ type: t.value, reasonCode: '' }); setSelectedReason(null) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                formData.type === t.value
                  ? 'bg-[#1046A0] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reason */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Důvod *</label>
        <select
          value={formData.reasonCode}
          onChange={(e) => handleReasonChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 outline-none"
        >
          <option value="">Vyberte důvod...</option>
          {reasons.map(r => <option key={r.code} value={r.code}>{r.label_cs}</option>)}
        </select>
      </div>

      {/* Vehicle info (for auto parts) */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Vozidlo (model, rok, motor)</label>
        <input
          type="text"
          value={formData.vehicleInfo}
          onChange={(e) => updateForm({ vehicleInfo: e.target.value })}
          placeholder="např. Škoda Octavia 2019 1.6 TDI"
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 outline-none"
        />
      </div>

      {/* Was mounted */}
      {selectedReason?.blocks_if_mounted && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.wasMounted}
              onChange={(e) => updateForm({ wasMounted: e.target.checked })}
              className="w-4 h-4"
            />
            <span>Díl byl namontován na vozidle</span>
          </label>
          {formData.wasMounted && (
            <div className="text-xs text-yellow-700 mt-1">
              Namontované díly nelze vrátit v rámci běžného vrácení. Můžete podat reklamaci.
            </div>
          )}
        </div>
      )}

      {/* Description */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Podrobný popis</label>
        <textarea
          value={formData.reasonDetail}
          onChange={(e) => updateForm({ reasonDetail: e.target.value })}
          rows={3}
          placeholder="Popište problém podrobněji..."
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 outline-none resize-none"
        />
      </div>

      {/* Photos */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Fotografie
          {selectedReason?.requires_photos && (
            <span className="text-red-500 ml-1">(min. {selectedReason.min_photos} povinné)</span>
          )}
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
        />
        {(formData.uploadedImages || []).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.uploadedImages.map((img, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 text-xs rounded-bl-lg"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contact */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
        <input
          type="tel"
          value={formData.customerPhone}
          onChange={(e) => updateForm({ customerPhone: e.target.value })}
          placeholder="+420..."
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 outline-none"
        />
      </div>

      <div className="flex justify-between mt-6">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
          &larr; Zpět
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="bg-[#1046A0] text-white px-6 py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          Pokračovat &rarr;
        </button>
      </div>
    </div>
  )
}
