export default function StatsBar({ packages, selectedDate }) {
  const sent = packages.filter(p => {
    if (!['label_generated', 'shipped', 'delivered'].includes(p.status)) return false
    if (!p.label_generated_at) return false
    return p.label_generated_at.split('T')[0] === selectedDate
  }).length
  const pending = packages.filter(p =>
    ['pending', 'scanning'].includes(p.status)
  ).length
  const total = packages.length

  return (
    <div className="flex flex-wrap gap-6 bg-navy-900 rounded-xl px-6 py-4">
      <div className="flex items-center gap-2">
        <span className="text-green-400 text-xl">&#10003;</span>
        <span className="text-theme-secondary text-lg">Wysłano:</span>
        <span className="text-green-400 text-2xl font-bold">{sent}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-red-400 text-xl">&#9632;</span>
        <span className="text-theme-secondary text-lg">Do realizacji:</span>
        <span className="text-red-400 text-2xl font-bold">{pending}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-theme-secondary text-xl">&#8987;</span>
        <span className="text-theme-secondary text-lg">Razem:</span>
        <span className="text-theme-primary text-2xl font-bold">{total}</span>
      </div>
    </div>
  )
}
