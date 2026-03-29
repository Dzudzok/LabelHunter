import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../../services/api'
import StatusBadge from '../shared/StatusBadge'

export default function ShipmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [shipment, setShipment] = useState(null)
  const [loading, setLoading] = useState(true)

  // Tags state
  const [allTags, setAllTags] = useState([])
  const [shipmentTags, setShipmentTags] = useState([])
  const [selectedTagId, setSelectedTagId] = useState('')

  // Notes state
  const [notes, setNotes] = useState([])
  const [noteContent, setNoteContent] = useState('')
  const [noteAuthor, setNoteAuthor] = useState('')
  const [noteInternal, setNoteInternal] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)

  // Email log state
  const [emails, setEmails] = useState([])

  // Storage extension state
  const [extendingStorage, setExtendingStorage] = useState(false)
  const [extendResult, setExtendResult] = useState(null)

  useEffect(() => {
    async function fetch() {
      try {
        const res = await api.get(`/retino/tracking/shipments/${id}`)
        setShipment(res.data)
      } catch (err) {
        console.error('Failed to fetch shipment:', err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [id])

  // Fetch tags, notes, emails when shipment loads
  useEffect(() => {
    if (!shipment) return
    const deliveryNoteId = shipment.id

    async function fetchTags() {
      try {
        const [allRes, shipmentRes] = await Promise.all([
          api.get('/retino/tags'),
          api.get(`/retino/tags/shipment/${deliveryNoteId}`)
        ])
        setAllTags(allRes.data)
        setShipmentTags(shipmentRes.data)
      } catch (err) {
        console.error('Failed to fetch tags:', err)
      }
    }

    async function fetchNotes() {
      try {
        const res = await api.get(`/retino/tags/notes/${deliveryNoteId}`)
        setNotes(res.data)
      } catch (err) {
        console.error('Failed to fetch notes:', err)
      }
    }

    async function fetchEmails() {
      try {
        const res = await api.get(`/retino/tags/emails/${deliveryNoteId}`)
        setEmails(res.data)
      } catch (err) {
        console.error('Failed to fetch emails:', err)
      }
    }

    fetchTags()
    fetchNotes()
    fetchEmails()
  }, [shipment])

  async function handleAddTag() {
    if (!selectedTagId) return
    try {
      await api.post(`/retino/tags/shipment/${shipment.id}`, { tag_id: selectedTagId })
      const res = await api.get(`/retino/tags/shipment/${shipment.id}`)
      setShipmentTags(res.data)
      setSelectedTagId('')
    } catch (err) {
      console.error('Failed to add tag:', err)
    }
  }

  async function handleRemoveTag(tagId) {
    try {
      await api.delete(`/retino/tags/shipment/${shipment.id}/${tagId}`)
      setShipmentTags(prev => prev.filter(t => t.tag_id !== tagId))
    } catch (err) {
      console.error('Failed to remove tag:', err)
    }
  }

  async function handleAddNote(e) {
    e.preventDefault()
    if (!noteContent.trim()) return
    setNoteSaving(true)
    try {
      await api.post(`/retino/tags/notes/${shipment.id}`, {
        author: noteAuthor || 'Anonym',
        content: noteContent,
        is_internal: noteInternal
      })
      const res = await api.get(`/retino/tags/notes/${shipment.id}`)
      setNotes(res.data)
      setNoteContent('')
      setNoteInternal(false)
    } catch (err) {
      console.error('Failed to add note:', err)
    } finally {
      setNoteSaving(false)
    }
  }

  async function handleExtendStorage() {
    setExtendingStorage(true)
    setExtendResult(null)
    try {
      const res = await api.post(`/retino/tracking/extend-storage/${shipment.id}`)
      setExtendResult(res.data)
    } catch (err) {
      setExtendResult({ success: false, message: err.response?.data?.error || 'Chyba' })
    } finally {
      setExtendingStorage(false)
    }
  }

  if (loading) return <div className="bg-navy-900 flex items-center justify-center h-full text-theme-muted">Načítání...</div>
  if (!shipment) return <div className="bg-navy-900 flex items-center justify-center h-full text-red-400">Zásilka nenalezena</div>

  return (
    <div className="bg-navy-900 text-theme-primary p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/retino/tracking')} className="text-theme-muted hover:text-theme-primary text-sm">
          &larr; Zpět
        </button>
        <h1 className="text-2xl font-bold">{shipment.doc_number || shipment.invoice_number}</h1>
        <StatusBadge status={shipment.unified_status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — info */}
        <div className="lg:col-span-1 space-y-4">
          {/* Shipment info */}
          <div className="bg-navy-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Informace o zásilce</h3>
            <InfoRow label="Doklad" value={shipment.doc_number} />
            <InfoRow label="Faktura" value={shipment.invoice_number} />
            <InfoRow label="Objednávka" value={shipment.order_number} />
            <InfoRow label="Datum" value={shipment.date_issued ? new Date(shipment.date_issued).toLocaleDateString('cs-CZ') : '-'} />
            <InfoRow label="Dopravce" value={shipment.shipper_code} />
            <InfoRow label="Tracking" value={shipment.tracking_number} />
            {shipment.tracking_url && (
              <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm block mt-2">
                Sledovat u dopravce &rarr;
              </a>
            )}
            {shipment.stored_until && (
              <InfoRow label="Úložní doba do" value={new Date(shipment.stored_until).toLocaleDateString('cs-CZ')} />
            )}
            {shipment.unified_status === 'available_for_pickup' && ['Zasilkovna', 'ZASILKOVNA', 'CP'].includes(shipment.shipper_code) && (
              <div className="mt-3">
                <button
                  onClick={handleExtendStorage}
                  disabled={extendingStorage}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {extendingStorage ? 'Prodlužuji...' : 'Prodloužit úložní dobu'}
                </button>
                {extendResult && (
                  <div className={`text-xs mt-2 ${extendResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {extendResult.message}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Customer */}
          <div className="bg-navy-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Zákazník</h3>
            <InfoRow label="Jméno" value={shipment.customer_name} />
            <InfoRow label="E-mail" value={shipment.customer_email} />
            <InfoRow label="Telefon" value={shipment.customer_phone} />
            <InfoRow label="Adresa" value={[shipment.delivery_street, shipment.delivery_city, shipment.delivery_postal_code, shipment.delivery_country].filter(Boolean).join(', ')} />
          </div>

          {/* Items */}
          {shipment.items && shipment.items.length > 0 && (
            <div className="bg-navy-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Položky ({shipment.items.length})</h3>
              <div className="space-y-2">
                {shipment.items.filter(i => i.item_type === 'goods').map((item, i) => (
                  <div key={i} className="flex justify-between items-start text-sm border-b border-navy-700/50 pb-2">
                    <div>
                      <span className="text-theme-primary">{item.text}</span>
                      {item.brand && <span className="text-theme-muted ml-2">({item.brand})</span>}
                      {item.code && <div className="text-xs text-theme-muted font-mono">{item.code}</div>}
                    </div>
                    <span className="text-theme-muted whitespace-nowrap ml-2">{item.qty}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="bg-navy-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Štítky</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {shipmentTags.map(tag => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    color: tag.shipment_tags?.color || '#fff',
                    backgroundColor: tag.shipment_tags?.bg_color || '#374151'
                  }}
                >
                  {tag.shipment_tags?.name || 'Tag'}
                  <button
                    onClick={() => handleRemoveTag(tag.tag_id)}
                    className="ml-0.5 hover:opacity-70 leading-none"
                    title="Odebrat štítek"
                  >
                    &times;
                  </button>
                </span>
              ))}
              {shipmentTags.length === 0 && (
                <span className="text-theme-muted text-xs">Žádné štítky</span>
              )}
            </div>
            <div className="flex gap-2">
              <select
                value={selectedTagId}
                onChange={e => setSelectedTagId(e.target.value)}
                className="flex-1 bg-navy-700 border border-navy-600 rounded-lg px-3 py-1.5 text-sm text-theme-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Vybrat štítek...</option>
                {allTags
                  .filter(t => !shipmentTags.some(st => st.tag_id === t.id))
                  .map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))
                }
              </select>
              <button
                onClick={handleAddTag}
                disabled={!selectedTagId}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm text-white transition-colors"
              >
                Přidat
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-navy-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Poznámky</h3>
            <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
              {notes.length === 0 && (
                <span className="text-theme-muted text-xs">Žádné poznámky</span>
              )}
              {[...notes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(note => (
                <div key={note.id} className="bg-navy-700/50 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-theme-primary">{note.author}</span>
                    <div className="flex items-center gap-2">
                      {note.is_internal && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 uppercase font-semibold">
                          interní
                        </span>
                      )}
                      <span className="text-xs text-theme-muted">
                        {note.created_at ? new Date(note.created_at).toLocaleString('cs-CZ') : ''}
                      </span>
                    </div>
                  </div>
                  <p className="text-theme-muted whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddNote} className="space-y-2">
              <input
                type="text"
                placeholder="Autor"
                value={noteAuthor}
                onChange={e => setNoteAuthor(e.target.value)}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-1.5 text-sm text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <textarea
                placeholder="Napište poznámku..."
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                rows={3}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-theme-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={noteInternal}
                    onChange={e => setNoteInternal(e.target.checked)}
                    className="rounded border-navy-600 bg-navy-700 text-blue-500 focus:ring-blue-500"
                  />
                  Interní poznámka
                </label>
                <button
                  type="submit"
                  disabled={!noteContent.trim() || noteSaving}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm text-white transition-colors"
                >
                  {noteSaving ? 'Ukládání...' : 'Přidat poznámku'}
                </button>
              </div>
            </form>
          </div>

          {/* Email Log */}
          <div className="bg-navy-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-theme-muted mb-3 uppercase tracking-wider">Odeslaná komunikace</h3>
            {emails.length === 0 ? (
              <span className="text-theme-muted text-xs">Žádné odeslané e-maily</span>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {emails.map((email, i) => (
                  <div key={email.id || i} className="bg-navy-700/50 rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-theme-primary">{email.subject || email.type || 'E-mail'}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold ${
                          email.status === 'sent'
                            ? 'bg-green-500/20 text-green-400'
                            : email.status === 'failed'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-gray-500/20 text-gray-400'
                        }`}
                      >
                        {email.status === 'sent' ? 'odesláno' : email.status === 'failed' ? 'selhalo' : email.status || '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-theme-muted">
                      {email.type && <span>{email.type}</span>}
                      {email.recipient && <span>{email.recipient}</span>}
                      {email.created_at && <span>{new Date(email.created_at).toLocaleString('cs-CZ')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — tracking timeline */}
        <div className="lg:col-span-2">
          <div className="bg-navy-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-theme-muted mb-4 uppercase tracking-wider">Tracking Timeline</h3>
            {shipment.trackingTimeline && shipment.trackingTimeline.length > 0 ? (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-navy-600" />

                <div className="space-y-4">
                  {shipment.trackingTimeline.map((event, i) => (
                    <div key={i} className="flex items-start gap-4 relative">
                      {/* Dot */}
                      <div
                        className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center z-10"
                        style={{ backgroundColor: i === 0 ? (shipment.statusColor || '#8B5CF6') : '#374151' }}
                      >
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-theme-primary">{event.description}</div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-theme-muted">
                            {event.date ? new Date(event.date).toLocaleString('cs-CZ') : ''}
                          </span>
                          {event.location && (
                            <span className="text-xs text-theme-muted">{event.location}</span>
                          )}
                          <StatusBadge status={event.unifiedStatus} className="text-[10px] px-1.5 py-0" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-theme-muted text-center py-8">Žádné tracking události</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-theme-muted">{label}</span>
      <span className="text-theme-primary font-medium">{value || '-'}</span>
    </div>
  )
}
