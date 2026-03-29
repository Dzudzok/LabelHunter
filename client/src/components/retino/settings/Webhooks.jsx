import { useState, useEffect } from 'react'
import { api } from '../../../services/api'

const EVENTS = [
  { value: 'return_created', label: 'Nová žádost' },
  { value: 'status_changed', label: 'Změna stavu' },
  { value: 'resolved', label: 'Vyřízeno' },
  { value: 'message', label: 'Nová zpráva' },
]

export default function Webhooks() {
  const [endpoints, setEndpoints] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [tab, setTab] = useState('endpoints')
  const [form, setForm] = useState({ name: '', url: '', secret: '', events: ['return_created'], enabled: true })

  const fetch = async () => {
    setLoading(true)
    try {
      const [eRes, lRes] = await Promise.all([
        api.get('/retino/webhooks'),
        api.get('/retino/webhooks/log'),
      ])
      setEndpoints(eRes.data || [])
      setLogs(lRes.data || [])
    } catch { /* */ }
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const startNew = () => {
    setEditing('new')
    setForm({ name: '', url: '', secret: '', events: ['return_created'], enabled: true })
  }

  const startEdit = (ep) => {
    setEditing(ep.id)
    setForm({ name: ep.name, url: ep.url, secret: ep.secret || '', events: ep.events || [], enabled: ep.enabled })
  }

  const save = async () => {
    try {
      if (editing === 'new') {
        await api.post('/retino/webhooks', form)
      } else {
        await api.patch(`/retino/webhooks/${editing}`, form)
      }
      setEditing(null)
      fetch()
    } catch (err) {
      alert(err.response?.data?.error || 'Chyba')
    }
  }

  const remove = async (id) => {
    if (!confirm('Smazat endpoint?')) return
    await api.delete(`/retino/webhooks/${id}`)
    fetch()
  }

  const testWebhook = async (id) => {
    try {
      await api.post(`/retino/webhooks/${id}/test`)
      alert('Test webhook odeslán')
      fetch()
    } catch (err) {
      alert('Test selhal: ' + (err.response?.data?.error || err.message))
    }
  }

  const toggleEvent = (ev) => {
    setForm(prev => ({
      ...prev,
      events: prev.events.includes(ev) ? prev.events.filter(e => e !== ev) : [...prev.events, ev],
    }))
  }

  return (
    <div className="bg-navy-900 text-theme-primary p-3 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-bold">Webhooks</h1>
        <button onClick={startNew} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold">
          Přidat endpoint
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {[
          { id: 'endpoints', label: 'Endpointy', count: endpoints.length },
          { id: 'log', label: 'Log', count: logs.length },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-navy-700 text-theme-muted'}`}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {editing && (
        <div className="bg-navy-800 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-theme-muted block mb-1">Název</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary" />
            </div>
            <div>
              <label className="text-xs text-theme-muted block mb-1">URL</label>
              <input type="url" value={form.url} onChange={e => setForm({...form, url: e.target.value})}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary" placeholder="https://..." />
            </div>
          </div>
          <div>
            <label className="text-xs text-theme-muted block mb-1">Secret (volitelné, pro podpis)</label>
            <input type="text" value={form.secret} onChange={e => setForm({...form, secret: e.target.value})}
              className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary font-mono" />
          </div>
          <div>
            <label className="text-xs text-theme-muted block mb-1">Události</label>
            <div className="flex flex-wrap gap-2">
              {EVENTS.map(ev => (
                <label key={ev.value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer ${
                  form.events.includes(ev.value) ? 'bg-blue-600 text-white' : 'bg-navy-700 text-theme-muted'
                }`}>
                  <input type="checkbox" checked={form.events.includes(ev.value)} onChange={() => toggleEvent(ev.value)} className="hidden" />
                  {ev.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold">Uložit</button>
            <button onClick={() => setEditing(null)} className="text-theme-muted hover:text-theme-primary text-sm">Zrušit</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-center text-theme-muted py-12">Načítání...</div> : tab === 'endpoints' ? (
        <div className="space-y-2">
          {endpoints.map(ep => (
            <div key={ep.id} className="bg-navy-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${ep.enabled ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className="font-semibold">{ep.name}</span>
                </div>
                <div className="text-xs text-theme-muted font-mono mt-1">{ep.url}</div>
                <div className="flex gap-1 mt-1">
                  {(ep.events || []).map(e => (
                    <span key={e} className="text-[10px] bg-navy-600 text-theme-muted px-1.5 py-0.5 rounded">{e}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => testWebhook(ep.id)} className="text-xs text-yellow-400">Test</button>
                <button onClick={() => startEdit(ep)} className="text-xs text-blue-400">Upravit</button>
                <button onClick={() => remove(ep.id)} className="text-xs text-red-400">Smazat</button>
              </div>
            </div>
          ))}
          {endpoints.length === 0 && <div className="text-center text-theme-muted py-12">Žádné endpointy</div>}
        </div>
      ) : (
        /* Webhook log */
        <div className="bg-navy-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-theme-muted text-xs uppercase border-b border-navy-700">
                <th className="px-3 py-2 text-left">Endpoint</th>
                <th className="px-3 py-2 text-left">Událost</th>
                <th className="px-3 py-2 text-right">Status</th>
                <th className="px-3 py-2 text-right">ms</th>
                <th className="px-3 py-2 text-left">Čas</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-b border-navy-700/50">
                  <td className="px-3 py-2 text-xs">{l.webhook_endpoints?.name || '-'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.event}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`text-xs font-bold ${l.status_code >= 200 && l.status_code < 300 ? 'text-green-400' : 'text-red-400'}`}>
                      {l.status_code || 'ERR'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-theme-muted">{l.duration_ms || '-'}</td>
                  <td className="px-3 py-2 text-xs text-theme-muted">{new Date(l.created_at).toLocaleString('cs-CZ')}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={5} className="text-center text-theme-muted py-8">Žádné záznamy</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
