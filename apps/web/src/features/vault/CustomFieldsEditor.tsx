import type { CustomField, RecoveryCodeItem } from '@ciphervault/contracts'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'

const fieldTypes: CustomField['type'][] = ['text', 'secret', 'username', 'password', 'pin', 'email', 'url', 'number', 'date', 'multiline']

export function CustomFieldsEditor({ value, onChange }: { value: CustomField[]; onChange: (value: CustomField[]) => void }) {
  const update = (id: string, patch: Partial<CustomField>) => onChange(value.map((field) => field.id === id ? { ...field, ...patch } : field))
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= value.length) return
    const next = value.slice()
    const [field] = next.splice(index, 1)
    if (field) next.splice(target, 0, field)
    onChange(next)
  }
  return <div className="custom-fields-editor">
    {value.map((field, index) => <div className="custom-field-row" key={field.id}>
      <input value={field.label} onChange={(event) => update(field.id, { label: event.target.value })} placeholder="Field label" />
      <select value={field.type} onChange={(event) => update(field.id, { type: event.target.value as CustomField['type'] })}>{fieldTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select>
      {field.type === 'multiline'
        ? <textarea rows={3} value={field.value} onChange={(event) => update(field.id, { value: event.target.value })} placeholder="Field value" />
        : <input value={field.value} onChange={(event) => update(field.id, { value: event.target.value })} placeholder="Field value" />}
      <label className="favorite-toggle compact-toggle"><input type="checkbox" checked={field.sensitive} onChange={(event) => update(field.id, { sensitive: event.target.checked })} /><span className="custom-check" />Sensitive</label>
      <div className="custom-field-actions">
        <button type="button" className="icon-button subtle" onClick={() => move(index, -1)} aria-label="Move field up"><ArrowUp size={14} /></button>
        <button type="button" className="icon-button subtle" onClick={() => move(index, 1)} aria-label="Move field down"><ArrowDown size={14} /></button>
        <button type="button" className="icon-button danger-icon" onClick={() => onChange(value.filter((current) => current.id !== field.id))} aria-label="Remove field"><Trash2 size={14} /></button>
      </div>
    </div>)}
    <button type="button" className="secondary-button" onClick={() => onChange([...value, { id: crypto.randomUUID(), label: '', value: '', type: 'text', sensitive: false }])}><Plus size={15} /> Add custom field</button>
  </div>
}

export function RecoveryCodesEditor({ value, onChange }: { value: RecoveryCodeItem[]; onChange: (value: RecoveryCodeItem[]) => void }) {
  const pasteCodes = (source: string) => {
    const next = source.split(/\r?\n/u).map((code) => code.trim()).filter(Boolean)
      .map((code) => ({ id: crypto.randomUUID(), value: code, used: false }))
    if (next.length) onChange([...value, ...next])
  }
  return <div className="custom-fields-editor">
    <textarea rows={4} placeholder="Paste several recovery codes, one per line" onBlur={(event) => { pasteCodes(event.target.value); event.target.value = '' }} />
    {value.map((code) => <div className="recovery-code-row" key={code.id}>
      <input value={code.value} onChange={(event) => onChange(value.map((entry) => entry.id === code.id ? { ...entry, value: event.target.value } : entry))} />
      <label className="favorite-toggle compact-toggle"><input type="checkbox" checked={code.used} onChange={(event) => onChange(value.map((entry) => entry.id === code.id ? { ...entry, used: event.target.checked } : entry))} /><span className="custom-check" />Used</label>
      <button type="button" className="icon-button danger-icon" onClick={() => onChange(value.filter((entry) => entry.id !== code.id))} aria-label="Remove recovery code"><Trash2 size={14} /></button>
    </div>)}
    <button type="button" className="secondary-button" onClick={() => onChange([...value, { id: crypto.randomUUID(), value: '', used: false }])}><Plus size={15} /> Add code</button>
  </div>
}
