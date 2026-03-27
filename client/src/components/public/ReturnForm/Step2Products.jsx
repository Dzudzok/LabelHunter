import { useState } from 'react'

export default function Step2Products({ formData, updateForm, onNext, onBack }) {
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
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-2">Vyberte produkty k vrácení</h2>
      <p className="text-sm text-gray-500 mb-4">
        Objednávka: <strong>{formData.deliveryNote?.order_number || formData.deliveryNote?.invoice_number}</strong>
      </p>

      <div className="space-y-2 mb-6">
        {formData.items.map((item) => {
          const isSelected = selected.some(s => s.id === item.id)
          const sel = selected.find(s => s.id === item.id)
          return (
            <div
              key={item.id}
              className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => toggleItem(item)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  }`}>
                    {isSelected && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{item.text}</div>
                    <div className="text-xs text-gray-400">
                      {item.brand && `${item.brand} | `}{item.code}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">{item.qty}x</div>
              </div>

              {isSelected && (
                <div className="mt-3 ml-8 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <label className="text-xs text-gray-500">Počet k vrácení:</label>
                  <input
                    type="number"
                    min={1}
                    max={item.qty}
                    value={sel?.qtyReturned || 1}
                    onChange={(e) => updateItemQty(item.id, parseInt(e.target.value) || 1)}
                    className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center"
                  />
                  <span className="text-xs text-gray-400">z {item.qty}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
          &larr; Zpět
        </button>
        <button
          onClick={handleNext}
          disabled={selected.length === 0}
          className="bg-[#1046A0] text-white px-6 py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          Pokračovat &rarr;
        </button>
      </div>
    </div>
  )
}
