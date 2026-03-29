import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../services/api'

const EMAIL_TYPE_LABELS = {
  in_transit: 'Na ceste',
  available_for_pickup: 'K vyzvednutí',
  delivered: 'Doruceno',
  failed_delivery: 'Nedoruceno',
  order_confirmed: 'Objednávka potvrzena',
  order_shipped: 'Objednávka odeslána',
}

const EMAIL_TYPE_ICONS = {
  in_transit: '📦',
  available_for_pickup: '📬',
  delivered: '✅',
  failed_delivery: '⚠️',
  order_confirmed: '🛒',
  order_shipped: '🚚',
}

const AVAILABLE_TAGS = [
  { tag: '[[order.code]]', desc: 'Císlo objednávky / dodacího listu' },
  { tag: '[[shipping.tracking_number]]', desc: 'Sledovací císlo zásilky' },
  { tag: '[[shipping.carrier]]', desc: 'Název dopravce' },
  { tag: '[[customer.name]]', desc: 'Jméno zákazníka' },
  { tag: '[[customer.email]]', desc: 'E-mail zákazníka' },
  { tag: '[[delivery_note.doc_number]]', desc: 'Císlo dodacího listu' },
]

export default function EmailDesigner() {
  const [templates, setTemplates] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ subject_template: '', heading: '', body_html: '', enabled: true })
  const [design, setDesign] = useState({})
  const [designOpen, setDesignOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingDesign, setSavingDesign] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    loadTemplates()
    loadDesign()
  }, [])

  const loadTemplates = async () => {
    try {
      const { data } = await api.get('/retino/email-settings/templates')
      setTemplates(data)
      if (data.length > 0 && !selected) {
        selectTemplate(data[0])
      }
    } catch (err) {
      console.error('Failed to load templates:', err)
    }
  }

  const loadDesign = async () => {
    try {
      const { data } = await api.get('/retino/email-settings/design')
      setDesign(data)
    } catch (err) {
      console.error('Failed to load design:', err)
    }
  }

  const selectTemplate = useCallback((tpl) => {
    setSelected(tpl.email_type)
    setForm({
      subject_template: tpl.subject_template || '',
      heading: tpl.heading || '',
      body_html: tpl.body_html || '',
      enabled: tpl.enabled ?? true,
    })
    loadPreview(tpl.email_type)
  }, [])

  const loadPreview = async (emailType) => {
    try {
      const { data } = await api.post('/retino/email-settings/preview', { email_type: emailType })
      setPreviewHtml(data.html)
    } catch (err) {
      console.error('Failed to load preview:', err)
    }
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSaveTemplate = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await api.patch(`/retino/email-settings/templates/${selected}`, form)
      showToast('Šablona uložena')
      await loadTemplates()
      await loadPreview(selected)
    } catch (err) {
      showToast('Chyba pri ukládání', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDesign = async () => {
    setSavingDesign(true)
    try {
      const { id, created_at, updated_at, ...payload } = design
      await api.patch('/retino/email-settings/design', payload)
      showToast('Design uložen')
      if (selected) await loadPreview(selected)
    } catch (err) {
      showToast('Chyba pri ukládání designu', 'error')
    } finally {
      setSavingDesign(false)
    }
  }

  const handleSendTest = async () => {
    const recipient = prompt('Zadejte e-mailovou adresu pro testovací e-mail:')
    if (!recipient) return
    setSendingTest(true)
    try {
      await api.post('/retino/email-settings/test', { email_type: selected, recipient })
      showToast(`Test odeslán na ${recipient}`)
    } catch (err) {
      showToast('Chyba pri odesílání testu', 'error')
    } finally {
      setSendingTest(false)
    }
  }

  const selectedTpl = templates.find(t => t.email_type === selected)

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-theme-primary">E-mailový designer</h1>
        <p className="text-theme-muted text-sm mt-1">Správa e-mailových šablon a designu</p>
      </div>

      <div className="flex flex-col xl:flex-row gap-4">
        {/* Left panel — template list */}
        <div className="w-full xl:w-64 flex-shrink-0">
          <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-navy-700">
              <h2 className="text-sm font-semibold text-theme-secondary">Šablony</h2>
            </div>
            <div className="divide-y divide-navy-700/50">
              {templates.map((tpl) => (
                <button
                  key={tpl.email_type}
                  onClick={() => selectTemplate(tpl)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                    selected === tpl.email_type
                      ? 'bg-navy-700 text-theme-primary'
                      : 'text-theme-muted hover:bg-navy-700/50 hover:text-theme-secondary'
                  }`}
                >
                  <span className="text-lg">{EMAIL_TYPE_ICONS[tpl.email_type] || '📧'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">
                      {EMAIL_TYPE_LABELS[tpl.email_type] || tpl.email_type}
                    </div>
                    <div className="text-[11px] text-theme-muted truncate">{tpl.email_type}</div>
                  </div>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${tpl.enabled ? 'bg-emerald-500' : 'bg-navy-600'}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Tags reference */}
          <div className="bg-navy-800 rounded-xl border border-navy-700 mt-4 overflow-hidden">
            <div className="px-4 py-3 border-b border-navy-700">
              <h2 className="text-sm font-semibold text-theme-secondary">Dynamické tagy</h2>
            </div>
            <div className="p-3 space-y-2">
              {AVAILABLE_TAGS.map((t) => (
                <div key={t.tag} className="text-[12px]">
                  <code className="bg-navy-700 text-orange-400 px-1.5 py-0.5 rounded text-[11px] font-mono">{t.tag}</code>
                  <div className="text-theme-muted mt-0.5 ml-1">{t.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center panel — edit form */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-navy-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{EMAIL_TYPE_ICONS[selected] || '📧'}</span>
                  <div>
                    <h2 className="text-sm font-semibold text-theme-primary">{EMAIL_TYPE_LABELS[selected] || selected}</h2>
                    <span className="text-[11px] text-theme-muted">{selected}</span>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-theme-muted">Aktivní</span>
                  <button
                    onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      form.enabled ? 'bg-emerald-600' : 'bg-navy-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                      form.enabled ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </label>
              </div>

              <div className="p-5 space-y-4">
                {/* Subject */}
                <div>
                  <label className="block text-xs font-medium text-theme-secondary mb-1.5">Predmet</label>
                  <input
                    type="text"
                    value={form.subject_template}
                    onChange={(e) => setForm(f => ({ ...f, subject_template: e.target.value }))}
                    className="w-full px-3 py-2 bg-navy-900 border border-navy-700 rounded-lg text-theme-primary text-sm placeholder-theme-muted focus:outline-none focus:border-navy-500"
                    placeholder="Predmet e-mailu (použijte [[tagy]])"
                  />
                  <p className="text-[11px] text-theme-muted mt-1">Muzete použít tagy jako [[order.code]]</p>
                </div>

                {/* Heading */}
                <div>
                  <label className="block text-xs font-medium text-theme-secondary mb-1.5">Nadpis</label>
                  <input
                    type="text"
                    value={form.heading}
                    onChange={(e) => setForm(f => ({ ...f, heading: e.target.value }))}
                    className="w-full px-3 py-2 bg-navy-900 border border-navy-700 rounded-lg text-theme-primary text-sm placeholder-theme-muted focus:outline-none focus:border-navy-500"
                    placeholder="Nadpis v tele e-mailu"
                  />
                </div>

                {/* Body HTML */}
                <div>
                  <label className="block text-xs font-medium text-theme-secondary mb-1.5">Obsah (HTML)</label>
                  <textarea
                    value={form.body_html}
                    onChange={(e) => setForm(f => ({ ...f, body_html: e.target.value }))}
                    rows={8}
                    className="w-full px-3 py-2 bg-navy-900 border border-navy-700 rounded-lg text-theme-primary text-sm placeholder-theme-muted focus:outline-none focus:border-navy-500 font-mono resize-y"
                    placeholder="<p>HTML obsah e-mailu...</p>"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleSaveTemplate}
                    disabled={saving}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {saving ? 'Ukládám...' : 'Uložit'}
                  </button>
                  <button
                    onClick={handleSendTest}
                    disabled={sendingTest}
                    className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {sendingTest ? 'Odesílám...' : 'Odeslat test'}
                  </button>
                  <button
                    onClick={() => loadPreview(selected)}
                    className="px-5 py-2 bg-navy-700 hover:bg-navy-600 text-theme-primary text-sm font-medium rounded-lg transition-colors"
                  >
                    Náhled
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-navy-800 rounded-xl border border-navy-700 p-12 text-center text-theme-muted">
              Vyberte šablonu ze seznamu vlevo
            </div>
          )}

          {/* Global design section (collapsible) */}
          <div className="bg-navy-800 rounded-xl border border-navy-700 mt-4 overflow-hidden">
            <button
              onClick={() => setDesignOpen(!designOpen)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-navy-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-theme-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.764m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                </svg>
                <h2 className="text-sm font-semibold text-theme-secondary">Globální design</h2>
              </div>
              <svg className={`w-4 h-4 text-theme-muted transition-transform ${designOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {designOpen && (
              <div className="px-5 pb-5 border-t border-navy-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Colors */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wide">Barvy</h3>
                    {[
                      { key: 'header_bg_color', label: 'Záhlaví pozadí', def: '#1046A0' },
                      { key: 'header_text_color', label: 'Záhlaví text', def: '#ffffff' },
                      { key: 'button_bg_color', label: 'Tlacítko pozadí', def: '#D8112A' },
                      { key: 'button_text_color', label: 'Tlacítko text', def: '#ffffff' },
                      { key: 'footer_bg_color', label: 'Zápatí pozadí', def: '#1046A0' },
                    ].map(({ key, label, def }) => (
                      <div key={key} className="flex items-center gap-3">
                        <label className="text-xs text-theme-secondary w-32">{label}</label>
                        <input
                          type="color"
                          value={design[key] || def}
                          onChange={(e) => setDesign(d => ({ ...d, [key]: e.target.value }))}
                          className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                        />
                        <input
                          type="text"
                          value={design[key] || def}
                          onChange={(e) => setDesign(d => ({ ...d, [key]: e.target.value }))}
                          className="w-24 px-2 py-1 bg-navy-900 border border-navy-700 rounded text-theme-primary text-xs font-mono"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Text fields */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wide">Texty</h3>
                    {[
                      { key: 'company_name', label: 'Název firmy' },
                      { key: 'company_subtitle', label: 'Podtitulek' },
                      { key: 'contact_email', label: 'Kontaktní e-mail' },
                      { key: 'contact_phone', label: 'Kontaktní telefon' },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="block text-xs text-theme-secondary mb-1">{label}</label>
                        <input
                          type="text"
                          value={design[key] || ''}
                          onChange={(e) => setDesign(d => ({ ...d, [key]: e.target.value }))}
                          className="w-full px-3 py-2 bg-navy-900 border border-navy-700 rounded-lg text-theme-primary text-sm focus:outline-none focus:border-navy-500"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs text-theme-secondary mb-1">Text zápatí</label>
                      <textarea
                        value={design.footer_text || ''}
                        onChange={(e) => setDesign(d => ({ ...d, footer_text: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 bg-navy-900 border border-navy-700 rounded-lg text-theme-primary text-sm focus:outline-none focus:border-navy-500 resize-y"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSaveDesign}
                    disabled={savingDesign}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {savingDesign ? 'Ukládám...' : 'Uložit design'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right panel — Preview */}
        <div className="w-full xl:w-[420px] flex-shrink-0">
          <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden sticky top-4">
            <div className="px-4 py-3 border-b border-navy-700 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-theme-secondary">Náhled</h2>
              {selected && (
                <button
                  onClick={() => loadPreview(selected)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Obnovit
                </button>
              )}
            </div>
            <div className="bg-gray-100 p-0" style={{ minHeight: 400 }}>
              {previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full border-0"
                  style={{ height: 600 }}
                  title="Email preview"
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="flex items-center justify-center h-64 text-theme-muted text-sm">
                  Vyberte šablonu pro zobrazení náhledu
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
