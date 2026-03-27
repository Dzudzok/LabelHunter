export default function StatsCards({ cards }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
      {cards.map((card, i) => (
        <div
          key={i}
          className={`rounded-xl p-4 cursor-pointer hover:opacity-80 transition-all ${card.active ? 'ring-2 ring-white ring-offset-2 ring-offset-navy-900' : ''}`}
          style={{ backgroundColor: card.bgColor || '#1e293b' }}
          onClick={card.onClick}
        >
          <div className="text-2xl font-bold" style={{ color: card.valueColor || '#fff' }}>
            {card.value}
          </div>
          <div className="text-xs mt-1" style={{ color: card.labelColor || '#94a3b8' }}>
            {card.label}
          </div>
        </div>
      ))}
    </div>
  )
}
