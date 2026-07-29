import { useMemo, useState } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import type { VaultItem, VaultItemType } from '@keywall/contracts'
import { typeLabels } from './item-types'
import { ItemTypeSelector } from './ItemTypeSelector'
import { formStateFromItem, VaultItemForm } from './VaultItemForm'
import { itemTemplates } from './vault-item-templates'

export function ItemEditor({ existing, onSave, onClose }: { existing?: VaultItem; onSave: (item: VaultItem) => void; onClose: () => void }) {
  const [type, setType] = useState<VaultItemType | null>(existing?.type ?? null)
  const initial = useMemo(() => formStateFromItem(existing, existing?.type ?? 'login'), [existing])
  const [name, setName] = useState(initial.name)
  const [category, setCategory] = useState(initial.category)
  const [tags, setTags] = useState(initial.tags)
  const [favorite, setFavorite] = useState(initial.favorite)
  const [fields, setFields] = useState<VaultItem['fields']>(initial.fields)
  const [error, setError] = useState('')
  const selectType = (nextType: VaultItemType) => {
    setType(nextType)
    const next = formStateFromItem(undefined, nextType)
    setName('')
    setCategory(next.category)
    setTags('')
    setFavorite(false)
    setFields(next.fields)
    setError('')
  }
  const template = type ? itemTemplates[type] : undefined

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal entry-modal" role="dialog" aria-modal="true" aria-labelledby="item-editor-title">
      <div className="modal-heading">
        <div>
          <p className="eyebrow">{existing ? 'Edit vault item' : type ? 'New vault item' : 'Select item type'}</p>
          <h2 id="item-editor-title">{existing ? existing.name : type ? template?.label : 'Add secure item'}</h2>
          <p className="editor-subtitle">{type ? template?.description : 'Choose the kind of encrypted information you want to store.'}</p>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button>
      </div>
      {!type && <ItemTypeSelector onSelect={selectType} />}
      {type && !existing && <button type="button" className="secondary-button back-type-button" onClick={() => setType(null)}><ArrowLeft size={15} /> Back to item types</button>}
      {type && existing?.type === 'totp' && <p className="form-notice">Authenticator items are supported for existing records. New secure items use the main vault templates.</p>}
      {type && <VaultItemForm
        type={type}
        {...(existing ? { existing } : {})}
        name={name}
        setName={setName}
        category={category}
        setCategory={setCategory}
        tags={tags}
        setTags={setTags}
        favorite={favorite}
        setFavorite={setFavorite}
        fields={fields}
        setFields={setFields}
        error={error}
        setError={setError}
        onSave={onSave}
      />}
      {type && <p className="editor-subtitle">Type: {typeLabels[type]}</p>}
    </section>
  </div>
}
