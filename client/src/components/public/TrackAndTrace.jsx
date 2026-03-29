import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

const apiBase = import.meta.env.VITE_API_URL || '/api'

const STATUS_COLORS = {
  label_created: '#9CA3AF', handed_to_carrier: '#3B82F6', in_transit: '#8B5CF6',
  out_for_delivery: '#F59E0B', available_for_pickup: '#F59E0B', delivered: '#10B981',
  failed_delivery: '#EF4444', returned_to_sender: '#EF4444', problem: '#DC2626', unknown: '#6B7280',
}

const STATUS_ICONS = {
  label_created: '\uD83D\uDCCB', handed_to_carrier: '\uD83D\uDCE6', in_transit: '\uD83D\uDE9A',
  out_for_delivery: '\uD83C\uDFE0', available_for_pickup: '\uD83D\uDCEC', delivered: '\u2705',
  failed_delivery: '\u274C', returned_to_sender: '\u21A9\uFE0F', problem: '\u26A0\uFE0F', unknown: '\u2753',
}

const PROBLEM_OPTIONS = [
  { value: 'late_delivery', label: 'Pozdn\u00ed doru\u010den\u00ed' },
  { value: 'damaged_package', label: 'Po\u0161kozen\u00e1 z\u00e1silka' },
  { value: 'wrong_item', label: '\u0160patn\u00e1 polo\u017eka' },
  { value: 'poor_packaging', label: '\u0160patn\u00e9 balen\u00ed' },
  { value: 'rude_courier', label: 'Nezd\u016bo\u0159il\u00fd kur\u00fdr' },
  { value: 'other', label: 'Jin\u00e9' },
]

