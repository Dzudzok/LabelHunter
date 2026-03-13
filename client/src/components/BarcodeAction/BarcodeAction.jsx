import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

export default function BarcodeAction({ value, label, onConfirm }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: 3,
          height: 200,
          displayValue: true,
          fontSize: 24,
          background: 'transparent',
          lineColor: '#ffffff',
          margin: 20,
          textMargin: 10,
        })
      } catch {
        // Fallback if JsBarcode fails
      }
    }
  }, [value])

  if (!value) return null

  return (
    <div className="bg-navy-900 rounded-xl p-6 border-2 border-navy-600 flex flex-col items-center">
      {/* Label text */}
      {label && (
        <div className="text-xl font-semibold text-theme-secondary mb-4 text-center">
          {label}
        </div>
      )}

      {/* Barcode SVG */}
      <div className="w-full flex justify-center py-4">
        <svg ref={svgRef} className="max-w-full" />
      </div>

      {/* Code text */}
      <div className="text-lg font-mono text-theme-secondary mt-2 text-center">
        {value}
      </div>

      {/* Confirm button */}
      {onConfirm && (
        <button
          onClick={onConfirm}
          className="mt-6 w-full bg-brand-orange hover:bg-brand-orange-dark text-white py-4 rounded-xl text-xl font-bold transition-colors"
        >
          Potvrdit
        </button>
      )}
    </div>
  )
}
