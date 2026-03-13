export default function ItemList({ items, onSkipItem, onScanItem }) {
  const goodsItems = items.filter(i => i.item_type === 'goods')

  if (goodsItems.length === 0) {
    return (
      <div className="text-center py-4 text-theme-secondary text-sm">
        Zadne produkty k naskenovanim
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {goodsItems.map(item => {
        const scanned = parseFloat(item.scanned_qty) || 0
        const total = parseFloat(item.qty) || 1
        const isSkipped = item.scan_skipped || item.scan_verified
        const isComplete = scanned >= total || isSkipped
        const isPartial = scanned > 0 && scanned < total && !isSkipped

        return (
          <div
            key={item.id}
            className={`rounded-lg px-3 py-2 border-2 transition-colors ${
              isComplete
                ? 'bg-green-900/30 border-green-600'
                : isPartial
                ? 'bg-yellow-900/30 border-yellow-600'
                : 'bg-navy-700 border-navy-600'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Checkbox */}
              <div className="text-lg shrink-0">
                {isComplete ? (
                  <span className="text-green-400">&#10003;</span>
                ) : (
                  <span className="text-theme-muted">&#9744;</span>
                )}
              </div>

              {/* Quantity counter */}
              <div className={`text-base font-bold shrink-0 min-w-[50px] text-center ${
                isComplete ? 'text-green-400' : isPartial ? 'text-yellow-400' : 'text-theme-secondary'
              }`}>
                {scanned}z{total}
              </div>

              {/* Product info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {item.brand && (
                    <span className="text-xs font-semibold text-brand-orange bg-brand-orange/20 px-1.5 py-0.5 rounded">
                      {item.brand}
                    </span>
                  )}
                  <span className="text-sm font-mono text-theme-secondary truncate">
                    {item.code}
                  </span>
                </div>
                <div className="text-xs text-theme-muted truncate">
                  {item.name || item.text}
                </div>
              </div>

              {/* Skip button */}
              {!isComplete && !isSkipped && (
                <button
                  onClick={() => onSkipItem(item.id)}
                  className="bg-navy-600 hover:bg-navy-500 text-theme-secondary hover:text-theme-primary px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors"
                >
                  Skip
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
