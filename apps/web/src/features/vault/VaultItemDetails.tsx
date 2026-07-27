import type { CustomField, RecoveryCodeItem, VaultItem } from '@ciphervault/contracts'
import { Paperclip, Settings, Trash2, X } from 'lucide-react'
import { TotpCode } from '../totp/TotpCode'
import { typeIcons, typeLabels } from './item-types'
import { fieldTemplateFor } from './vault-item-templates'
import { MaskedValue } from './MaskedValue'

function labelFor(key: string): string {
  return key.replace(/([A-Z])/gu, ' $1').replace(/_/gu, ' ')
}

function maskKind(key: string) {
  if (key === 'number') return 'card' as const
  if (key.toLowerCase().includes('pin') || key === 'cvv') return 'pin' as const
  return 'generic' as const
}

export function VaultItemDetails({ item, attachmentsEnabled, onClose, onEdit, onDelete, onAttach, onDownloadAttachment, onDeleteAttachment, onRequireReauth, onCopy }: {
  item: VaultItem
  attachmentsEnabled: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onAttach: () => void
  onDownloadAttachment: (attachment: NonNullable<VaultItem['attachments']>[number]) => void
  onDeleteAttachment: (attachmentId: string) => void
  onRequireReauth: (reason: string, action: () => void) => void
  onCopy: (value: string) => void
}) {
  const Icon = typeIcons[item.type]
  const fieldRows = Object.entries(item.fields).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== null && String(value).trim() !== ''
  })
  const renderValue = (key: string, value: unknown) => {
    const template = fieldTemplateFor(item.type, key)
    if (Array.isArray(value) && key === 'customFields') {
      return <div className="nested-secret-list">{(value as CustomField[]).map((field) => <div key={field.id}><span>{field.label}</span><MaskedValue value={field.value} sensitive={field.sensitive} highRisk={field.sensitive} onRequireReauth={onRequireReauth} onCopy={onCopy} /></div>)}</div>
    }
    if (Array.isArray(value) && key === 'codes') {
      return <div className="nested-secret-list">{(value as RecoveryCodeItem[]).map((code) => <div key={code.id} className={code.used ? 'used-code' : ''}><span>{code.used ? 'Used code' : 'Recovery code'}</span><MaskedValue value={code.value} sensitive highRisk onRequireReauth={onRequireReauth} onCopy={onCopy} /></div>)}</div>
    }
    return <MaskedValue
      value={String(value)}
      sensitive={Boolean(template?.sensitive)}
      highRisk={Boolean(template?.highRisk)}
      maskKind={maskKind(key)}
      onRequireReauth={onRequireReauth}
      onCopy={onCopy}
    />
  }
  return <aside className="detail-panel production-detail">
    <div className="detail-top"><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button><div><button className="icon-button" onClick={onEdit} aria-label="Edit"><Settings size={16} /></button><button className="icon-button danger-icon" onClick={onDelete} aria-label="Delete"><Trash2 size={16} /></button></div></div>
    <div className="detail-identity"><span className="detail-avatar"><Icon size={27} /></span><h2>{item.name}</h2><p>{typeLabels[item.type]} / {item.category}</p></div>
    {item.type === 'totp' && Boolean(item.fields.secret) && <TotpCode secret={String(item.fields.secret)} />}
    <div className="detail-fields">{fieldRows.map(([key, value]) => <div className="detail-field" key={key}><span>{fieldTemplateFor(item.type, key)?.label ?? labelFor(key)}</span>{renderValue(key, value)}</div>)}</div>
    {attachmentsEnabled && <div className="attachment-list">{(item.attachments ?? []).map((attachment) => <div key={attachment.id}><button onClick={() => onDownloadAttachment(attachment)}><Paperclip size={14} /><span><b>{attachment.name}</b><small>{Math.ceil(attachment.size / 1024)} KiB</small></span></button><button className="icon-button danger-icon" aria-label={`Delete ${attachment.name}`} onClick={() => onDeleteAttachment(attachment.id)}><Trash2 size={14} /></button></div>)}<button className="secondary-button full" onClick={onAttach}><Paperclip size={14} /> Add encrypted attachment</button></div>}
    <div className="detail-footer">Created {new Date(item.createdAt).toLocaleDateString()} / Updated {new Date(item.updatedAt).toLocaleDateString()}</div>
  </aside>
}
