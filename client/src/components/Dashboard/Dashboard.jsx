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
import ExpandoModal from './ExpandoModal'
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
  const [showExpando, setShowExpando] = useState(false)
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

  // Auto-focus scan input
  useEffect(() => {
    if (scanRef.current) {
      scanRef.current.focus()
    }
  }, [])

  const [duplicateChoices, setDuplicateChoices] = useState(null)

  // Navigate by invoice/barcode value
  const navigateByCode = useCallback(async (code) => {
    const val = code.trim()
    if (!val) return
    const classified = classifyBarcode(val)
    const lookupVal = classified.type === 'invoice' ? classified.value : val
    try {
      const result = await getPackageByInvoice(lookupVal)
      if (result?.multiple) {
        setScanValue('')
        setDuplicateChoices(result.packages)
      } else if (result) {
        setScanValue('')
        navigate(`/package/${result.id}`)
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

  // Right column: packages with label generated on selected date
  const sentPackagesToday = packages.filter(p => {
    if (!['label_generated', 'shipped', 'delivered'].includes(p.status)) return false
    if (!p.label_generated_at) return false
    const labelDate = p.label_generated_at.split('T')[0]
    return labelDate === selectedDate
  })
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
                Wyloguj
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
              + Nowa etykieta
            </button>
            <button
              onClick={() => setShowExpando(true)}
              className="bg-purple-700 hover:bg-purple-600 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Expando
            </button>
            <button
              onClick={() => navigate('/retino/tracking')}
              className="bg-teal-700 hover:bg-teal-600 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              RETURO
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
              Wyszukiwanie
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
              Statystyki
            </button>
            <button
              onClick={() => setShowTransportMap(true)}
              className="bg-navy-600 hover:bg-navy-500 text-theme-secondary hover:text-theme-primary px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              Przewoźnicy
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
              title={theme === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      </div>

      {showNewLabel && <NewLabelModal onClose={() => setShowNewLabel(false)} />}
      {showExpando && <ExpandoModal date={selectedDate} onClose={() => setShowExpando(false)} />}
      {showSearch && <SearchPanel isOpen={showSearch} onClose={() => setShowSearch(false)} />}
      {showStats && <StatsModal date={selectedDate} onClose={() => setShowStats(false)} />}
      {showTransportMap && <TransportMapModal onClose={() => setShowTransportMap(false)} />}
      {showHunterManage && <HunterManageModal onClose={() => setShowHunterManage(false)} />}
      {showHunterStats && <HunterStatsModal onClose={() => setShowHunterStats(false)} />}

      {/* Duplicate invoice choice dialog */}
      {duplicateChoices && (
        <div className="fixed inset-0 overlay-bg z-50 flex items-center justify-center">
          <div className="bg-navy-800 border border-navy-600 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-theme-primary mb-4">Wybierz przesyłkę</h3>
            <p className="text-theme-secondary mb-4 text-sm">Znaleziono {duplicateChoices.length} przesyłek z tym numerem:</p>
            <div className="flex flex-col gap-3 mb-4">
              {duplicateChoices.map(pkg => (
                <button
                  key={pkg.id}
                  onClick={() => { setDuplicateChoices(null); navigate(`/package/${pkg.id}`) }}
                  className="bg-navy-700 hover:bg-navy-600 border border-navy-500 rounded-xl p-4 text-left transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-theme-primary font-bold">{pkg.invoice_number}</div>
                      <div className="text-theme-secondary text-sm">{pkg.customer_name}</div>
                    </div>
                    <div className="text-right">
                      <span className="bg-navy-600 text-theme-secondary px-2 py-1 rounded text-xs font-bold">
                        {pkg.transport_name || pkg.shipper_code || '-'}
                      </span>
                      <div className="text-theme-muted text-xs mt-1">{pkg.status}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setDuplicateChoices(null)}
              className="w-full bg-navy-700 hover:bg-navy-600 text-theme-secondary py-3 rounded-lg font-semibold transition-colors"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="px-6 pt-4">
        <StatsBar packages={packages} selectedDate={selectedDate} />
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
              placeholder="Skanuj numer faktury..."
              className="w-full bg-navy-900 border-2 border-navy-600 focus:border-brand-orange rounded-xl px-5 py-4 text-2xl text-theme-primary placeholder-theme-muted outline-none transition-colors"
            />
          </form>

          {/* Pending list */}
          <div className="flex items-center gap-2 mt-4 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <h2 className="text-base font-bold text-red-400">
              Do realizacji ({loading ? '…' : pendingPackages.length})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
            {loading && (
              <div className="text-center py-8 text-theme-muted text-sm">Ładowanie...</div>
            )}
            {!loading && pendingPackages.length === 0 && (
              <div className="text-center py-12 text-theme-muted text-sm">
                Brak paczek do realizacji
              </div>
            )}
            {pendingPackages.map(pkg => (
              <PackageCard key={pkg.id} pkg={pkg} onRefresh={() => fetchPackages(selectedDate)} />
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
              placeholder="Szukaj paczkę (FV, klient, numer...)"
              className="flex-1 bg-navy-900 border-2 border-navy-600 focus:border-blue-500 rounded-xl px-5 py-4 text-xl text-theme-primary placeholder-theme-muted outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={searchLoading}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 rounded-xl text-sm disabled:opacity-50 transition-colors"
            >
              {searchLoading ? '...' : 'Szukaj'}
            </button>
            {searchResults !== null && (
              <button
                type="button"
                onClick={clearSearch}
                className="bg-navy-600 hover:bg-navy-500 text-theme-secondary px-4 rounded-xl text-sm transition-colors"
              >
                × Anuluj
              </button>
            )}
          </form>

          {/* Section header */}
          <div className="flex items-center gap-2 mt-4 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <h2 className="text-base font-bold text-green-400">
              {searchResults !== null
                ? `Wyniki wyszukiwania (${rightPackages.length})`
                : `Wysłane dzisiaj (${sentPackagesToday.length})`
              }
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
            {searchLoading && (
              <div className="text-center py-8 text-theme-muted text-sm">Szukam...</div>
            )}
            {!searchLoading && rightPackages.length === 0 && (
              <div className="text-center py-12 text-theme-muted text-sm">
                {searchResults !== null ? 'Nic nie znaleziono' : 'Brak wysłanych paczek dzisiaj'}
              </div>
            )}
            {!searchLoading && rightPackages.map(pkg => (
              <PackageCard key={pkg.id} pkg={pkg} onRefresh={() => fetchPackages(selectedDate)} />
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
