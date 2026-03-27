import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../../services/api'
import { useAuthStore } from '../../../store/authStore'
import StatusBadge from '../shared/StatusBadge'

export default function ReturnDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const worker = useAuthStore(s => s.worker)
  const [ret, setRet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)
  const [showResolve, setShowResolve] = useState(false)

  const fetchReturn = async () => {
    try {
      const res = await api.get(`/retino/returns/${id}`)
      setRet(res.data)
    } catch {
      console.error('Failed to fetch return')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReturn() }, [id])

  const changeStatus = async (newStatus, note = '') => {
    try {
      await api.patch(`/retino/returns/${id}/status`, { newStatus, note, workerId: worker?.id })
      fetchReturn()
    } catch (err) {
      alert(err.response?.data?.error || 'Chyba')
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!message.trim()) return
    setSending(true)
    try {
      await api.post(`/retino/returns/${id}/messages`, {
        content: message.trim(),
        isInternal,
        workerId: worker?.id,
      })
      setMessage('')
      fetchReturn()
    } catch { /* ignore */ }
    setSending(false)
  }

  if (loading) return <div className="bg-navy-900 flex items-center justify-center h-full text-theme-muted">Načítání...</div>
  if (!ret) return <div className="bg-navy-900 flex items-center justify-center h-full text-red-400">Žádost nenalezena</div>

  return (
    <div className="bg-navy-900 text-theme-primary p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/retino/returns')} className="text-theme-muted hover:text-theme-primary text-sm">
          &larr; Zpět
        </button>
        <h1 className="text-2xl font-bold">{ret.return_number}</h1>
        <StatusBadge status={ret.status} type="return" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="space-y-4">
          {/* Info */}
          <div className="bg-navy-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Informace</h3>
            <InfoRow label="Typ" value={ret.type === 'return' ? 'Vrácení' : ret.type === 'complaint' ? 'Reklamace' : 'Záruka'} />
            <InfoRow label="Důvod" value={ret.reasonLabel} />
            {ret.reason_detail && <InfoRow label="Popis" value={ret.reason_detail} />}
            {ret.vehicle_info && <InfoRow label="Vozidlo" value={ret.vehicle_info} />}
            <InfoRow label="Vytvořeno" value={ret.requested_at ? new Date(ret.requested_at).toLocaleString('cs-CZ') : '-'} />
            <InfoRow label="Vytvořil" value={ret.created_by_type === 'admin' ? 'Admin' : 'Zákazník'} />
          </div>

          {/* Customer */}
          <div className="bg-navy-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Zákazník</h3>
            <InfoRow label="Jméno" value={ret.customer_name} />
            <InfoRow label="E-mail" value={ret.customer_email} />
            <InfoRow label="Telefon" value={ret.customer_phone} />
          </div>

          {/* Delivery note */}
          {ret.deliveryNote && (
            <div className="bg-navy-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Objednávka</h3>
              <InfoRow label="Doklad" value={ret.deliveryNote.doc_number} />
              <InfoRow label="Faktura" value={ret.deliveryNote.invoice_number} />
              <InfoRow label="Objednávka" value={ret.deliveryNote.order_number} />
              <InfoRow label="Dopravce" value={ret.deliveryNote.shipper_code} />
            </div>
          )}

          {/* Items */}
          {ret.items?.length > 0 && (
            <div className="bg-navy-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Produkty</h3>
              {ret.items.map((item, i) => (
                <div key={i} className="flex justify-between py-1.5 text-sm border-b border-navy-700/50 last:border-0">
                  <span>{item.delivery_note_items?.text || 'Produkt'}</span>
                  <span className="text-theme-muted">{item.qty_returned}x</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="bg-navy-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Akce</h3>
            <div className="flex flex-wrap gap-2">
              {ret.allowedTransitions?.map(t => (
                <button
                  key={t.status}
                  onClick={() => {
                    if (['approved', 'rejected'].includes(t.status)) {
                      setShowResolve(true)
                    } else {
                      const note = prompt(`Poznámka k přechodu na "${t.label}":`)
                      if (note !== null) changeStatus(t.status, note)
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-navy-600 hover:bg-navy-500 text-theme-primary transition-colors"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          {ret.resolution_type && (
            <div className="bg-green-900/30 border border-green-700 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-green-400 mb-2">Vyřízení</h3>
              <InfoRow label="Typ" value={ret.resolution_type} />
              {ret.resolution_amount && <InfoRow label="Částka" value={`${ret.resolution_amount} CZK`} />}
              {ret.resolution_note && <InfoRow label="Poznámka" value={ret.resolution_note} />}
              {ret.refund_method && <InfoRow label="Způsob vrácení" value={ret.refund_method} />}
            </div>
          )}
        </div>

        {/* Right — timeline + messages */}
        <div className="lg:col-span-2 space-y-4">
          {/* Timeline */}
          <div className="bg-navy-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-theme-muted mb-4 uppercase tracking-wider">Timeline</h3>
            {ret.timeline?.length > 0 ? (
              <div className="relative">
                <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-navy-600" />
                <div className="space-y-3">
                  {ret.timeline.map((event, i) => (
                    <div key={i} className="flex items-start gap-4 relative">
                      <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center z-10 bg-navy-600">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={event.new_status} type="return" />
                          {event.workerName && <span className="text-xs text-theme-muted">({event.workerName})</span>}
                        </div>
                        {event.note && <div className="text-sm text-theme-muted mt-1">{event.note}</div>}
                        <div className="text-xs text-theme-muted mt-0.5">
                          {event.created_at ? new Date(event.created_at).toLocaleString('cs-CZ') : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-theme-muted text-center py-4">Žádné události</div>
            )}
          </div>

          {/* Messages */}
          <div className="bg-navy-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-theme-muted mb-4 uppercase tracking-wider">Zprávy</h3>
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
              {ret.messages?.length > 0 ? ret.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg ${
                    msg.is_internal ? 'bg-yellow-900/20 border border-yellow-700/30' :
                    msg.author_type === 'customer' ? 'bg-blue-900/20 ml-4' : 'bg-navy-700 mr-4'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs text-theme-muted mb-1">
                    <span className="font-semibold">
                      {msg.author_type === 'customer' ? 'Zákazník' : (msg.workerName || 'Admin')}
                    </span>
                    {msg.is_internal && <span className="text-yellow-500 text-[10px] uppercase font-bold">interní</span>}
                    <span>{new Date(msg.created_at).toLocaleString('cs-CZ')}</span>
                  </div>
                  <div className="text-sm text-theme-primary">{msg.content}</div>
                </div>
              )) : (
                <div className="text-theme-muted text-center py-4">Žádné zprávy</div>
              )}
            </div>

            <form onSubmit={sendMessage} className="flex gap-2 items-end">
              <div className="flex-1">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Napište zprávu..."
                  rows={2}
                  className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary resize-none"
                />
                <label className="flex items-center gap-1.5 mt-1 text-xs text-theme-muted">
                  <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="w-3 h-3" />
                  Interní poznámka (zákazník neuvidí)
                </label>
              </div>
              <button
                type="submit"
                disabled={sending || !message.trim()}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 mb-5"
              >
                Odeslat
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Resolve modal */}
      {showResolve && (
        <ResolveModal
          onClose={() => setShowResolve(false)}
          onResolve={async (data) => {
            try {
              await api.patch(`/retino/returns/${id}/resolve`, { ...data, workerId: worker?.id })
              await changeStatus(data.resolutionType === 'rejected' ? 'rejected' : 'approved')
              setShowResolve(false)
            } catch (err) {
              alert(err.response?.data?.error || 'Chyba')
            }
          }}
        />
      )}
    </div>
  )
}

function ResolveModal({ onClose, onResolve }) {
  const [resolutionType, setResolutionType] = useState('refund')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [refundMethod, setRefundMethod] = useState('bank_transfer')
  const [bankAccount, setBankAccount] = useState('')

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-navy-800 rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Vyřízení žádosti</h2>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-sm text-theme-muted block mb-1">Typ řešení</label>
            <select value={resolutionType} onChange={(e) => setResolutionType(e.target.value)}
              className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary">
              <option value="refund">Vrácení peněz</option>
              <option value="replacement">Výměna zboží</option>
              <option value="repair">Oprava</option>
              <option value="rejected">Zamítnutí</option>
            </select>
          </div>

          {resolutionType === 'refund' && (
            <>
              <div>
                <label className="text-sm text-theme-muted block mb-1">Částka (CZK)</label>
                <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary" />
              </div>
              <div>
                <label className="text-sm text-theme-muted block mb-1">Způsob vrácení</label>
                <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}
                  className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary">
                  <option value="bank_transfer">Bankovní převod</option>
                  <option value="original_method">Původní platební metoda</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-theme-muted block mb-1">Číslo účtu zákazníka</label>
                <input type="text" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)}
                  className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary" />
              </div>
            </>
          )}

          <div>
            <label className="text-sm text-theme-muted block mb-1">Poznámka</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary resize-none" />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-theme-muted hover:text-theme-primary">Zrušit</button>
          <button
            onClick={() => onResolve({
              resolutionType, amount: amount || null, note, refundMethod,
              bankAccount: bankAccount || null,
            })}
            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Potvrdit
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-theme-muted">{label}</span>
      <span className="text-theme-primary font-medium text-right max-w-[60%]">{value || '-'}</span>
    </div>
  )
}
