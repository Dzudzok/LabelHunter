export default function StatsBar({ packages }) {
  const sent = packages.filter(p =>
    ['shipped', 'delivered'].includes(p.status)
  ).length
  const pending = packages.filter(p =>
    ['pending', 'scanning'].includes(p.status)
  ).length
  const total = packages.length

  return (
    <div className="flex flex-wrap gap-6 bg-navy-900 rounded-xl px-6 py-4">
      <div className="flex items-center gap-2">
        <span className="text-green-400 text-xl">&#10003;</span>
        <span className="text-gray-400 text-lg">Odeslano:</span>
        <span className="text-green-400 text-2xl font-bold">{sent}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-red-400 text-xl">&#9632;</span>
        <span className="text-gray-400 text-lg">K vyrizeni:</span>
        <span className="text-red-400 text-2xl font-bold">{pending}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-xl">&#8987;</span>
        <span className="text-gray-400 text-lg">Celkem:</span>
        <span className="text-white text-2xl font-bold">{total}</span>
      </div>
    </div>
  )
}
