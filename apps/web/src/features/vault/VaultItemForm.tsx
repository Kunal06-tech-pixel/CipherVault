import type { FormEvent } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import type { VaultItem, VaultItemType } from '@ciphervault/contracts'
import { categories, validateVaultItemInput } from './vault-item-validation'
import { DynamicFieldRenderer } from './DynamicFieldRenderer'
import { initialFieldsFor, itemTemplates } from './vault-item-templates'

function tagsToString(tags: string[]): string {
  return tags.join(', ')
}

export function VaultItemForm({ type, existing, name, setName, category, setCategory, tags, setTags, favorite, setFavorite, fields, setFields, error, setError, onSave }: {
  type: VaultItemType
  existing?: VaultItem | undefined
  name: string
  setName: (value: string) => void
  category: string
  setCategory: (value: string) => void
  tags: string
  setTags: (value: string) => void
  favorite: boolean
  setFavorite: (value: boolean) => void
  fields: VaultItem['fields']
  setFields: (value: VaultItem['fields']) => void
  error: string
  setError: (value: string) => void
  onSave: (item: VaultItem) => void
}) {
  const template = itemTemplates[type]
  const updateField = (key: string, value: unknown) => setFields({ ...fields, [key]: value } as VaultItem['fields'])
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const validation = validateVaultItemInput(type, name, category, fields)
    if (validation) return setError(validation)
    const now = new Date().toISOString()
    onSave({
      id: existing?.id ?? crypto.randomUUID(),
      schemaVersion: 2,
      type,
      name: name.trim(),
      category,
      favorite,
      tags: tags.split(',').map((value) => value.trim()).filter(Boolean),
      archived: existing?.archived ?? false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      fields: { ...initialFieldsFor(type), ...fields } as VaultItem['fields'],
      ...(existing?.attachmentIds ? { attachmentIds: existing.attachmentIds } : {}),
      ...(existing?.attachments ? { attachments: existing.attachments } : {}),
    })
  }

  return <form onSubmit={submit}>
    <div className="editor-type-row">
      <label><span className="field-label">{template.titleLabel}<em>Required</em></span><input value={name} onChange={(event) => setName(event.target.value)} placeholder={template.titlePlaceholder} required autoFocus /></label>
      <label><span className="field-label">Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
    </div>
    <div className="editor-section"><h3>{template.label} details</h3><div className="editor-grid">
      {template.fields.map((field) => <DynamicFieldRenderer key={field.key} field={field} value={fields[field.key]} onChange={(value) => updateField(field.key, value)} />)}
    </div></div>
    <div className="editor-section"><h3>Organisation</h3><div className="editor-grid">
      <label><span className="field-label">Tags</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="work, finance (comma separated)" /></label>
      <label className="favorite-toggle"><input type="checkbox" checked={favorite} onChange={(event) => setFavorite(event.target.checked)} /><span className="custom-check"><Check size={13} /></span>Add to favourites</label>
    </div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions"><button className="primary-button"><ShieldCheck size={16} /> Encrypt and save</button></div>
  </form>
}

export function formStateFromItem(item: VaultItem | undefined, type: VaultItemType) {
  return {
    name: item?.name ?? '',
    category: item?.category ?? 'Personal',
    tags: tagsToString(item?.tags ?? []),
    favorite: item?.favorite ?? false,
    fields: { ...initialFieldsFor(type), ...(item?.fields ?? {}) },
  }
}
