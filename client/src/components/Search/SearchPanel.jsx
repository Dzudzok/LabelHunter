import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'K vyrizeni' },
  { value: 'scanning', label: 'Skenovani' },
  { value: 'verified', label: 'Overeno' },
  { value: 'label_generated', label: 'Etiketa' },
  { value: 'shipped', label: 'Odeslano' },
  { value: 'delivered', label: 'Doruceno' },
  { value: 'returned', label: 'Vraceno' },
  { value: 'problem', label: 'Problem' },
]

export default function SearchPanel({ isOpen, onClose }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState('invoice_number')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const toggleStatus = (status) => {
    setStatusFilter(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    setLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.append(searchType, query.trim())
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)
      if (statusFilter.length > 0) params.append('status', statusFilter.join(','))

      const res = await api.get(`/packages/search?${params.toString()}`)
      setResults(res.data)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 overlay-bg z-50 flex items-center justify-center p-4">
      <div className="bg-navy-800 rounded-2xl border border-navy-600 w-full max-w-3xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-navy-700">
          <h2 className="text-2xl font-bold text-theme-primary">Rozsirene hledani</h2>
          <button
            onClick={onClose}
            className="text-theme-secondary hover:text-theme-primary text-2xl min-h-0 px-2"
          >
            &#10005;
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSearch}>
            {/* Search type selector */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {[
                { value: 'invoice_number', label: 'Faktura' },
                { value: 'order_number', label: 'Objednavka' },
                { value: 'customer_name', label: 'Zakaznik' },
                { value: 'doc_number', label: 'Doklad' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSearchType(opt.value)}
                  className={`px-4 py-2 rounded-lg text-lg font-medium transition-colors ${
                    searchType === opt.value
                      ? 'bg-brand-orange text-white'
                      : 'bg-navy-700 text-theme-secondary hover:text-theme-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Search input */}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hledat..."
              className="w-full bg-navy-900 border-2 border-navy-600 focus:border-brand-orange rounded-xl px-4 py-4 text-xl text-theme-primary placeholder-theme-muted outline-none mb-4"
              style={{ minHeight: '64px' }}
            />

            {/* Date range */}
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="text-sm text-theme-muted mb-1 block">Od</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-theme-primary min-h-0"
                />
              </div>
              <div className="flex-1">
                <label className="text-sm text-theme-muted mb-1 block">Do</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-theme-primary min-h-0"
                />
              </div>
            </div>

            {/* Status filter */}
            <div className="mb-4">
              <label className="text-sm text-theme-muted mb-2 block">Status</label>
              <div className="flex gap-2 flex-wrap">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleStatus(opt.value)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors min-h-0 ${
                      statusFilter.includes(opt.value)
                        ? 'bg-brand-orange text-white'
                        : 'bg-navy-700 text-theme-secondary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white py-4 rounded-xl text-xl font-bold transition-colors disabled:opacity-50"
            >
              {loading ? 'Hledam...' : 'Hledat'}
            </button>
          </form>

          {/* Results */}
          {searched && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-theme-secondary mb-3">
                Vysledky ({results.length})
              </h3>
              {results.length === 0 ? (
                <div className="text-center py-8 text-theme-muted">Nic nenalezeno</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {results.map(pkg => (
                    <button
                      key={pkg.id}
                      onClick={() => { onClose(); navigate(`/package/${pkg.id}`) }}
                      className="w-full bg-navy-700 hover:bg-navy-600 rounded-xl p-4 text-left transition-colors flex items-center gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xl font-bold text-theme-primary truncate">
                          {pkg.invoice_number}
                        </div>
                        <div className="text-theme-secondary truncate">
                          {pkg.customer_name}
                        </div>
                      </div>
                      <div className="text-sm text-theme-muted shrink-0">
                        {pkg.imported_at
                          ? new Date(pkg.imported_at).toLocaleDateString('cs-CZ')
                          : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
