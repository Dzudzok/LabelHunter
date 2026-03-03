import { useNavigate } from 'react-router-dom'

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
  pending: 'K vyrizeni',
  scanning: 'Skenovani',
  verified: 'Overeno',
  label_generated: 'Etiketa',
  shipped: 'Odeslano',
  delivered: 'Doruceno',
  returned: 'Vraceno',
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

export default function PackageCard({ pkg }) {
  const navigate = useNavigate()

  const itemCount = pkg.delivery_note_items
    ? pkg.delivery_note_items.filter(i => i.type === 'goods').length
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
        <div className="text-2xl font-bold text-white truncate">
          {pkg.invoice_number}
        </div>
        <div className="text-lg text-gray-400 truncate">
          {pkg.customer_name || 'Neznamy zakaznik'}
        </div>
      </div>

      {/* Carrier badge */}
      {pkg.transport_name && (
        <div className="bg-navy-600 px-3 py-1 rounded-lg text-sm font-medium text-gray-300 shrink-0">
          {pkg.transport_name}
        </div>
      )}

      {/* Items count */}
      <div className="text-gray-400 text-lg shrink-0">
        {itemCount} pozic
      </div>

      {/* Status badge */}
      <div className={`px-3 py-1 rounded-lg text-sm font-semibold shrink-0 ${
        STATUS_BG[pkg.status] || 'bg-gray-500/20 text-gray-400'
      }`}>
        {STATUS_LABELS[pkg.status] || pkg.status}
      </div>

      {/* Timestamp */}
      <div className="text-sm text-gray-500 shrink-0 hidden lg:block">
        {pkg.imported_at
          ? new Date(pkg.imported_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
          : ''}
      </div>
    </button>
  )
}
