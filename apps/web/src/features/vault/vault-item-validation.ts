import type { CustomField, RecoveryCodeItem, VaultItem, VaultItemType } from '@keywall/contracts'
import { itemTemplates } from './vault-item-templates'

export const categories = ['Personal', 'Work', 'Finance', 'Other'] as const

export function textField(fields: Record<string, unknown>, key: string): string {
  const value = fields[key]
  return typeof value === 'string' ? value.trim() : ''
}

function validUrl(value: string): boolean {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function digits(value: string): string {
  return value.replace(/\D/gu, '')
}

export function formatCardNumber(value: string): string {
  return digits(value).slice(0, 19).replace(/(.{4})/gu, '$1 ').trim()
}

function luhn(value: string): boolean {
  const input = digits(value)
  if (input.length < 12 || input.length > 19) return false
  let sum = 0
  let alternate = false
  for (let index = input.length - 1; index >= 0; index -= 1) {
    let valueAtIndex = Number(input[index])
    if (alternate) {
      valueAtIndex *= 2
      if (valueAtIndex > 9) valueAtIndex -= 9
    }
    sum += valueAtIndex
    alternate = !alternate
  }
  return sum % 10 === 0
}

function customFields(value: unknown): CustomField[] {
  return Array.isArray(value) ? value as CustomField[] : []
}

function recoveryCodes(value: unknown): RecoveryCodeItem[] {
  return Array.isArray(value) ? value as RecoveryCodeItem[] : []
}

export function validateVaultItemInput(type: VaultItemType, name: string, category: string, fields: Record<string, unknown>): string | undefined {
  if (!name.trim()) return 'Give this item a descriptive name.'
  if (!category.trim()) return 'Choose a category.'

  const template = itemTemplates[type]
  for (const field of template.fields) {
    if (!field.required) continue
    const value = fields[field.key]
    if (field.kind === 'customFields' && customFields(value).length === 0) return 'Add at least one custom field.'
    if (field.kind === 'recoveryCodes' && recoveryCodes(value).length === 0) return 'Add at least one recovery code.'
    if (field.kind !== 'customFields' && field.kind !== 'recoveryCodes' && !String(value ?? '').trim()) return `${field.label} is required.`
  }

  for (const field of template.fields.filter((value) => value.kind === 'url')) {
    if (!validUrl(textField(fields, field.key))) return `${field.label} must be a valid http or https URL.`
  }

  if (type === 'payment_card') {
    if (!luhn(textField(fields, 'number'))) return 'Enter a valid card number.'
    const month = Number(textField(fields, 'expiryMonth'))
    const year = Number(textField(fields, 'expiryYear'))
    if (!month || !year || new Date(year, month, 0).getTime() < Date.now() - 86_400_000) return 'Enter a valid future card expiry.'
    const cvv = textField(fields, 'cvv')
    if (cvv && !/^\d{3,4}$/u.test(cvv)) return 'CVV must be 3 or 4 digits.'
    const pin = textField(fields, 'pin')
    if (pin && !/^\d{4,6}$/u.test(pin)) return 'PIN must be 4 to 6 digits.'
  }

  if (type === 'bank_account') {
    const accountNumber = digits(textField(fields, 'accountNumber'))
    if (accountNumber.length < 6 || accountNumber.length > 34) return 'Account number length is invalid.'
    const ifsc = textField(fields, 'ifsc')
    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/u.test(ifsc.toUpperCase())) return 'IFSC code format is invalid.'
    const transactionPin = textField(fields, 'transactionPin')
    if (transactionPin && !/^\d{4,8}$/u.test(transactionPin)) return 'Transaction PIN length is invalid.'
  }

  if (type === 'api_secret') {
    const expiry = textField(fields, 'expiryDate')
    if (expiry && Number.isNaN(Date.parse(expiry))) return 'Expiry date is invalid.'
    const environment = textField(fields, 'environment')
    if (environment && !['Development', 'Staging', 'Production'].includes(environment)) return 'Environment is invalid.'
  }

  const custom = customFields(fields.customFields)
  if (custom.length > 50) return 'Custom secrets can contain at most 50 fields.'
  const labels = new Set<string>()
  for (const field of custom) {
    const label = field.label.trim().toLowerCase()
    if (!label) return 'Custom field labels cannot be empty.'
    if (labels.has(label)) return 'Custom field labels must be unique.'
    labels.add(label)
    if (field.value.length > 10_000) return 'Custom field values are too large.'
  }

  return undefined
}

export function searchableValues(item: VaultItem): string[] {
  const values: string[] = [item.name, item.category, ...item.tags, item.type]
  for (const value of Object.values(item.fields)) {
    if (typeof value === 'string') values.push(value)
    else if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === 'object') values.push(...Object.values(entry).map(String))
      }
    } else if (value !== undefined && value !== null) values.push(String(value))
  }
  return values
}

export function safeSubtitle(item: VaultItem): string {
  const fields = item.fields
  if (item.type === 'login') return String(fields.username || fields.url || 'Login credential')
  if (item.type === 'payment_card') return `**** ${digits(String(fields.number ?? '')).slice(-4) || 'card'}`
  if (item.type === 'bank_account') return `Account **** ${digits(String(fields.accountNumber ?? '')).slice(-4) || ''}`.trim()
  if (item.type === 'secure_note') return 'Private note'
  if (item.type === 'recovery_codes') return String(fields.account || 'Recovery codes')
  if (item.type === 'api_secret') return String(fields.environment || fields.provider || 'Developer secret')
  if (item.type === 'wifi') return String(fields.ssid || 'Wi-Fi credential')
  if (item.type === 'identity_document') return String(fields.documentType || fields.country || 'Identity document')
  if (item.type === 'software_license') return String(fields.registeredEmail || 'Software licence')
  if (item.type === 'custom_secret') return 'Custom secret'
  return String(fields.account || fields.issuer || 'Authenticator')
}
