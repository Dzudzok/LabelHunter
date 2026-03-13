import { useRef, useEffect } from 'react'

export default function ScannerInput({ onScan, placeholder, className }) {
  const inputRef = useRef(null)

  // Maintain auto-focus
  useEffect(() => {
    const focusInput = () => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus()
      }
    }

    focusInput()
    const interval = setInterval(focusInput, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const value = inputRef.current.value.trim()
      if (value) {
        onScan(value)
        inputRef.current.value = ''
      }
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Naskenujte barcode...'}
        className={`w-full bg-navy-900 border-2 border-navy-600 focus:border-brand-orange rounded-xl px-6 py-4 text-2xl text-theme-primary placeholder-theme-muted outline-none transition-colors ${className || ''}`}
        style={{ minHeight: '64px' }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />
      {/* Active indicator */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm text-theme-muted">Aktivni</span>
      </div>
    </div>
  )
}
