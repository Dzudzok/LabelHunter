import { useState, useEffect } from 'react'
import { api } from '../../../services/api'
import { useAuthStore } from '../../../store/authStore'

export default function RefundQueue() {
  const worker = useAuthStore(s => s.worker)
  const [queue, setQueue] = useState([])
  const [batches, setBatches] = useState([])
  const [accounts, setAccounts] = useState([])
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('queue') // queue, batches
  const [creating, setCreating] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [qRes, bRes, aRes] = await Promise.all([
        api.get('/retino/refunds/queue'),
        api.get('/retino/refunds/batches'),
        api.get('/retino/refunds/accounts'),
      ])
      setQueue(qRes.data || [])
      setBatches(bRes.data || [])
      setAccounts(aRes.data || [])
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const selectAll = () => {
    setSelected(selected.length === queue.length ? [] : queue.map(r => r.id))
  }

  const totalSelected = queue.filter(r => selected.includes(r.id)).reduce((sum, r) => sum + (parseFloat(r.resolution_amount) || 0), 0)

  const createBatch = async () => {
    if (!selected.length) return
    const defaultAccount = accounts.find(a => a.is_default) || accounts[0]
    if (!defaultAccount) return alert('Nejdříve přidejte bankovní účet v nastavení')

    setCreating(true)
    try {
      const res = await api.post('/retino/refunds/batch', {
        returnIds: selected,
        accountId: defaultAccount.id,
        workerId: worker?.id,
      })

      // Download ABO file
      if (res.data.aboContent) {
        const blob = new Blob([res.data.aboContent], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${res.data.batch.batch_number}.abo`
        a.click()
        URL.revokeObjectURL(url)
      }

      setSelected([])
      fetchData()
    } catch (err) {
      alert(err.response?.data?.error || 'Chyba při vytváření dávky')
    } finally {
      setCreating(false)
    }
  }

  const updateBatchStatus = async (batchId, status) => {
    try {
      await api.patch(`/retino/refunds/batches/${batchId}/status`, { status })
      fetchData()
    } catch (err) {
      alert(err.response?.data?.error || 'Chyba')
    }
  }

  return (
    <div className="bg-navy-900 text-theme-primary p-3 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-4">Refundace</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {[
          { id: 'queue', label: 'Fronta', count: queue.length },
          { id: 'batches', label: 'Dávky', count: batches.length },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-blue-600 text-white' : 'bg-navy-700 text-theme-muted hover:bg-navy-600'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-theme-muted py-12">Načítání...</div>
      ) : tab === 'queue' ? (
        <>
          {/* Batch action bar */}
          {selected.length > 0 && (
            <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-3 mb-4 flex items-center justify-between">
              <span className="text-sm">
                Vybráno: <strong>{selected.length}</strong> | Celkem: <strong>{totalSelected.toFixed(2)} CZK</strong>
              </span>
              <button
                onClick={createBatch}
                disabled={creating}
                className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {creating ? 'Generuji...' : 'Vytvořit ABO dávku'}
              </button>
            </div>
          )}

          {/* Queue table */}
          <div className="bg-navy-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-theme-muted text-xs uppercase border-b border-navy-700">
                  <th className="px-3 py-2 text-left w-8">
                    <input type="checkbox" checked={selected.length === queue.length && queue.length > 0} onChange={selectAll} className="w-3.5 h-3.5" />
                  </th>
                  <th className="px-3 py-2 text-left">Žádost</th>
                  <th className="px-3 py-2 text-left">Zákazník</th>
                  <th className="px-3 py-2 text-right">Částka</th>
                  <th className="px-3 py-2 text-left">Účet</th>
                  <th className="px-3 py-2 text-left">Vyřízeno</th>
                </tr>
              </thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-theme-muted py-8">Žádné žádosti k refundaci</td></tr>
                ) : queue.map(r => (
                  <tr key={r.id} className="border-b border-navy-700/50 hover:bg-navy-700/30">
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelect(r.id)} className="w-3.5 h-3.5" />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.return_number}</td>
                    <td className="px-3 py-2">{r.customer_name || '-'}</td>
                    <td className="px-3 py-2 text-right font-bold">{parseFloat(r.resolution_amount || 0).toFixed(2)} CZK</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.refund_bank_account || '-'}</td>
                    <td className="px-3 py-2 text-xs text-theme-muted">{r.resolved_at ? new Date(r.resolved_at).toLocaleDateString('cs-CZ') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Batches list */
        <div className="bg-navy-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-theme-muted text-xs uppercase border-b border-navy-700">
                <th className="px-3 py-2 text-left">Dávka</th>
                <th className="px-3 py-2 text-left">Účet</th>
                <th className="px-3 py-2 text-right">Položek</th>
                <th className="px-3 py-2 text-right">Celkem</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Akce</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-theme-muted py-8">Žádné dávky</td></tr>
              ) : batches.map(b => (
                <tr key={b.id} className="border-b border-navy-700/50 hover:bg-navy-700/30">
                  <td className="px-3 py-2 font-mono text-xs">{b.batch_number}</td>
                  <td className="px-3 py-2 text-xs">{b.refund_accounts?.name || '-'}</td>
                  <td className="px-3 py-2 text-right">{b.item_count}</td>
                  <td className="px-3 py-2 text-right font-bold">{parseFloat(b.total_amount || 0).toFixed(2)} {b.currency}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      b.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                      b.status === 'sent_to_bank' ? 'bg-blue-900/30 text-blue-400' :
                      'bg-navy-600 text-theme-muted'
                    }`}>
                      {b.status === 'created' ? 'Vytvořeno' : b.status === 'exported' ? 'Exportováno' : b.status === 'sent_to_bank' ? 'Odesláno bance' : 'Dokončeno'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {b.status === 'created' && (
                        <button onClick={() => updateBatchStatus(b.id, 'sent_to_bank')}
                          className="text-xs text-blue-400 hover:text-blue-300">Odesláno</button>
                      )}
                      {b.status === 'sent_to_bank' && (
                        <button onClick={() => updateBatchStatus(b.id, 'completed')}
                          className="text-xs text-green-400 hover:text-green-300">Dokončit</button>
                      )}
                      {b.abo_file_url && (
                        <a href={b.abo_file_url} download={`${b.batch_number}.abo`}
                          className="text-xs text-theme-muted hover:text-theme-primary">ABO</a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
