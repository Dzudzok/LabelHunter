import { useState } from 'react'
import axios from 'axios'

const apiBase = import.meta.env.VITE_API_URL || '/api'

export default function Step1Verify({ formData, updateForm, onNext }) {
  const [docNumber, setDocNumber] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!docNumber.trim() || !email.trim()) {
      setError('Vyplňte číslo dokladu a e-mail')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await axios.post(`${apiBase}/retino/public/returns/verify`, {
        docNumber: docNumber.trim(),
        email: email.trim(),
      })

      updateForm({
        deliveryNote: res.data.deliveryNote,
        items: res.data.items,
        customerName: res.data.deliveryNote.customer_name || '',
        customerEmail: email.trim(),
      })
      onNext()
    } catch (err) {
      setError(err.response?.data?.error || 'Objednávka nenalezena nebo e-mail neodpovídá')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-2">Ověření objednávky</h2>
      <p className="text-sm text-gray-500 mb-6">
        Zadejte číslo faktury nebo objednávky a e-mail použitý při nákupu.
      </p>

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Číslo dokladu (faktura / objednávka)</label>
          <input
            type="text"
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value)}
            placeholder="např. 47193126"
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vas@email.cz"
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>

        {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1046A0] text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Ověřuji...' : 'Ověřit objednávku'}
        </button>
      </form>
    </div>
  )
}
