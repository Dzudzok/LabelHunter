import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../services/api'

const TRIGGER_TYPES = {
  status_change: 'Zmena stavu zasilky',
  days_no_update: 'Dny bez aktualizace',
  days_on_branch: 'Dny na pobocce',
  days_until_expiry: 'Dny do konce ulozni doby',
}

const STATUS_OPTIONS = [
  { value: 'delivered', label: 'Doruceno' },
  { value: 'in_transit', label: 'V preprave' },
  { value: 'available_for_pickup', label: 'K vyzvednuti' },
  { value: 'failed_delivery', label: 'Nedoruceno' },
  { value: 'returned_to_sender', label: 'Vraceno odesilateli' },
]

const ACTION_TYPES = [
  { value: 'add_tag', label: 'Pridat stitek' },
  { value: 'remove_tag', label: 'Odebrat stitek' },
  { value: 'send_email', label: 'Odeslat e-mail' },
  { value: 'webhook', label: 'Webhook' },
]

const EMAIL_TYPES = [
  { value: 'pickup_reminder', label: 'Pripomenuti vyzvednuti' },
  { value: 'delivery_confirmation', label: 'Potvrzeni doruceni' },
  { value: 'return_instructions', label: 'Pokyny k vraceni' },
  { value: 'custom', label: 'Vlastni sablona' },
]

function getTriggerDescription(rule) {
  const label = TRIGGER_TYPES[rule.trigger_type] || rule.trigger_type
  if (rule.trigger_type === 'status_change') {
    const st = STATUS_OPTIONS.find(s => s.value === rule.trigger_config?.status)
    return `${label}: ${st?.label || rule.trigger_config?.status || '—'}`
  }
  if (rule.trigger_type?.startsWith('days_')) {
    return `${label}: ${rule.trigger_config?.days ?? '?'} dni`
  }
  return label
}

function getActionsDescription(actions) {
  if (!actions?.length) return 'Zadne akce'
  return actions.map(a => {
    const at = ACTION_TYPES.find(t => t.value === a.type)
    return at?.label || a.type
  }).join(', ')
}

const emptyRule = () => ({
  name: '',
  trigger_type: 'status_change',
  trigger_config: { status: 'delivered' },
  conditions: {},
  actions: [{ type: 'add_tag', config: { tag_id: '' } }],
  enabled: true,
})

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-emerald-600' : 'bg-navy-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function ActionRow({ action, index, onChange, onRemove }) {
  const updateType = (type) => {
    const defaults = {
      add_tag: { tag_id: '' },
      remove_tag: { tag_id: '' },
      send_email: { email_type: 'pickup_reminder' },
      webhook: { url: '' },
    }
    onChange(index, { type, config: defaults[type] || {} })
  }

  const updateConfig = (key, value) => {
    onChange(index, { ...action, config: { ...action.config, [key]: value } })
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-navy-900/50 rounded-lg p-3">
      <select
        value={action.type}
        onChange={e => updateType(e.target.value)}
        className="bg-navy-700 text-theme-primary border border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 w-full sm:w-auto"
      >
        {ACTION_TYPES.map(at => (
          <option key={at.value} value={at.value}>{at.label}</option>
        ))}
      </select>

      {(action.type === 'add_tag' || action.type === 'remove_tag') && (
        <input
          type="text"
          placeholder="Nazev stitku"
          value={action.config?.tag_id || ''}
          onChange={e => updateConfig('tag_id', e.target.value)}
          className="bg-navy-700 text-theme-primary border border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 flex-1 w-full sm:w-auto"
        />
      )}

      {action.type === 'send_email' && (
        <select
          value={action.config?.email_type || 'pickup_reminder'}
          onChange={e => updateConfig('email_type', e.target.value)}
          className="bg-navy-700 text-theme-primary border border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 flex-1 w-full sm:w-auto"
        >
          {EMAIL_TYPES.map(et => (
            <option key={et.value} value={et.value}>{et.label}</option>
          ))}
        </select>
      )}

      {action.type === 'webhook' && (
        <input
          type="url"
          placeholder="https://example.com/webhook"
          value={action.config?.url || ''}
          onChange={e => updateConfig('url', e.target.value)}
          className="bg-navy-700 text-theme-primary border border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 flex-1 w-full sm:w-auto"
        />
      )}

      <button
        type="button"
        onClick={() => onRemove(index)}
        className="text-red-400 hover:text-red-300 text-sm px-2 py-1 shrink-0"
      >
        Odebrat
      </button>
    </div>
  )
}

function RuleForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || emptyRule())

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const handleTriggerTypeChange = (type) => {
    const config = type === 'status_change'
      ? { status: 'delivered' }
      : { days: 3 }
    setForm(prev => ({ ...prev, trigger_type: type, trigger_config: config }))
  }

  const updateAction = (index, action) => {
    setForm(prev => ({
      ...prev,
      actions: prev.actions.map((a, i) => i === index ? action : a),
    }))
  }

  const removeAction = (index) => {
    setForm(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }))
  }

  const addAction = () => {
    setForm(prev => ({
      ...prev,
      actions: [...prev.actions, { type: 'add_tag', config: { tag_id: '' } }],
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-navy-800 rounded-xl border border-navy-700 p-3 sm:p-6 space-y-4">
      <h3 className="text-lg font-semibold text-theme-primary">
        {initial ? 'Upravit pravidlo' : 'Nove pravidlo'}
      </h3>

      {/* Name */}
      <div>
        <label className="block text-sm text-theme-muted mb-1">Nazev pravidla</label>
        <input
          type="text"
          required
          value={form.name}
          onChange={e => setField('name', e.target.value)}
          placeholder="Napr. Upozorneni po 3 dnech"
          className="w-full bg-navy-700 text-theme-primary border border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Trigger type */}
      <div>
        <label className="block text-sm text-theme-muted mb-1">Typ spoustece</label>
        <select
          value={form.trigger_type}
          onChange={e => handleTriggerTypeChange(e.target.value)}
          className="w-full bg-navy-700 text-theme-primary border border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          {Object.entries(TRIGGER_TYPES).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Trigger config */}
      <div>
        <label className="block text-sm text-theme-muted mb-1">Konfigurace spoustece</label>
        {form.trigger_type === 'status_change' ? (
          <select
            value={form.trigger_config?.status || ''}
            onChange={e => setField('trigger_config', { status: e.target.value })}
            className="w-full bg-navy-700 text-theme-primary border border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              required
              value={form.trigger_config?.days || ''}
              onChange={e => setField('trigger_config', { days: parseInt(e.target.value, 10) || '' })}
              className="w-32 bg-navy-700 text-theme-primary border border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <span className="text-sm text-theme-muted">dni</span>
          </div>
        )}
      </div>

      {/* Conditions */}
      <div>
        <label className="block text-sm text-theme-muted mb-1">Podminka: kod dopravce (nepovinne)</label>
        <input
          type="text"
          value={form.conditions?.shipper_code || ''}
          onChange={e => setField('conditions', { ...form.conditions, shipper_code: e.target.value || undefined })}
          placeholder="Napr. zasilkovna, dpd, ppl"
          className="w-full bg-navy-700 text-theme-primary border border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Actions */}
      <div>
        <label className="block text-sm text-theme-muted mb-2">Akce</label>
        <div className="space-y-2">
          {form.actions.map((action, i) => (
            <ActionRow
              key={i}
              action={action}
              index={i}
              onChange={updateAction}
              onRemove={removeAction}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={addAction}
          className="mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          + Pridat akci
        </button>
      </div>

      {/* Enabled toggle */}
      <div className="flex items-center gap-3">
        <Toggle
          checked={form.enabled}
          onChange={() => setField('enabled', !form.enabled)}
        />
        <span className="text-sm text-theme-muted">{form.enabled ? 'Aktivni' : 'Neaktivni'}</span>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Ukladam...' : (initial ? 'Ulozit zmeny' : 'Vytvorit pravidlo')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-navy-700 hover:bg-navy-600 text-theme-muted text-sm rounded-lg transition-colors"
        >
          Zrusit
        </button>
      </div>
    </form>
  )
}

export default function AutomationRules() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/retino/automation/rules')
      setRules(res.data)
    } catch (err) {
      console.error('Failed to fetch automation rules:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  const handleCreate = useCallback(async (data) => {
    setSaving(true)
    try {
      await api.post('/retino/automation/rules', data)
      setShowForm(false)
      fetchRules()
    } catch (err) {
      console.error('Failed to create rule:', err)
    } finally {
      setSaving(false)
    }
  }, [fetchRules])

  const handleUpdate = useCallback(async (data) => {
    if (!editingRule) return
    setSaving(true)
    try {
      await api.patch(`/retino/automation/rules/${editingRule.id}`, data)
      setEditingRule(null)
      fetchRules()
    } catch (err) {
      console.error('Failed to update rule:', err)
    } finally {
      setSaving(false)
    }
  }, [editingRule, fetchRules])

  const handleToggle = useCallback(async (rule) => {
    try {
      await api.post(`/retino/automation/rules/${rule.id}/toggle`)
      setRules(prev => prev.map(r =>
        r.id === rule.id ? { ...r, enabled: !r.enabled } : r
      ))
    } catch (err) {
      console.error('Failed to toggle rule:', err)
    }
  }, [])

  const handleDelete = useCallback(async (id) => {
    try {
      await api.delete(`/retino/automation/rules/${id}`)
      setDeleteConfirm(null)
      setRules(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      console.error('Failed to delete rule:', err)
    }
  }, [])

  const openEdit = (rule) => {
    setShowForm(false)
    setEditingRule(rule)
  }

  const openCreate = () => {
    setEditingRule(null)
    setShowForm(true)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingRule(null)
  }

  if (loading) {
    return (
      <div className="p-3 sm:p-6">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          <span className="ml-3 text-theme-muted">Nacitam pravidla...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-theme-primary">Automatizacni pravidla</h2>
          <p className="text-sm text-theme-muted mt-1">
            Nastavte automaticke akce na zaklade stavu zasilek
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors self-start sm:self-auto"
        >
          + Nove pravidlo
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <RuleForm onSave={handleCreate} onCancel={cancelForm} saving={saving} />
      )}

      {/* Edit form */}
      {editingRule && (
        <RuleForm
          initial={editingRule}
          onSave={handleUpdate}
          onCancel={cancelForm}
          saving={saving}
        />
      )}

      {/* Rules list */}
      {rules.length === 0 && !showForm && (
        <div className="bg-navy-800 rounded-xl border border-navy-700 p-8 text-center">
          <p className="text-theme-muted">Zatim nemáte zadna automatizacni pravidla.</p>
          <button
            onClick={openCreate}
            className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Vytvorit prvni pravidlo
          </button>
        </div>
      )}

      <div className="grid gap-4">
        {rules.map(rule => (
          <div
            key={rule.id}
            className={`bg-navy-800 rounded-xl border p-3 sm:p-5 transition-colors ${
              rule.enabled
                ? 'border-emerald-700/50'
                : 'border-navy-700'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Toggle + info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Toggle
                  checked={rule.enabled}
                  onChange={() => handleToggle(rule)}
                />
                <div className="min-w-0 flex-1">
                  <h3 className={`font-semibold truncate ${
                    rule.enabled ? 'text-theme-primary' : 'text-theme-muted'
                  }`}>
                    {rule.name}
                  </h3>
                  <p className="text-sm text-theme-muted mt-0.5 truncate">
                    {getTriggerDescription(rule)}
                  </p>
                  <p className="text-xs text-theme-muted mt-0.5 truncate">
                    Akce: {getActionsDescription(rule.actions)}
                  </p>
                  {rule.conditions?.shipper_code && (
                    <p className="text-xs text-theme-muted mt-0.5">
                      Dopravce: {rule.conditions.shipper_code}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEdit(rule)}
                  className="px-3 py-1.5 text-sm bg-navy-700 hover:bg-navy-600 text-theme-muted rounded-lg transition-colors"
                >
                  Upravit
                </button>
                {deleteConfirm === rule.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                    >
                      Potvrdit
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1.5 text-sm bg-navy-700 hover:bg-navy-600 text-theme-muted rounded-lg transition-colors"
                    >
                      Ne
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(rule.id)}
                    className="px-3 py-1.5 text-sm bg-navy-700 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors"
                  >
                    Smazat
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
