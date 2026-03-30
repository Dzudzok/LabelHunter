import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

export default function PaymentReturn() {
  const { status } = useParams()
  const isOk = status?.toUpperCase() === 'OK'

  useEffect(() => {
    // Redirect back to form with payment status
    if (isOk) {
      window.location.href = '/vraceni?paid=1'
    } else {
      window.location.href = '/vraceni?paid=0'
    }
  }, [isOk])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center text-gray-500">
        {isOk ? 'Platba úspěšná, přesměrovávám...' : 'Platba nebyla dokončena, přesměrovávám...'}
      </div>
    </div>
  )
}
