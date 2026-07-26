import type { CustomField, RecoveryCodeItem, VaultItem, VaultItemType } from '@ciphervault/contracts'
import { legacyTypeAliases } from './item-types'
import { initialFieldsFor } from './vault-item-templates'

type LegacyVaultItem = Omit<Partial<VaultItem>, 'type' | 'fields'> & {
  type?: string
  fields?: Record<string, unknown>
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function categoryFor(item: LegacyVaultItem): string {
  const explicit = stringValue((item as { category?: unknown }).category).trim()
  if (explicit) return explicit
  const firstTag = Array.isArray(item.tags) ? stringValue(item.tags[0]).trim() : ''
  return firstTag || 'Personal'
}

function normalizeType(type: string | undefined): VaultItemType {
  if (type && legacyTypeAliases[type]) return legacyTypeAliases[type]!
  if (type === 'login' || type === 'payment_card' || type === 'bank_account' || type === 'secure_note' ||
    type === 'recovery_codes' || type === 'api_secret' || type === 'wifi' || type === 'identity_document' ||
    type === 'software_license' || type === 'custom_secret' || type === 'totp') return type
  return 'login'
}

function splitLegacyExpiry(value: unknown): { expiryMonth?: string; expiryYear?: string } {
  const match = stringValue(value).match(/^(\d{2})\/(\d{2,4})$/u)
  if (!match) return {}
  const year = match[2]!.length === 2 ? `20${match[2]}` : match[2]!
  return match[1] ? { expiryMonth: match[1], expiryYear: year } : { expiryYear: year }
}

function recoveryCodes(value: unknown): RecoveryCodeItem[] {
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (entry && typeof entry === 'object') {
        const record = entry as Partial<RecoveryCodeItem>
        return {
          id: typeof record.id === 'string' ? record.id : crypto.randomUUID(),
          value: stringValue(record.value),
          used: Boolean(record.used),
        }
      }
      return { id: crypto.randomUUID(), value: stringValue(entry), used: false }
    }).filter((entry) => entry.value.trim())
  }
  return stringValue(value).split(/\r?\n/u).map((entry) => entry.trim()).filter(Boolean)
    .map((value) => ({ id: crypto.randomUUID(), value, used: false }))
}

function customFields(value: unknown): CustomField[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => {
    const record = entry && typeof entry === 'object' ? entry as Partial<CustomField> : {}
    return {
      id: typeof record.id === 'string' ? record.id : crypto.randomUUID(),
      label: stringValue(record.label || 'Field'),
      value: stringValue(record.value),
      type: record.type ?? 'text',
      sensitive: Boolean(record.sensitive),
    } as CustomField
  })
}

function normalizeFields(type: VaultItemType, rawFields: Record<string, unknown>): VaultItem['fields'] {
  const fields = { ...initialFieldsFor(type), ...rawFields }
  if (type === 'login') {
    fields.username = stringValue(rawFields.username || rawFields.email)
    fields.password = stringValue(rawFields.password)
    fields.url = stringValue(rawFields.url || rawFields.website)
    fields.secureNotes = stringValue(rawFields.secureNotes || rawFields.notes)
  }
  if (type === 'payment_card') {
    const expiry = splitLegacyExpiry(rawFields.expiry)
    fields.cardholder = stringValue(rawFields.cardholder)
    fields.network = stringValue(rawFields.network || rawFields.brand || fields.network)
    fields.number = stringValue(rawFields.number)
    fields.expiryMonth = stringValue(rawFields.expiryMonth || expiry.expiryMonth || fields.expiryMonth)
    fields.expiryYear = stringValue(rawFields.expiryYear || expiry.expiryYear || fields.expiryYear)
    fields.secureNotes = stringValue(rawFields.secureNotes || rawFields.notes)
  }
  if (type === 'secure_note') {
    fields.note = stringValue(rawFields.note || rawFields.secureNotes)
  }
  if (type === 'identity_document') {
    fields.fullName = stringValue(rawFields.fullName || [rawFields.firstName, rawFields.lastName].map(stringValue).filter(Boolean).join(' '))
    fields.documentNumber = stringValue(rawFields.documentNumber)
  }
  if (type === 'recovery_codes') fields.codes = recoveryCodes(rawFields.codes)
  if (type === 'custom_secret') fields.customFields = customFields(rawFields.customFields)
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== null)) as VaultItem['fields']
}

export function normalizeVaultItem(item: LegacyVaultItem): VaultItem {
  const now = new Date().toISOString()
  const type = normalizeType(item.type)
  const fields = normalizeFields(type, item.fields ?? {})
  return {
    id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
    schemaVersion: 2,
    type,
    name: stringValue(item.name || fields.ssid || fields.provider || fields.bankName || 'Imported item').trim() || 'Imported item',
    category: categoryFor(item),
    favorite: Boolean(item.favorite),
    tags: Array.isArray(item.tags) ? item.tags.map(stringValue).map((tag) => tag.trim()).filter(Boolean).slice(0, 100) : [],
    archived: Boolean(item.archived),
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : now,
    fields,
    ...(item.passwordHistory ? { passwordHistory: item.passwordHistory } : {}),
    ...(item.attachmentIds ? { attachmentIds: item.attachmentIds } : {}),
    ...(item.attachments ? { attachments: item.attachments } : {}),
  }
}

export function normalizeVaultItems(items: Array<LegacyVaultItem | VaultItem>): VaultItem[] {
  return items.map((item) => normalizeVaultItem(item))
}