export default function TrackAndTrace() {
  const { trackingToken } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Rating state
  const [ratingValue, setRatingValue] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [selectedProblems, setSelectedProblems] = useState([])
  const [ratingComment, setRatingComment] = useState('')
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [ratingError, setRatingError] = useState(null)
  const [submittingRating, setSubmittingRating] = useState(false)

  useEffect(() => {
    async function fetch() {
      try {
        const res = await axios.get(`${apiBase}/retino/public/returns/track/${trackingToken}`)
        setData(res.data)
        if (res.data.rating) {
          setRatingSubmitted(true)
          setRatingValue(res.data.rating.rating)
        }
      } catch {
        setError('Z\u00e1silka nenalezena')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [trackingToken])

  const handleSubmitRating = async () => {
    if (!ratingValue) return
    setSubmittingRating(true)
    setRatingError(null)
    try {
      await axios.post(`${apiBase}/retino/public/returns/track/${trackingToken}/rate`, {
        rating: ratingValue,
        problems: ratingValue <= 4 ? selectedProblems : [],
        comment: ratingComment || null,
      })
      setRatingSubmitted(true)
    } catch (err) {
      if (err.response?.status === 409) {
        setRatingSubmitted(true)
      } else {
        setRatingError(err.response?.data?.error || 'Chyba p\u0159i odes\u00edl\u00e1n\u00ed hodnocen\u00ed')
      }
    } finally {
      setSubmittingRating(false)
    }
  }

  const toggleProblem = (value) => {
    setSelectedProblems(prev =>
      prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value]
    )
  }

  if (loading) return <PageWrapper><div className="text-center py-12 text-gray-500">Na\u010d\u00edt\u00e1n\u00ed...</div></PageWrapper>
  if (error) return <PageWrapper><div className="text-center py-12 text-red-500">{error}</div></PageWrapper>
  if (!data) return null

  const statusColor = STATUS_COLORS[data.unified_status] || '#6B7280'

  return (
    <PageWrapper>
      {/* Status hero */}
      <div className="text-center py-8">
        <div className="text-5xl mb-3">{STATUS_ICONS[data.unified_status] || '\uD83D\uDCE6'}</div>
        <div className="text-2xl font-bold mb-1" style={{ color: statusColor }}>
          {data.statusLabel || data.unified_status}
        </div>
        {data.last_tracking_description && (
          <div className="text-sm text-gray-500 mt-1">{data.last_tracking_description}</div>
        )}
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Informace o z\u00e1silce</h3>
        <InfoRow label="\u010c\u00edslo dokladu" value={data.doc_number} />
        <InfoRow label="Objedn\u00e1vka" value={data.order_number} />
        <InfoRow label="Dopravce" value={data.shipper_code} />
        <InfoRow label="Tracking" value={data.tracking_number} />
        {data.tracking_url && (
          <a href={data.tracking_url} target="_blank" rel="noopener noreferrer"
            className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-500 font-medium">
            Sledovat u dopravce &rarr;
          </a>
        )}
      </div>

      {/* Items */}
      {data.items && data.items.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Obsah z\u00e1silky</h3>
          {data.items.map((item, i) => (
            <div key={i} className="flex justify-between py-1.5 text-sm border-b border-gray-100 last:border-0">
              <span>{item.text} {item.brand && <span className="text-gray-400">({item.brand})</span>}</span>
              <span className="text-gray-500">{item.qty}x</span>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      {data.trackingTimeline && data.trackingTimeline.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase mb-4">Historie</h3>
          <div className="relative">
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />
            <div className="space-y-4">
              {data.trackingTimeline.map((event, i) => (
                <div key={i} className="flex items-start gap-4 relative">
                  <div
                    className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center z-10"
                    style={{ backgroundColor: i === 0 ? statusColor : '#e5e7eb' }}
                  >
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-800">{event.description}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {event.date ? new Date(event.date).toLocaleString('cs-CZ') : ''}
                      {event.location && ` \u2014 ${event.location}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rating widget — only for delivered shipments */}
      {data.unified_status === 'delivered' && (
        <div className="bg-white rounded-xl shadow-sm border p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Hodnocen\u00ed doru\u010den\u00ed</h3>

          {ratingSubmitted ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">{ratingValue >= 4 ? '\uD83D\uDE0A' : ratingValue >= 3 ? '\uD83D\uDE10' : '\uD83D\uDE1E'}</div>
              <div className="flex justify-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <StarIcon key={star} filled={star <= ratingValue} size={28} />
                ))}
              </div>
              <div className="text-sm text-gray-500">
                D\u011bkujeme za Va\u0161e hodnocen\u00ed!
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Jak jste spokojeni s doru\u010den\u00edm z\u00e1silky?
              </p>

              {/* Stars */}
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRatingValue(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <StarIcon filled={star <= (hoverRating || ratingValue)} size={36} />
                  </button>
                ))}
              </div>

              {/* Rating label */}
              {ratingValue > 0 && (
                <div className="text-center text-sm font-medium mb-4" style={{ color: ratingValue >= 4 ? '#10B981' : ratingValue >= 3 ? '#F59E0B' : '#EF4444' }}>
                  {ratingValue === 5 && 'V\u00fdborn\u00e9!'}
                  {ratingValue === 4 && 'Dobr\u00e9'}
                  {ratingValue === 3 && 'Pr\u016fm\u011brn\u00e9'}
                  {ratingValue === 2 && '\u0160patn\u00e9'}
                  {ratingValue === 1 && 'Velmi \u0161patn\u00e9'}
                </div>
              )}

              {/* Problem selection — show for ratings 1-4 */}
              {ratingValue > 0 && ratingValue <= 4 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2">Co byste zlep\u0161ili? (voliteln\u00e9)</p>
                  <div className="flex flex-wrap gap-2">
                    {PROBLEM_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => toggleProblem(opt.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          selectedProblems.includes(opt.value)
                            ? 'bg-red-50 border-red-300 text-red-700'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Comment */}
              {ratingValue > 0 && (
                <div className="mb-4">
                  <textarea
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    placeholder="Va\u0161e pozn\u00e1mka (voliteln\u00e9)..."
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              )}

              {/* Submit */}
              {ratingValue > 0 && (
                <button
                  onClick={handleSubmitRating}
                  disabled={submittingRating}
                  className="w-full bg-[#1046A0] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#0d3a8a] disabled:opacity-50 transition-colors"
                >
                  {submittingRating ? 'Odes\u00edl\u00e1m...' : 'Odeslat hodnocen\u00ed'}
                </button>
              )}

              {ratingError && (
                <div className="text-red-500 text-xs text-center mt-2">{ratingError}</div>
              )}
            </>
          )}
        </div>
      )}

      {/* Return link */}
      <div className="text-center mt-6">
        <a href="/vraceni" className="text-sm text-blue-600 hover:text-blue-500">
          Chcete vr\u00e1tit zbo\u017e\u00ed? Klikn\u011bte zde
        </a>
      </div>
    </PageWrapper>
  )
}

function StarIcon({ filled, size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? '#F59E0B' : 'none'}
      stroke={filled ? '#F59E0B' : '#D1D5DB'}
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  )
}

function PageWrapper({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1046A0] text-white">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <img src="/Mroauto_1994.png" alt="MROAUTO" className="h-10 object-contain" onError={(e) => { e.target.style.display = 'none' }} />
          <div>
            <div className="font-bold text-lg">MROAUTO</div>
            <div className="text-xs opacity-80">Sledov\u00e1n\u00ed z\u00e1silky</div>
          </div>
        </div>
        <div className="h-1 bg-[#D8112A]" />
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {children}
      </div>

      {/* Footer */}
      <div className="bg-gray-100 border-t mt-8 py-4 text-center text-xs text-gray-400">
        MROAUTO AUTOD\u00cdLY s.r.o. | www.mroauto.cz
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value || '-'}</span>
    </div>
  )
}
