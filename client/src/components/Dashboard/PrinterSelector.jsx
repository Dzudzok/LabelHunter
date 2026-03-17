import { useState } from 'react'

const API = import.meta.env.VITE_API_URL || '/api'

export default function PrinterSelector({ selectedPrinter, setSelectedPrinter, printers, loadingPrinters, printerError, fetchPrinters }) {
  const [open, setOpen] = useState(false)

  const handleOpen = () => {
    setOpen(true)
    fetchPrinters()
  }

  const downloadCert = async () => {
    try {
      const res = await fetch(`${API}/qz/certificate`)
      const text = await res.text()
      const blob = new Blob([text], { type: 'application/x-pem-file' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'labelhunter-qz.pem'
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* ignore */ }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        title={selectedPrinter ? `Tiskárna: ${selectedPrinter}` : 'Vybrat tiskárnu'}
        className={`px-3 py-2 rounded text-sm font-semibold transition-colors ${
          selectedPrinter
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-gray-600 hover:bg-gray-500 text-white'
        }`}
      >
        🖨️ {selectedPrinter ? selectedPrinter.split('\\').pop().slice(0, 14) : 'Tiskárna'}
      </button>

      {open && (
        <div className="fixed inset-0 flex items-center justify-center z-50" onClick={() => setOpen(false)}>
          <div className="bg-[#1e2130] border border-gray-700 rounded-xl shadow-2xl p-6 w-96 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white">Vybrat tiskárnu</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            {printerError && (
              <div className="bg-red-900/40 border border-red-600 rounded p-3 mb-3 text-red-300 text-sm">
                {printerError}
              </div>
            )}

            <div className="bg-blue-900/20 border border-blue-800 rounded p-3 mb-3 text-xs space-y-1.5">
              <div className="font-semibold text-blue-100">Nový počítač — jak nastavit:</div>
              <ol className="list-decimal list-inside space-y-1 text-blue-300">
                <li>Stáhněte a nainstalujte <strong className="text-blue-100">QZ Tray</strong></li>
                <li>Spusťte QZ Tray (ikona v systray)</li>
                <li>
                  Klikněte <strong className="text-blue-100">Stáhnout certifikát</strong> níže →
                  pravým na ikonu QZ → <strong className="text-blue-100">Site Manager</strong> →
                  <strong className="text-blue-100">Browse</strong> → vyberte stažený soubor <code className="bg-gray-800 px-1 rounded">labelhunter-qz.pem</code>
                </li>
                <li>Klikněte <strong className="text-blue-100">Načíst tiskárny</strong> — QZ Tray zobrazí dialog → zaškrtněte <strong className="text-blue-100">Remember</strong> → <strong className="text-blue-100">Allow</strong></li>
                <li>Vyberte tiskárnu ze seznamu</li>
              </ol>
              <div className="flex gap-2 mt-2 flex-wrap">
                <a
                  href="https://github.com/qzind/tray/releases/download/v2.2.5/qz-tray-2.2.5-x86_64.exe"
                  target="_blank"
                  rel="noreferrer"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1.5 rounded text-xs transition-colors"
                >
                  Stáhnout QZ Tray
                </a>
                <button
                  onClick={downloadCert}
                  className="bg-yellow-600 hover:bg-yellow-500 text-white font-semibold px-3 py-1.5 rounded text-xs transition-colors"
                >
                  Stáhnout certifikát
                </button>
              </div>
            </div>

            <button
              onClick={fetchPrinters}
              disabled={loadingPrinters}
              className="w-full mb-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2 rounded transition-colors"
            >
              {loadingPrinters ? 'Načítám...' : '🔄 Načíst tiskárny'}
            </button>

            {!loadingPrinters && !printerError && printers.length === 0 && (
              <div className="text-gray-500 text-sm text-center py-2">Žádné tiskárny nenalezeny</div>
            )}

            <div className="overflow-y-auto flex-1 space-y-1">
              {printers.map(p => (
                <button
                  key={p}
                  onClick={() => { setSelectedPrinter(p); setOpen(false) }}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedPrinter === p
                      ? 'bg-green-600 text-white font-semibold'
                      : 'bg-gray-700/50 text-gray-200 hover:bg-green-700/30'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {selectedPrinter && (
              <button
                onClick={() => { setSelectedPrinter(''); setOpen(false) }}
                className="mt-3 text-xs text-red-400 hover:text-red-300 text-left"
              >
                Zrušit výběr tiskárny (použít dialog)
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
