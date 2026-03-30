import { useState } from 'react'
import axios from 'axios'
import { useLang } from './i18n'

const apiBase = import.meta.env.VITE_API_URL || '/api'

export default function Step1Verify({ formData, updateForm, onNext }) {
  const { t } = useLang()
  const [docNumber, setDocNumber] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!docNumber.trim() || !email.trim()) { setError(t('verify.error.empty')); return }
    setLoading(true)
    setError('')
    try {
      const res = await axios.post(`${apiBase}/retino/public/returns/verify`, { docNumber: docNumber.trim(), email: email.trim() })
      updateForm({
        deliveryNote: res.data.deliveryNote, items: res.data.items,
        customerName: res.data.deliveryNote.customer_name || '', customerEmail: email.trim(),
      })
      onNext()
    } catch (err) {
      setError(err.response?.data?.error || t('verify.error.notFound'))
    } finally { setLoading(false) }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-[#1046A0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900">{t('verify.title')}</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6 ml-[52px]">{t('verify.desc')}</p>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('verify.docLabel')}</label>
            <input type="text" value={docNumber} onChange={(e) => setDocNumber(e.target.value)}
              placeholder={t('verify.docPlaceholder')}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:bg-white focus:border-[#1046A0] focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('verify.emailLabel')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={t('verify.emailPlaceholder')}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:bg-white focus:border-[#1046A0] focus:ring-2 focus:ring-blue-100 outline-none transition-all" />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 p-3 rounded-xl">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-[#1046A0] to-[#0d3a85] text-white py-3.5 rounded-xl font-bold text-base shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 transition-all">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                {t('verify.loading')}
              </span>
            ) : t('verify.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
