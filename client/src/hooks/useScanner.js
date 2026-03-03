import { useEffect, useRef, useCallback } from 'react'

export function useScanner(onScan, enabled = true) {
  const bufferRef = useRef('')
  const timerRef = useRef(null)

  const handleKeyDown = useCallback((e) => {
    if (!enabled) return

    // Ignore modifier keys
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return

    if (e.key === 'Enter') {
      const code = bufferRef.current.trim()
      if (code.length > 0) {
        onScan(code)
      }
      bufferRef.current = ''
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }

    if (e.key.length === 1) {
      bufferRef.current += e.key
    }

    // Reset buffer after 100ms of no input (human typing vs scanner)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      bufferRef.current = ''
    }, 100)
  }, [onScan, enabled])

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [handleKeyDown, enabled])
}
