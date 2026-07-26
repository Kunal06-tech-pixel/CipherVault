import type { VaultItemType } from '@ciphervault/contracts'

export const initialFields: Record<VaultItemType, Record<string, string>> = {
  login: { username: '', password: '', url: '', notes: '' },
  secureNote: { note: '' },
  card: { cardholder: '', number: '', brand: '', expiry: '', cvv: '', pin: '', notes: '' },
  identity: { firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', address: '', city: '', state: '', postalCode: '', country: '' },
  totp: { secret: '', issuer: '', account: '', algorithm: 'SHA1', digits: '6', period: '30', notes: '' },
}

export function formatCardNumber(value: string | undefined) { return (value ?? '').replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim() }
export function cardDigits(value: string) { return value.replace(/\D/g, '') }
export function luhn(value: string) {
  const digits = cardDigits(value); if (digits.length < 12) return false
  let sum = 0; let alternate = false
  for (let index = digits.length - 1; index >= 0; index -= 1) { let n = Number(digits[index]); if (alternate) { n *= 2; if (n > 9) n -= 9 }; sum += n; alternate = !alternate }
  return sum % 10 === 0
}

export function validateFields(type: VaultItemType, fields: Record<string, string>) {
  if (type === 'login' && fields.url && !/^https?:\/\//i.test(fields.url)) return 'Website must start with http:// or https://.'
  if (type === 'card') {
    if (!(fields.cardholder ?? '').trim()) return 'Enter the cardholder name.'
    if (!luhn(fields.number ?? '')) return 'Enter a valid card number.'
    if (!/^\d{2}\/\d{2}$/.test(fields.expiry ?? '')) return 'Use expiry format MM/YY.'
    if (!/^\d{3,4}$/.test(fields.cvv ?? '')) return 'Enter a 3 or 4 digit security code.'
  }
  if (type === 'totp' && !/^[A-Z2-7\s-]{8,}$/.test((fields.secret ?? '').trim().toUpperCase())) return 'Enter a valid base32 authenticator secret.'
  return undefined
}

export function primaryField(type: VaultItemType, fields: Record<string, string>) {
  if (type === 'login') return fields.username || fields.url || 'Login'
  if (type === 'card') return fields.cardholder || 'Payment card'
  if (type === 'identity') return [fields.firstName, fields.lastName].filter(Boolean).join(' ') || fields.email || 'Identity'
  if (type === 'totp') return fields.account || fields.issuer || 'Authenticator'
  return 'Secure note'
}
