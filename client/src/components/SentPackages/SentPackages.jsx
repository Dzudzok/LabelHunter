import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'

const CARRIER_COLORS = {
  zasilkovna: 'bg-red-500/20 text-red-400',
  dpd: 'bg-red-700/20 text-red-500',
  ppl: 'bg-blue-500/20 text-blue-400',
  gls: 'bg-yellow-500/20 text-yellow-400',
  cp: 'bg-orange-500/20 text-orange-400',
}

export default function SentPackages({ isOpen, onClose }) {
  const navigate = useNavigate()
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('shipped')
  const [carrierFilter, setCarrierFilter] = useState('')
  const [cancellingId, setCancellingId] = useState(null)

  useEffect(() => {
    if (isOpen) {
      fetchSentPackages()
    }
  }, [isOpen, dateFrom, dateTo, statusFilter, carrierFilter])

  const fetchSentPackages = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)
      if (statusFilter) params.append('status', statusFilter)
      if (carrierFilter) params.append('carrier', carrierFilter)

      const res = await api.get(`/packages/sent?${params.toString()}`)
      setPackages(res.data)
    } catch {
      setPackages([])
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (packageId) => {
    try {
      await api.post(`/packages/${packageId}/cancel`)
      fetchSentPackages()
      setCancellingId(null)
    } catch (err) {
      console.error('Cancel error:', err)
    }
  }

  // Check for delayed packages (> 3 business days)
  const now = new Date()
  const delayedPackages = packages.filter(p => {
    if (p.status !== 'shipped' || !p.shipped_at) return false
    const shipped = new Date(p.shipped_at)
    const diffDays = Math.floor((now - shipped) / (1000 * 60 * 60 * 24))
    return diffDays > 3
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-navy-800 rounded-2xl border border-navy-600 w-full max-w-4xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-navy-700">
          <h2 className="text-2xl font-bold text-theme-primary">Odeslane zasilky</h2>
          <button
            onClick={onClose}
            className="text-theme-secondary hover:text-theme-primary text-2xl min-h-0 px-2"
          >
            &#10005;
          </button>
        </div>

        <div className="p-6">
          {/* Filters */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <div>
              <label className="text-sm text-theme-muted mb-1 block">Od</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-theme-primary min-h-0"
              />
            </div>
            <div>
              <label className="text-sm text-theme-muted mb-1 block">Do</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-theme-primary min-h-0"
              />
            </div>
            <div>
              <label className="text-sm text-theme-muted mb-1 block">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-theme-primary min-h-0"
              >
                <option value="">Vse</option>
                <option value="shipped">Odeslano</option>
                <option value="delivered">Doruceno</option>
                <option value="returned">Vraceno</option>
                <option value="problem">Problem</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-theme-muted mb-1 block">Prepravce</label>
              <input
                type="text"
                value={carrierFilter}
                onChange={(e) => setCarrierFilter(e.target.value)}
                placeholder="Vse"
                className="bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-theme-primary min-h-0 w-32"
              />
            </div>
          </div>

          {/* Delayed packages warning */}
          {delayedPackages.length > 0 && (
            <div className="bg-orange-900/30 border border-orange-600 rounded-xl p-4 mb-6">
              <div className="text-orange-400 font-bold text-lg mb-2">
                Pozor: {delayedPackages.length} zasil{delayedPackages.length === 1 ? 'ka' : 'ek'} bez doruceni &gt;3 dny
              </div>
              <div className="flex flex-col gap-2">
                {delayedPackages.map(pkg => (
                  <div key={pkg.id} className="flex items-center gap-3 text-orange-300">
                    <span className="font-mono">{pkg.invoice_number}</span>
                    <span className="text-sm">{pkg.customer_name}</span>
                    <span className="text-sm text-orange-500">
                      {pkg.shipped_at ? new Date(pkg.shipped_at).toLocaleDateString('cs-CZ') : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Package list */}
          {loading ? (
            <div className="text-center py-8 text-theme-secondary">Nacitani...</div>
          ) : packages.length === 0 ? (
            <div className="text-center py-8 text-theme-muted">Zadne zasilky</div>
          ) : (
            <div className="flex flex-col gap-2">
              {packages.map(pkg => (
                <div
                  key={pkg.id}
                  className="bg-navy-700 rounded-xl p-4 border border-navy-600 flex items-center gap-4"
                >
                  {/* Invoice */}
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-bold text-theme-primary truncate">
                      {pkg.invoice_number}
                    </div>
                    <div className="text-theme-secondary text-sm truncate">{pkg.customer_name}</div>
                  </div>

                  {/* Carrier */}
                  <div className={`px-3 py-1 rounded-lg text-sm font-medium shrink-0 ${
                    CARRIER_COLORS[pkg.shipper_code?.toLowerCase()] || 'bg-navy-600 text-theme-secondary'
                  }`}>
                    {pkg.transport_name || pkg.shipper_code || '-'}
                  </div>

                  {/* Tracking number */}
                  <div className="text-sm font-mono text-theme-secondary shrink-0">
                    {pkg.tracking_number || '-'}
                  </div>

                  {/* Status */}
                  <div className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 ${
                    pkg.status === 'delivered' ? 'bg-green-500/20 text-green-400' :
                    pkg.status === 'shipped' ? 'bg-blue-500/20 text-blue-400' :
                    pkg.status === 'problem' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-theme-secondary'
                  }`}>
                    {pkg.status}
                  </div>

                  {/* Sent date */}
                  <div className="text-sm text-theme-muted shrink-0">
                    {pkg.shipped_at
                      ? new Date(pkg.shipped_at).toLocaleDateString('cs-CZ')
                      : ''}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => { onClose(); navigate(`/package/${pkg.id}`) }}
                      className="bg-navy-600 hover:bg-navy-500 text-theme-secondary px-3 py-2 rounded-lg min-h-0 text-sm"
                    >
                      Detail
                    </button>
                    {pkg.status === 'shipped' && (
                      cancellingId === pkg.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleCancel(pkg.id)}
                            className="bg-red-600 text-white px-3 py-2 rounded-lg min-h-0 text-sm"
                          >
                            Ano
                          </button>
                          <button
                            onClick={() => setCancellingId(null)}
                            className="text-theme-secondary px-2 min-h-0 text-sm"
                          >
                            Ne
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setCancellingId(pkg.id)}
                          className="bg-red-900/50 hover:bg-red-800 text-red-400 px-3 py-2 rounded-lg min-h-0 text-sm"
                        >
                          Storno
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
