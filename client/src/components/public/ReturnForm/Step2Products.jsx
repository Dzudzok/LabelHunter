import { useState } from 'react'
import { useLang } from './i18n'

export default function Step2Products({ formData, updateForm, onNext, onBack }) {
  const { t } = useLang()
  const [selected, setSelected] = useState(formData.selectedItems || [])

  const toggleItem = (item) => {
    setSelected(prev => {
      const exists = prev.find(s => s.id === item.id)
      if (exists) return prev.filter(s => s.id !== item.id)
      return [...prev, { ...item, qtyReturned: item.qty, condition: 'unopened', itemNote: '' }]
    })
  }

  const updateItemQty = (id, qty) => {
    setSelected(prev => prev.map(s => s.id === id ? { ...s, qtyReturned: Math.min(Math.max(1, qty), s.qty) } : s))
  }

  const handleNext = () => {
    if (selected.length === 0) return
    updateForm({ selectedItems: selected })
    onNext()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900">{t('products.title')}</h2>
        </div>
        <p className="text-sm text-gray-500 mb-5 ml-[52px]">
          {t('products.order')}: <strong className="text-gray-700">{formData.deliveryNote?.order_number || formData.deliveryNote?.invoice_number}</strong>
        </p>

        <div className="space-y-2 mb-6">
          {formData.items.map((item) => {
            const isSelected = selected.some(s => s.id === item.id)
            const sel = selected.find(s => s.id === item.id)
            return (
              <div key={item.id}
                className={`border-2 rounded-xl p-4 cursor-pointer transition-all duration-200 ${
                  isSelected ? 'border-[#1046A0] bg-blue-50/50 shadow-sm' : 'border-gray-100 hover:border-gray-200 bg-white'
                }`}
                onClick={() => toggleItem(item)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-[#1046A0] border-[#1046A0]' : 'border-gray-300'
                    }`}>
                      {isSelected && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{item.text}</div>
                      <div className="text-xs text-gray-400">{item.brand && `${item.brand} · `}{item.code}</div>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full">{item.qty}x</span>
                </div>
                {isSelected && (
                  <div className="mt-3 ml-9 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <label className="text-xs text-gray-500 font-medium">{t('products.qtyLabel')}</label>
                    <input type="number" min={1} max={item.qty} value={sel?.qtyReturned || 1}
                      onChange={(e) => updateItemQty(item.id, parseInt(e.target.value) || 1)}
                      className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white focus:border-[#1046A0] focus:ring-2 focus:ring-blue-100 outline-none" />
                    <span className="text-xs text-gray-400">{t('products.of')} {item.qty}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <NavButtons onBack={onBack} onNext={handleNext} disabled={selected.length === 0} t={t} />
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
