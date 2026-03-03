import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { usePackageStore } from '../../store/packageStore'
import { useScanner } from '../../hooks/useScanner'
import { classifyBarcode } from '../../utils/barcode'
import StatsBar from './StatsBar'
import PackageCard from './PackageCard'
import TransportMapModal from './TransportMapModal'
import StatsModal from './StatsModal'

export default function Dashboard() {
  const navigate = useNavigate()
  const worker = useAuthStore(s => s.worker)
  const logout = useAuthStore(s => s.logout)
  const {
    packages,
    loading,
    selectedDate,
    setSelectedDate,
    fetchPackages,
    importFromNextis,
    getPackageByInvoice,
  } = usePackageStore()

  const [searchValue, setSearchValue] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [importHourFrom, setImportHourFrom] = useState('06')
  const [importHourTo, setImportHourTo] = useState('18')
  const [showTransportMap, setShowTransportMap] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const searchRef = useRef(null)

  // Fetch packages on mount and date change
  useEffect(() => {
    fetchPackages(selectedDate)
  }, [selectedDate, fetchPackages])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPackages(selectedDate)
    }, 60000)
    return () => clearInterval(interval)
  }, [selectedDate, fetchPackages])

  // Auto-focus search input
  useEffect(() => {
    if (searchRef.current) {
      searchRef.current.focus()
    }
  }, [])

  // Handle scanned barcode
  const handleScan = useCallback(async (code) => {
    const classified = classifyBarcode(code)
    if (classified.type === 'invoice') {
      try {
        const pkg = await getPackageByInvoice(classified.value)
        if (pkg) {
          navigate(`/package/${pkg.id}`)
        }
      } catch {
        setSearchValue(code)
      }
    } else if (classified.type === 'action') {
      // Handle action barcodes
    } else {
      setSearchValue(code)
    }
  }, [getPackageByInvoice, navigate])

  useScanner(handleScan)

  // Date navigation
  const changeDate = (delta) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + delta)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  // Import from Nextis for selected date + hour range
  const handleImport = async () => {
    setImporting(true)
    setImportMsg('')
    try {
      const dateFrom = `${selectedDate}T${importHourFrom}:00:00.000Z`
      const dateTo   = `${selectedDate}T${importHourTo}:59:59.000Z`
      const result = await importFromNextis(null, null, dateFrom, dateTo)
      setImportMsg(`✓ Importováno: ${result.imported || 0}, přeskočeno: ${result.skipped || 0} (celkem: ${result.total || 0})`)
      fetchPackages(selectedDate)
    } catch (err) {
      setImportMsg('✗ Chyba: ' + (err?.response?.data?.error || err.message))
    } finally {
      setImporting(false)
      setTimeout(() => setImportMsg(''), 6000)
    }
  }

  // Search submit
  const handleSearchSubmit = async (e) => {
    e.preventDefault()
    if (!searchValue.trim()) return
    try {
      const pkg = await getPackageByInvoice(searchValue.trim())
      if (pkg) {
        navigate(`/package/${pkg.id}`)
      }
    } catch {
      // Not found
    }
    setSearchValue('')
  }

  // Group packages by status
  const pendingPackages = packages.filter(p =>
    ['pending', 'scanning', 'verified'].includes(p.status)
  )
  const sentPackages = packages.filter(p =>
    ['label_generated', 'shipped', 'delivered'].includes(p.status)
  )
  const otherPackages = packages.filter(p =>
    ['returned', 'problem'].includes(p.status)
  )

  const initials = worker?.name
    ? worker.name.split(' ').map(n => n[0]).join('').toUpperCase()
    : '?'

  return (
    <div className="min-h-screen bg-navy-800">
      {/* Top bar */}
      <div className="bg-navy-900 border-b border-navy-700 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Left: Worker info */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand-orange flex items-center justify-center text-lg font-bold text-white">
              {initials}
            </div>
            <div>
              <div className="text-lg font-semibold text-white">{worker?.name}</div>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-red-400 min-h-0"
              >
                Odhlasit
              </button>
            </div>
          </div>

          {/* Center: Date navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeDate(-1)}
              className="bg-navy-700 hover:bg-navy-600 px-4 py-2 rounded-lg text-xl text-white min-h-0"
            >
              &larr;
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-navy-700 border border-navy-600 rounded-lg px-4 py-2 text-xl text-white min-h-0"
            />
            <button
              onClick={() => changeDate(1)}
              className="bg-navy-700 hover:bg-navy-600 px-4 py-2 rounded-lg text-xl text-white min-h-0"
            >
              &rarr;
            </button>
          </div>

          {/* Right: Import + settings */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Hour range filter */}
            <div className="flex items-center gap-1 text-gray-300 text-lg">
              <span>Od</span>
              <select
                value={importHourFrom}
                onChange={e => setImportHourFrom(e.target.value)}
                className="bg-navy-700 border border-navy-600 rounded-lg px-2 py-1 text-white min-h-0 text-lg"
              >
                {Array.from({length: 24}, (_, i) => String(i).padStart(2,'0')).map(h => (
                  <option key={h} value={h}>{h}:00</option>
                ))}
              </select>
              <span>do</span>
              <select
                value={importHourTo}
                onChange={e => setImportHourTo(e.target.value)}
                className="bg-navy-700 border border-navy-600 rounded-lg px-2 py-1 text-white min-h-0 text-lg"
              >
                {Array.from({length: 24}, (_, i) => String(i).padStart(2,'0')).map(h => (
                  <option key={h} value={h}>{h}:59</option>
                ))}
              </select>
            </div>
            {importMsg && (
              <span className="text-brand-orange font-semibold text-sm">{importMsg}</span>
            )}
            <button
              onClick={handleImport}
              disabled={importing}
              className="bg-brand-orange hover:bg-brand-orange-dark text-white font-bold px-6 py-3 rounded-xl text-lg disabled:opacity-50 transition-colors"
            >
              {importing ? 'Importuji...' : 'Importuj teraz'}
            </button>
            <button
              onClick={() => setShowStats(true)}
              className="bg-navy-600 hover:bg-navy-500 text-gray-300 hover:text-white px-4 py-3 rounded-xl text-lg font-semibold transition-colors"
              title="Statistiky"
            >
              &#x1F4CA; Statistiky
            </button>
            <button
              onClick={() => setShowTransportMap(true)}
              className="bg-navy-600 hover:bg-navy-500 text-gray-300 hover:text-white px-4 py-3 rounded-xl text-lg font-semibold transition-colors"
              title="Mapování přepravců"
            >
              &#x1F69A; Přepravci
            </button>
          </div>
        </div>
      </div>

      {showStats && <StatsModal date={selectedDate} onClose={() => setShowStats(false)} />}
      {showTransportMap && <TransportMapModal onClose={() => setShowTransportMap(false)} />}

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats */}
        <StatsBar packages={packages} />

        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="mt-6">
          <input
            ref={searchRef}
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Naskenuj cislo faktury..."
            className="w-full bg-navy-900 border-2 border-navy-600 focus:border-brand-orange rounded-xl px-6 py-5 text-3xl text-white placeholder-gray-600 outline-none transition-colors"
            style={{ minHeight: '80px' }}
          />
        </form>

        {/* Loading indicator */}
        {loading && (
          <div className="text-center py-8 text-gray-400 text-xl">
            Nacitani baliku...
          </div>
        )}

        {/* Empty state */}
        {!loading && packages.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">&#128230;</div>
            <div className="text-2xl text-gray-400 mb-2">Zadne baliky pro tento den</div>
            <div className="text-lg text-gray-500">
              Zkuste importovat data z Nextis nebo zmente datum
            </div>
          </div>
        )}

        {/* Pending packages */}
        {pendingPackages.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              K vyrizeni ({pendingPackages.length})
            </h2>
            <div className="flex flex-col gap-3">
              {pendingPackages.map(pkg => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          </div>
        )}

        {/* Sent packages */}
        {sentPackages.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              Odeslano ({sentPackages.length})
            </h2>
            <div className="flex flex-col gap-3">
              {sentPackages.map(pkg => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          </div>
        )}

        {/* Other packages */}
        {otherPackages.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-400 mb-4 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-gray-500" />
              Ostatni ({otherPackages.length})
            </h2>
            <div className="flex flex-col gap-3">
              {otherPackages.map(pkg => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
