import type { CustomField, RecoveryCodeItem } from '@keywall/contracts'
import type { FieldTemplate } from './vault-item-templates'
import { formatCardNumber } from './vault-item-validation'
import { SecretInput } from './SecretInput'
import { CustomFieldsEditor, RecoveryCodesEditor } from './CustomFieldsEditor'

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

export function DynamicFieldRenderer({ field, value, onChange }: {
  field: FieldTemplate
  value: unknown
  onChange: (value: unknown) => void
}) {
  const label = <span className="field-label">{field.label}{field.required && <em>Required</em>}</span>
  if (field.kind === 'textarea') {
    return <label className={field.fullWidth ? 'form-span' : ''}>{label}<textarea rows={5} value={stringValue(value)} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} required={field.required} /></label>
  }
  if (field.kind === 'secret') {
    return <label className={field.fullWidth ? 'form-span' : ''}>{label}<SecretInput value={stringValue(value)} onChange={onChange as (value: string) => void} placeholder={field.placeholder} required={field.required} /></label>
  }
  if (field.kind === 'select') {
    return <label className={field.fullWidth ? 'form-span' : ''}>{label}<select value={stringValue(value)} onChange={(event) => onChange(event.target.value)} required={field.required}>{(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
  }
  if (field.kind === 'checkbox') {
    return <label className="favorite-toggle"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span className="custom-check" />{field.label}</label>
  }
  if (field.kind === 'customFields') {
    return <div className="form-span form-field-group">{label}<CustomFieldsEditor value={Array.isArray(value) ? value as CustomField[] : []} onChange={onChange as (value: CustomField[]) => void} /></div>
  }
  if (field.kind === 'recoveryCodes') {
    return <div className="form-span form-field-group">{label}<RecoveryCodesEditor value={Array.isArray(value) ? value as RecoveryCodeItem[] : []} onChange={onChange as (value: RecoveryCodeItem[]) => void} /></div>
  }
  const inputValue = field.key === 'number' ? formatCardNumber(stringValue(value)) : stringValue(value)
  return <label className={field.fullWidth ? 'form-span' : ''}>{label}<input
    type={field.kind === 'email' || field.kind === 'url' || field.kind === 'date' || field.kind === 'month' ? field.kind : 'text'}
    inputMode={field.key.toLowerCase().includes('pin') || field.key.toLowerCase().includes('number') ? 'numeric' : undefined}
    value={inputValue}
    onChange={(event) => onChange(field.key === 'number' ? event.target.value.replace(/\D/gu, '') : event.target.value)}
    placeholder={field.placeholder}
    required={field.required}
  /></label>
}
