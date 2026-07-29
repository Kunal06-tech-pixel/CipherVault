import { encryptedItemSchema, vaultItemSchema, type EncryptedItem, type VaultItem, type VaultItemType } from '@keywall/contracts'
import { normalizeVaultItem } from '../vault/vault-item-normalize'

export type VaultImport =
  | { kind: 'plaintext'; items: VaultItem[] }
  | { kind: 'encrypted'; items: EncryptedItem[] }

function csvRows(source: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted && character === '"' && source[index + 1] === '"') {
      field += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ',' && !quoted) {
      row.push(field.trim())
      field = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(field.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }
  if (quoted) throw new Error('The CSV file contains an unterminated quoted field.')
  row.push(field.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function csvType(value: string): VaultItemType {
  const normalized = value.toLowerCase().replace(/[\s_-]/gu, '')
  if (normalized === 'login' || normalized === 'password') return 'login'
  if (normalized === 'securenote' || normalized === 'note') return 'secure_note'
  if (normalized === 'card' || normalized === 'paymentcard') return 'payment_card'
  if (normalized === 'bankaccount' || normalized === 'bank') return 'bank_account'
  if (normalized === 'recoverycodes') return 'recovery_codes'
  if (normalized === 'apisecret' || normalized === 'apikey' || normalized === 'developersecret') return 'api_secret'
  if (normalized === 'wifi' || normalized === 'wificredential') return 'wifi'
  if (normalized === 'identity' || normalized === 'identitydocument') return 'identity_document'
  if (normalized === 'softwarelicense' || normalized === 'softwarelicence' || normalized === 'license' || normalized === 'licence') return 'software_license'
  if (normalized === 'customsecret' || normalized === 'custom') return 'custom_secret'
  if (normalized === 'totp' || normalized === 'authenticator') return 'totp'
  throw new Error(`Unsupported vault item type: ${value}`)
}

function parseCsv(source: string): VaultItem[] {
  const [headerRow, ...dataRows] = csvRows(source.replace(/^\uFEFF/u, ''))
  if (!headerRow) throw new Error('The CSV file is empty.')
  const headers = headerRow.map((header) => header.trim().toLowerCase())
  if (!headers.includes('name')) throw new Error('The CSV file requires a name column.')
  const now = new Date().toISOString()
  return dataRows.map((values, rowIndex) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
    const name = record.name?.trim() ?? ''
    if (!name) throw new Error(`CSV row ${rowIndex + 2} is missing a name.`)
    const excluded = new Set(['name', 'type', 'favorite', 'tags', 'archived'])
    const fields = Object.fromEntries(Object.entries(record).filter(([key, value]) => !excluded.has(key) && value !== ''))
    return vaultItemSchema.parse(normalizeVaultItem({
      id: crypto.randomUUID(),
      type: csvType(record.type || 'login'),
      name,
      category: record.category || 'Personal',
      favorite: /^(1|true|yes)$/iu.test(record.favorite ?? ''),
      tags: (record.tags ?? '').split(/[;,]/u).map((tag) => tag.trim()).filter(Boolean),
      archived: /^(1|true|yes)$/iu.test(record.archived ?? ''),
      createdAt: now,
      updatedAt: now,
      fields,
    }))
  })
}

export function parseVaultImport(filename: string, source: string): VaultImport {
  if (filename.toLowerCase().endsWith('.csv')) return { kind: 'plaintext', items: parseCsv(source) }
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    throw new Error('The selected JSON file is not valid.')
  }
  const envelope = parsed as { format?: unknown; items?: unknown }
  if (!Array.isArray(envelope.items)) throw new Error('The import file does not contain an items array.')
  if (envelope.format === 'keywall-encrypted-items') {
    return { kind: 'encrypted', items: envelope.items.map((item) => encryptedItemSchema.parse(item)) }
  }
  if (envelope.format === 'keywall-plaintext') {
    const now = new Date().toISOString()
    return {
      kind: 'plaintext',
      items: envelope.items.map((item) => vaultItemSchema.parse(normalizeVaultItem({
        ...(item as object),
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      }))),
    }
  }
  throw new Error('Unsupported Keywall import format.')
}
