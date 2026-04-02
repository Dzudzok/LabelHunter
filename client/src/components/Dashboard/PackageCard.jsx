import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import CarrierLogo from '../retino/tracking/CarrierLogo'

const STATUS_COLORS = {
  pending: 'border-red-500',
  scanning: 'border-yellow-500',
  verified: 'border-blue-500',
  label_generated: 'border-purple-500',
  shipped: 'border-green-500',
  delivered: 'border-green-700',
  returned: 'border-gray-500',
  problem: 'border-red-700',
}

const STATUS_LABELS = {
  pending: 'Do realizacji',
  scanning: 'Skanowanie',
  verified: 'Zweryfikowano',
  label_generated: 'Etykieta',
  shipped: 'Wysłano',
  delivered: 'Doręczono',
  returned: 'Zwrócono',
  problem: 'Problem',
}

const STATUS_BG = {
  pending: 'bg-red-500/20 text-red-400',
  scanning: 'bg-yellow-500/20 text-yellow-400',
  verified: 'bg-blue-500/20 text-blue-400',
  label_generated: 'bg-purple-500/20 text-purple-400',
  shipped: 'bg-green-500/20 text-green-400',
  delivered: 'bg-green-700/20 text-green-500',
  returned: 'bg-gray-500/20 text-gray-400',
  problem: 'bg-red-700/20 text-red-500',
}

export default function PackageCard({ pkg, onRefresh }) {
  const navigate = useNavigate()

  const handleStorno = async (e) => {
    e.stopPropagation()
    if (!confirm(`Stornovat zásilku ${pkg.invoice_number}?`)) return
    try {
      await api.put(`/packages/${pkg.id}/status`, { status: 'cancelled' })
      if (onRefresh) onRefresh()
    } catch (err) {
      console.error('Storno error:', err)
    }
  }

  const itemCount = pkg.delivery_note_items
    ? pkg.delivery_note_items.filter(i => i.item_type === 'goods').length
    : 0

  return (
    <button
      onClick={() => navigate(`/package/${pkg.id}`)}
      className={`w-full bg-navy-700 hover:bg-navy-600 rounded-xl p-5 border-l-4 ${
        STATUS_COLORS[pkg.status] || 'border-gray-500'
      } flex items-center gap-4 transition-colors text-left`}
    >
      {/* Invoice number */}
      <div className="flex-1 min-w-0">
        <div className="text-2xl font-bold text-theme-primary truncate">
          {pkg.invoice_number}
        </div>
        <div className="text-lg text-theme-secondary truncate">
          {pkg.customer_name || 'Nieznany klient'}
        </div>
      </div>

      {/* Carrier badge */}
      {pkg.transport_name && (
        <div className="shrink-0 flex items-center gap-2">
          <CarrierLogo carrier={pkg.transport_name} country={pkg.delivery_country} size="sm" showFlag={false} />
          <span className="text-theme-muted text-xs max-w-[120px] truncate hidden xl:inline">{pkg.transport_name}</span>
        </div>
      )}

      {/* Items count */}
      <div className="text-theme-secondary text-lg shrink-0">
        {itemCount} szt.
      </div>

      {/* Status badge */}
      <div className={`px-3 py-1 rounded-lg text-sm font-semibold shrink-0 ${
        STATUS_BG[pkg.status] || 'bg-gray-500/20 text-gray-400'
      }`}>
        {STATUS_LABELS[pkg.status] || pkg.status}
      </div>

      {/* Timestamp */}
      <div className="text-sm text-theme-muted shrink-0 hidden lg:block">
        {pkg.imported_at
          ? new Date(pkg.imported_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
          : ''}
      </div>

      {/* Storno button - only for pending */}
      {pkg.status === 'pending' && (
        <button
          onClick={handleStorno}
          className="text-red-500/50 hover:text-red-400 hover:bg-red-900/30 rounded-lg p-1 text-xs shrink-0 transition-colors"
          title="Stornovat"
        >✕</button>
      )}
    </button>
  )
}
