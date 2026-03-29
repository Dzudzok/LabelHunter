import { useState, useEffect } from 'react'
import { api } from '../../../services/api'

export default function RefundAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', accountNumber: '', iban: '', bic: '', currency: 'CZK', isDefault: false })

  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const res = await api.get('/retino/refunds/accounts')
      setAccounts(res.data || [])
    } catch { /* */ }
    setLoading(false)
  }

  useEffect(() => { fetchAccounts() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/retino/refunds/accounts', form)
      setForm({ name: '', accountNumber: '', iban: '', bic: '', currency: 'CZK', isDefault: false })
      setShowForm(false)
      fetchAccounts()
    } catch (err) {
      alert(err.response?.data?.error || 'Chyba')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Opravdu smazat tento účet?')) return
    try {
      await api.delete(`/retino/refunds/accounts/${id}`)
      fetchAccounts()
    } catch (err) {
      alert(err.response?.data?.error || 'Chyba')
    }
  }

  return (
    <div className="bg-navy-900 text-theme-primary p-3 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-bold">Bankovní účty</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold"
        >
          {showForm ? 'Zrušit' : 'Přidat účet'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-navy-800 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-theme-muted block mb-1">Název</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary" placeholder="Hlavní účet" />
            </div>
            <div>
              <label className="text-xs text-theme-muted block mb-1">Číslo účtu</label>
              <input type="text" value={form.accountNumber} onChange={e => setForm({...form, accountNumber: e.target.value})} required
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary" placeholder="123456789/0100" />
            </div>
            <div>
              <label className="text-xs text-theme-muted block mb-1">IBAN (volitelné)</label>
              <input type="text" value={form.iban} onChange={e => setForm({...form, iban: e.target.value})}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary" placeholder="CZ..." />
            </div>
            <div>
              <label className="text-xs text-theme-muted block mb-1">BIC (volitelné)</label>
              <input type="text" value={form.bic} onChange={e => setForm({...form, bic: e.target.value})}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-theme-muted">
            <input type="checkbox" checked={form.isDefault} onChange={e => setForm({...form, isDefault: e.target.checked})} className="w-4 h-4" />
            Výchozí účet
          </label>
          <button type="submit" className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            Uložit
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center text-theme-muted py-12">Načítání...</div>
      ) : accounts.length === 0 ? (
        <div className="text-center text-theme-muted py-12">Žádné bankovní účty</div>
      ) : (
        <div className="space-y-3">
          {accounts.map(a => (
            <div key={a.id} className="bg-navy-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold flex items-center gap-2">
                  {a.name}
                  {a.is_default && <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded">Výchozí</span>}
                </div>
                <div className="text-sm text-theme-muted font-mono mt-1">{a.account_number}</div>
                {a.iban && <div className="text-xs text-theme-muted">{a.iban}</div>}
              </div>
              <button onClick={() => handleDelete(a.id)} className="text-red-400 hover:text-red-300 text-sm">Smazat</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
