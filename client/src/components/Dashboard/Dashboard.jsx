import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { usePackageStore } from '../../store/packageStore'
import { useScanner } from '../../hooks/useScanner'
import { classifyBarcode } from '../../utils/barcode'
import { api } from '../../services/api'
import StatsBar from './StatsBar'
import PackageCard from './PackageCard'
import TransportMapModal from './TransportMapModal'
import StatsModal from './StatsModal'
import SearchPanel from '../Search/SearchPanel'
import { useThemeStore } from '../../store/themeStore'
import HunterManageModal from './HunterManageModal'
import HunterStatsModal from './HunterStatsModal'
import NewLabelModal from './NewLabelModal'
import PrinterSelector from './PrinterSelector'
import { usePrinter } from '../../hooks/usePrinter'

export default function Dashboard() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useThemeStore()
  const worker = useAuthStore(s => s.worker)
  const logout = useAuthStore(s => s.logout)
  const {
    packages,
    loading,
    selectedDate,
    setSelectedDate,
    fetchPackages,

    getPackageByInvoice,
  } = usePackageStore()

  const [scanValue, setScanValue] = useState('')

  const [showTransportMap, setShowTransportMap] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showHunterManage, setShowHunterManage] = useState(false)
  const [showHunterStats, setShowHunterStats] = useState(false)
  const [showNewLabel, setShowNewLabel] = useState(false)
  const { selectedPrinter, setSelectedPrinter, printers, loadingPrinters, printerError, fetchPrinters, printLabel } = usePrinter()

  // Right panel search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null) // null = show today's sent
  const [searchLoading, setSearchLoading] = useState(false)

  const scanRef = useRef(null)
  const scanAutoSubmitTimer = useRef(null)

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

  // Auto-focus scan input
  useEffect(() => {
    if (scanRef.current) {
      scanRef.current.focus()
    }
  }, [])

  // Navigate by invoice/barcode value
  const navigateByCode = useCallback(async (code) => {
    const val = code.trim()
    if (!val) return
    const classified = classifyBarcode(val)
    const lookupVal = classified.type === 'invoice' ? classified.value : val
    try {
      const pkg = await getPackageByInvoice(lookupVal)
      if (pkg) {
        setScanValue('')
        navigate(`/package/${pkg.id}`)
      }
    } catch {}
  }, [getPackageByInvoice, navigate])

  // Handle scanned barcode via useScanner hook (physical scanner, global keydown)
  const handleScan = useCallback((code) => {
    setScanValue(code)
    navigateByCode(code)
  }, [navigateByCode])

  useScanner(handleScan)

  // Date navigation
  const changeDate = (delta) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + delta)
    setSelectedDate(d.toISOString().split('T')[0])
  }


  // Refresh packages (LP sync runs on BOLOPC, just reload here)
  const handleRefresh = () => {
    fetchPackages(selectedDate)
  }

  // Scan input submit — on Enter or form submit
  const handleScanSubmit = async (e) => {
    e.preventDefault()
    await navigateByCode(scanValue)
    setScanValue('')
  }

  // Auto-submit when input stops changing (scanner without Enter suffix)
  const handleScanChange = (e) => {
    const val = e.target.value
    setScanValue(val)
    if (scanAutoSubmitTimer.current) clearTimeout(scanAutoSubmitTimer.current)
    if (val.length >= 4) {
      scanAutoSubmitTimer.current = setTimeout(() => {
        navigateByCode(val)
        setScanValue('')
      }, 300)
    }
  }

  // Right panel search
  const handleSearch = async (e) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    setSearchLoading(true)
    try {
      const res = await api.get('/packages', { params: { search: q } })
      setSearchResults(res.data)
    } catch (err) {
      console.error(err)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults(null)
  }

  // Package groups for left column
  const pendingPackages = packages.filter(p =>
    ['pending', 'scanning', 'verified'].includes(p.status)
  )

  // Right column: today's sent packages OR search results
  const sentPackagesToday = packages.filter(p =>
    ['label_generated', 'shipped', 'delivered'].includes(p.status)
  )
  const rightPackages = searchResults !== null ? searchResults : sentPackagesToday

  const initials = worker?.name
    ? worker.name.split(' ').map(n => n[0]).join('').toUpperCase()
    : '?'

  return (
    <div className="min-h-screen bg-navy-800 flex flex-col">
      {/* Top bar */}
      <div className="bg-navy-900 border-b border-navy-700 px-6 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Worker info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-orange flex items-center justify-center text-base font-bold text-white">
              {initials}
            </div>
            <div>
              <div className="text-base font-semibold text-theme-primary">{worker?.name}</div>
              <button onClick={logout} className="text-xs text-theme-muted hover:text-red-400 min-h-0">
                Odhlásit
              </button>
            </div>
          </div>

          {/* Date navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeDate(-1)}
              className="bg-navy-700 hover:bg-navy-600 px-3 py-1.5 rounded-lg text-lg text-theme-primary min-h-0"
            >
              &larr;
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-navy-700 border border-navy-600 rounded-lg px-3 py-1.5 text-lg text-theme-primary min-h-0"
            />
            <button
              onClick={() => changeDate(1)}
              className="bg-navy-700 hover:bg-navy-600 px-3 py-1.5 rounded-lg text-lg text-theme-primary min-h-0"
            >
              &rarr;
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowNewLabel(true)}
              className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              + Nová etiketa
            </button>
            <button
              onClick={handleRefresh}
              className="bg-green-700 hover:bg-green-600 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => setShowSearch(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              Vyhledávání
            </button>
            <button
              onClick={() => setShowHunterManage(true)}
              className="bg-purple-700 hover:bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              Hunter
            </button>
            <button
              onClick={() => setShowHunterStats(true)}
              className="bg-purple-900 hover:bg-purple-800 text-purple-300 hover:text-purple-200 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              Hunter Stats
            </button>
            <button
              onClick={() => setShowStats(true)}
              className="bg-navy-600 hover:bg-navy-500 text-theme-secondary hover:text-theme-primary px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              Statistiky
            </button>
            <button
              onClick={() => setShowTransportMap(true)}
              className="bg-navy-600 hover:bg-navy-500 text-theme-secondary hover:text-theme-primary px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              Přepravci
            </button>
            <PrinterSelector
              selectedPrinter={selectedPrinter}
              setSelectedPrinter={setSelectedPrinter}
              printers={printers}
              loadingPrinters={loadingPrinters}
              printerError={printerError}
              fetchPrinters={fetchPrinters}
            />
            <button
              onClick={toggleTheme}
              className="bg-navy-600 hover:bg-navy-500 text-theme-secondary hover:text-theme-primary px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
              title={theme === 'dark' ? 'Světlý režim' : 'Tmavý režim'}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      </div>

      {showNewLabel && <NewLabelModal onClose={() => setShowNewLabel(false)} />}
      {showSearch && <SearchPanel isOpen={showSearch} onClose={() => setShowSearch(false)} />}
      {showStats && <StatsModal date={selectedDate} onClose={() => setShowStats(false)} />}
      {showTransportMap && <TransportMapModal onClose={() => setShowTransportMap(false)} />}
      {showHunterManage && <HunterManageModal onClose={() => setShowHunterManage(false)} />}
      {showHunterStats && <HunterStatsModal onClose={() => setShowHunterStats(false)} />}

      {/* Stats bar */}
      <div className="px-6 pt-4">
        <StatsBar packages={packages} />
      </div>

      {/* 2-column layout */}
      <div className="flex flex-1 gap-0 px-6 py-4 overflow-hidden" style={{ minHeight: 0 }}>

        {/* LEFT COLUMN — scan input + pending queue */}
        <div className="flex flex-col w-1/2 pr-3 overflow-hidden">
          {/* Scan input */}
          <form onSubmit={handleScanSubmit}>
            <input
              ref={scanRef}
              type="text"
              value={scanValue}
              onChange={handleScanChange}
              placeholder="Naskenuj číslo faktury..."
              className="w-full bg-navy-900 border-2 border-navy-600 focus:border-brand-orange rounded-xl px-5 py-4 text-2xl text-theme-primary placeholder-theme-muted outline-none transition-colors"
            />
          </form>

          {/* Pending list */}
          <div className="flex items-center gap-2 mt-4 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <h2 className="text-base font-bold text-red-400">
              K vyřízení ({loading ? '…' : pendingPackages.length})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
            {loading && (
              <div className="text-center py-8 text-theme-muted text-sm">Načítám...</div>
            )}
            {!loading && pendingPackages.length === 0 && (
              <div className="text-center py-12 text-theme-muted text-sm">
                Žádné balíky k vyřízení
              </div>
            )}
            {pendingPackages.map(pkg => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN — search + sent packages */}
        <div className="flex flex-col w-1/2 pl-3 border-l border-navy-700 overflow-hidden">
          {/* Search input */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hledat balík (FV, zákazník, číslo...)"
              className="flex-1 bg-navy-900 border-2 border-navy-600 focus:border-blue-500 rounded-xl px-5 py-4 text-xl text-theme-primary placeholder-theme-muted outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={searchLoading}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 rounded-xl text-sm disabled:opacity-50 transition-colors"
            >
              {searchLoading ? '...' : 'Hledat'}
            </button>
            {searchResults !== null && (
              <button
                type="button"
                onClick={clearSearch}
                className="bg-navy-600 hover:bg-navy-500 text-theme-secondary px-4 rounded-xl text-sm transition-colors"
              >
                × Zrušit
              </button>
            )}
          </form>

          {/* Section header */}
          <div className="flex items-center gap-2 mt-4 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <h2 className="text-base font-bold text-green-400">
              {searchResults !== null
                ? `Výsledky hledání (${rightPackages.length})`
                : `Odesláno dnes (${sentPackagesToday.length})`
              }
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
            {searchLoading && (
              <div className="text-center py-8 text-theme-muted text-sm">Hledám...</div>
            )}
            {!searchLoading && rightPackages.length === 0 && (
              <div className="text-center py-12 text-theme-muted text-sm">
                {searchResults !== null ? 'Nic nenalezeno' : 'Žádné odeslané balíky dnes'}
              </div>
            )}
            {!searchLoading && rightPackages.map(pkg => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
