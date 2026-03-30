import { useParams } from 'react-router-dom'

export default function PaymentReturn() {
  const { status } = useParams() // 'OK' or 'FAIL'
  const isOk = status?.toUpperCase() === 'OK'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1046A0] text-white">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <img src="/Mroauto_1994.png" alt="MROAUTO" className="h-10 object-contain" onError={(e) => { e.target.style.display = 'none' }} />
          <div>
            <div className="font-bold text-lg">MROAUTO</div>
            <div className="text-xs opacity-80">RETURO</div>
          </div>
        </div>
        <div className="h-1 bg-[#D8112A]" />
      </div>

      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        {isOk ? (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Platba úspěšná!</h2>
            <p className="text-gray-600 mb-6">
              Vaše platba byla přijata. Přepravní štítek bude připraven ke stažení na stránce stavu Vaší žádosti.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Štítek bude vygenerován v nejbližší době. Sledujte stav žádosti.
            </p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Platba nebyla dokončena</h2>
            <p className="text-gray-600 mb-6">
              Platba nebyla provedena nebo byla zrušena. Můžete to zkusit znovu ze stránky stavu žádosti.
            </p>
          </>
        )}

        <a
          href="/vraceni"
          className="inline-block bg-[#1046A0] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
        >
          Zpět na hlavní stránku
        </a>
      </div>
    </div>
  )
}
