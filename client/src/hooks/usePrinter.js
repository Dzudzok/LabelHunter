import { useState, useCallback } from 'react'
import { getPrinters, printPdfBlob, isQZAvailable, isQZConnected } from '../utils/qzPrint'

const STORAGE_KEY = 'labelHunter_selectedPrinter'

export function usePrinter() {
  const [selectedPrinter, setSelectedPrinterState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || ''
  )
  const [printers, setPrinters] = useState([])
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const [printerError, setPrinterError] = useState(null)

  const setSelectedPrinter = useCallback((name) => {
    setSelectedPrinterState(name)
    localStorage.setItem(STORAGE_KEY, name)
  }, [])

  const fetchPrinters = useCallback(async () => {
    setPrinterError(null)
    setLoadingPrinters(true)
    try {
      const list = await getPrinters()
      setPrinters(list)
    } catch (e) {
      console.error('[QZ] getPrinters error:', e)
      setPrinterError(`QZ Tray chyba: ${e.message || 'Neznámá chyba'}. Ujistěte se, že QZ Tray běží a "Block anonymous requests" je odškrtnuté.`)
    } finally {
      setLoadingPrinters(false)
    }
  }, [])

  // Main print function: QZ Tray if available + printer selected, else iframe
  const printLabel = useCallback(async (pkgId, labelUrl) => {
    const apiBase = import.meta.env.VITE_API_URL || '/api'
    const url = labelUrl ? `${apiBase}/packages/${pkgId}/view-label?file=${encodeURIComponent(labelUrl)}` : `${apiBase}/packages/${pkgId}/view-label`

    if (isQZAvailable() && selectedPrinter) {
      try {
        const resp = await fetch(url)
        if (!resp.ok) throw new Error('fetch failed')
        const blob = await resp.blob()
        await printPdfBlob(selectedPrinter, blob)
        return
      } catch (e) {
        console.warn('[QZ Print] failed, fallback to iframe:', e.message)
      }
    }

    // Fallback: iframe print (shows system dialog)
    try {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error('fetch failed')
      const blob = await resp.blob()
      const blobUrl = URL.createObjectURL(blob)
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;'
      document.body.appendChild(iframe)

      const isImage = blob.type && blob.type.startsWith('image/')
      if (isImage) {
        // For images (GIF/PNG from UPS etc): wrap in HTML for printing
        iframe.srcdoc = `<html><head><style>@page{margin:0;size:A6 landscape}body{margin:0;display:flex;justify-content:center;align-items:center;height:100vh}img{max-width:100%;max-height:100%}</style></head><body><img src="${blobUrl}" onload="window.focus();window.print()"></body></html>`
      } else {
        // PDF: load directly
        iframe.src = blobUrl
        iframe.onload = () => {
          iframe.contentWindow.focus()
          iframe.contentWindow.print()
        }
      }
      setTimeout(() => {
        document.body.removeChild(iframe)
        URL.revokeObjectURL(blobUrl)
      }, 60000)
    } catch {
      window.open(url, '_blank')
    }
  }, [selectedPrinter])

  return { selectedPrinter, setSelectedPrinter, printers, loadingPrinters, printerError, fetchPrinters, printLabel }
}
