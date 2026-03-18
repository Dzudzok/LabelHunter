import { useState } from 'react'

export default function ItemList({ items, onSkipItem, onScanItem }) {
  const goodsItems = items.filter(i => i.item_type === 'goods')

  if (goodsItems.length === 0) {
    return (
      <div className="text-center py-6 text-theme-secondary">
        Brak produktów do skanowania
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {goodsItems.map(item => (
        <ItemRow key={item.id} item={item} onSkipItem={onSkipItem} onScanItem={onScanItem} />
      ))}
    </div>
  )
}

function ItemRow({ item, onSkipItem, onScanItem }) {
  const scanned = parseFloat(item.scanned_qty) || 0
  const total = parseFloat(item.qty) || 1
  const isSkipped = item.scan_skipped
  const isComplete = scanned >= total || isSkipped
  const isPartial = scanned > 0 && scanned < total && !isSkipped
  const [showInput, setShowInput] = useState(false)
  const [inputVal, setInputVal] = useState('')

  const handleSetQty = () => {
    const val = parseInt(inputVal)
    if (val > 0) {
      onScanItem(item.id, val)
    }
    setShowInput(false)
    setInputVal('')
  }

  return (
    <div
      className={`rounded-xl px-4 py-3 border-2 transition-colors ${
        isComplete
          ? 'bg-green-900/30 border-green-600'
          : isPartial
          ? 'bg-yellow-900/30 border-yellow-600'
          : 'bg-navy-700 border-navy-600'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Checkbox */}
        <div className="text-2xl shrink-0">
          {isComplete ? (
            <span className="text-green-400">&#10003;</span>
          ) : (
            <span className="text-theme-muted">&#9744;</span>
          )}
        </div>

        {/* Quantity counter */}
        <div className={`text-xl font-bold shrink-0 min-w-[60px] text-center ${
          isComplete ? 'text-green-400' : isPartial ? 'text-yellow-400' : 'text-theme-secondary'
        }`}>
          {scanned} / {total}
        </div>

        {/* Product info */}
        <div className="flex-1 min-w-0">
          <div className="text-lg text-theme-primary font-bold truncate">
            {item.name || item.text}
          </div>
          <div className="text-sm text-theme-secondary font-mono truncate mt-0.5">
            {item.ean || item.code}
          </div>
        </div>

        {/* Manual scan and Skip buttons */}
        {!isComplete && !isSkipped && (
          <div className="flex gap-2 shrink-0 items-center">
            {showInput ? (
              <div className="flex gap-1 items-center">
                <input
                  type="number"
                  min="1"
                  autoFocus
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSetQty()
                    if (e.key === 'Escape') { setShowInput(false); setInputVal('') }
                  }}
                  onBlur={() => { setShowInput(false); setInputVal('') }}
                  placeholder={String(total)}
                  className="w-16 bg-navy-900 border border-blue-500 text-theme-primary rounded-lg px-2 py-1.5 text-sm text-center outline-none"
                />
                <button
                  onMouseDown={e => { e.preventDefault(); handleSetQty() }}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1.5 rounded-lg text-sm font-bold transition-colors"
                >
                  OK
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => onScanItem(item.id, scanned + 1)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors"
                  title="Ręcznie dodaj 1 sztukę"
                >
                  +1
                </button>
                <button
                  onClick={() => { setShowInput(true); setInputVal(String(total)) }}
                  className="bg-blue-900 hover:bg-blue-800 text-blue-300 hover:text-blue-200 px-3 py-2 rounded-lg text-sm font-bold transition-colors"
                  title="Wpisz ilość ręcznie"
                >
                  #
                </button>
              </>
            )}
            <button
              onClick={() => onSkipItem(item.id)}
              className="bg-navy-600 hover:bg-navy-500 text-theme-secondary hover:text-theme-primary px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Pomiń
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
