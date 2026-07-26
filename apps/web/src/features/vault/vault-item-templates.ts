import type { VaultItem, VaultItemType } from '@ciphervault/contracts'
import { selectableVaultItemTypes, typeIcons, typeLabels } from './item-types'

export type FieldKind = 'text' | 'secret' | 'textarea' | 'url' | 'email' | 'date' | 'month' | 'select' | 'checkbox' | 'recoveryCodes' | 'customFields'

export interface FieldTemplate {
  key: string
  label: string
  kind: FieldKind
  required?: boolean
  sensitive?: boolean
  highRisk?: boolean
  copyable?: boolean
  placeholder?: string
  options?: string[]
  fullWidth?: boolean
}

export interface VaultItemTemplate {
  type: VaultItemType
  label: string
  description: string
  titleLabel: string
  titlePlaceholder: string
  icon: typeof typeIcons.login
  fields: FieldTemplate[]
}

const commonFields: FieldTemplate[] = [
  { key: 'secureNotes', label: 'Secure notes', kind: 'textarea', fullWidth: true },
]

export const itemTemplates: Record<VaultItemType, VaultItemTemplate> = {
  login: {
    type: 'login',
    label: typeLabels.login,
    description: 'Website or application username and password.',
    titleLabel: 'Item name',
    titlePlaceholder: 'e.g. GitHub',
    icon: typeIcons.login,
    fields: [
      { key: 'username', label: 'Username or email', kind: 'text', required: true, copyable: true },
      { key: 'password', label: 'Password', kind: 'secret', required: true, sensitive: true, copyable: true },
      { key: 'url', label: 'Website URL', kind: 'url', placeholder: 'https://example.com' },
      { key: 'application', label: 'Application name', kind: 'text' },
      ...commonFields,
    ],
  },
  payment_card: {
    type: 'payment_card',
    label: typeLabels.payment_card,
    description: 'Card details, issuing bank, and masked PIN/CVV values.',
    titleLabel: 'Card label',
    titlePlaceholder: 'e.g. SBI Debit Card',
    icon: typeIcons.payment_card,
    fields: [
      { key: 'cardholder', label: 'Cardholder name', kind: 'text', required: true },
      { key: 'cardType', label: 'Card type', kind: 'select', required: true, options: ['Credit', 'Debit', 'Prepaid'] },
      { key: 'network', label: 'Card network', kind: 'select', required: true, options: ['Visa', 'Mastercard', 'RuPay', 'Amex', 'Other'] },
      { key: 'number', label: 'Card number', kind: 'secret', required: true, sensitive: true, highRisk: true, copyable: true },
      { key: 'expiryMonth', label: 'Expiry month', kind: 'select', required: true, options: Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')) },
      { key: 'expiryYear', label: 'Expiry year', kind: 'select', required: true, options: Array.from({ length: 16 }, (_, index) => String(new Date().getFullYear() + index)) },
      { key: 'cvv', label: 'CVV', kind: 'secret', sensitive: true, highRisk: true, copyable: true },
      { key: 'pin', label: 'ATM or card PIN', kind: 'secret', sensitive: true, highRisk: true, copyable: true },
      { key: 'issuingBank', label: 'Issuing bank', kind: 'text' },
      { key: 'billingAddress', label: 'Billing address', kind: 'textarea', fullWidth: true },
      { key: 'customerCare', label: 'Customer-care number', kind: 'text' },
      ...commonFields,
    ],
  },
  bank_account: {
    type: 'bank_account',
    label: typeLabels.bank_account,
    description: 'Account identifiers, branch information, and banking credentials.',
    titleLabel: 'Account label',
    titlePlaceholder: 'e.g. HDFC Salary Account',
    icon: typeIcons.bank_account,
    fields: [
      { key: 'bankName', label: 'Bank name', kind: 'text', required: true },
      { key: 'accountHolder', label: 'Account holder name', kind: 'text', required: true },
      { key: 'accountNumber', label: 'Account number', kind: 'secret', required: true, sensitive: true, highRisk: true, copyable: true },
      { key: 'accountType', label: 'Account type', kind: 'text' },
      { key: 'branchName', label: 'Branch name', kind: 'text' },
      { key: 'ifsc', label: 'IFSC code', kind: 'text' },
      { key: 'swift', label: 'SWIFT or BIC code', kind: 'text' },
      { key: 'upiId', label: 'UPI ID', kind: 'text', copyable: true },
      { key: 'netBankingUsername', label: 'Net-banking username', kind: 'text', copyable: true },
      { key: 'transactionPin', label: 'Transaction PIN', kind: 'secret', sensitive: true, highRisk: true, copyable: true },
      { key: 'customerId', label: 'Customer ID', kind: 'text' },
      ...commonFields,
    ],
  },
  secure_note: {
    type: 'secure_note',
    label: typeLabels.secure_note,
    description: 'Private multiline text with no unsafe HTML rendering.',
    titleLabel: 'Note title',
    titlePlaceholder: 'e.g. Server recovery instructions',
    icon: typeIcons.secure_note,
    fields: [{ key: 'note', label: 'Private content', kind: 'textarea', required: true, fullWidth: true }],
  },
  recovery_codes: {
    type: 'recovery_codes',
    label: typeLabels.recovery_codes,
    description: 'Backup codes that can be copied individually and marked used.',
    titleLabel: 'Service name',
    titlePlaceholder: 'e.g. Google Account',
    icon: typeIcons.recovery_codes,
    fields: [
      { key: 'account', label: 'Account email or username', kind: 'text' },
      { key: 'codes', label: 'Recovery-code list', kind: 'recoveryCodes', required: true, sensitive: true, highRisk: true, fullWidth: true },
      { key: 'recoveryUrl', label: 'Recovery URL', kind: 'url' },
      { key: 'dateGenerated', label: 'Date generated', kind: 'date' },
      ...commonFields,
    ],
  },
  api_secret: {
    type: 'api_secret',
    label: typeLabels.api_secret,
    description: 'Developer keys, tokens, and environment-specific secrets.',
    titleLabel: 'Secret name',
    titlePlaceholder: 'e.g. Groq Production API',
    icon: typeIcons.api_secret,
    fields: [
      { key: 'provider', label: 'Service or provider', kind: 'text', required: true },
      { key: 'apiKey', label: 'API key', kind: 'secret', required: true, sensitive: true, copyable: true },
      { key: 'apiSecret', label: 'API secret', kind: 'secret', sensitive: true, highRisk: true, copyable: true },
      { key: 'accessToken', label: 'Access token', kind: 'secret', sensitive: true, highRisk: true, copyable: true },
      { key: 'environment', label: 'Environment', kind: 'select', required: true, options: ['Development', 'Staging', 'Production'] },
      { key: 'endpointUrl', label: 'Endpoint URL', kind: 'url' },
      { key: 'expiryDate', label: 'Expiry date', kind: 'date' },
      ...commonFields,
    ],
  },
  wifi: {
    type: 'wifi',
    label: typeLabels.wifi,
    description: 'Network credentials and optional router admin details.',
    titleLabel: 'Network name or SSID',
    titlePlaceholder: 'e.g. Home Fiber 5G',
    icon: typeIcons.wifi,
    fields: [
      { key: 'ssid', label: 'Network name or SSID', kind: 'text', required: true },
      { key: 'password', label: 'Wi-Fi password', kind: 'secret', required: true, sensitive: true, copyable: true },
      { key: 'securityType', label: 'Security type', kind: 'select', options: ['WPA3', 'WPA2', 'WPA', 'WEP', 'Open', 'Other'] },
      { key: 'routerUrl', label: 'Router admin URL', kind: 'url' },
      { key: 'routerUsername', label: 'Router username', kind: 'text', copyable: true },
      { key: 'routerPassword', label: 'Router password', kind: 'secret', sensitive: true, highRisk: true, copyable: true },
      ...commonFields,
    ],
  },
  identity_document: {
    type: 'identity_document',
    label: typeLabels.identity_document,
    description: 'Identity document details without image upload.',
    titleLabel: 'Document label',
    titlePlaceholder: 'e.g. Passport',
    icon: typeIcons.identity_document,
    fields: [
      { key: 'documentType', label: 'Document type', kind: 'text', required: true },
      { key: 'fullName', label: 'Full name', kind: 'text', required: true },
      { key: 'documentNumber', label: 'Document number', kind: 'secret', required: true, sensitive: true, copyable: true },
      { key: 'issuingAuthority', label: 'Issuing authority', kind: 'text' },
      { key: 'issueDate', label: 'Issue date', kind: 'date' },
      { key: 'expiryDate', label: 'Expiry date', kind: 'date' },
      { key: 'country', label: 'Country', kind: 'text' },
      ...commonFields,
    ],
  },
  software_license: {
    type: 'software_license',
    label: typeLabels.software_license,
    description: 'Licence keys, registration details, and download links.',
    titleLabel: 'Software name',
    titlePlaceholder: 'e.g. JetBrains Toolbox',
    icon: typeIcons.software_license,
    fields: [
      { key: 'licenseKey', label: 'Licence key', kind: 'secret', required: true, sensitive: true, copyable: true },
      { key: 'registeredEmail', label: 'Registered email', kind: 'email' },
      { key: 'registeredName', label: 'Registered name', kind: 'text' },
      { key: 'purchaseDate', label: 'Purchase date', kind: 'date' },
      { key: 'expiryDate', label: 'Expiry date', kind: 'date' },
      { key: 'downloadUrl', label: 'Download URL', kind: 'url' },
      ...commonFields,
    ],
  },
  custom_secret: {
    type: 'custom_secret',
    label: typeLabels.custom_secret,
    description: 'Build a secure item from custom labeled fields.',
    titleLabel: 'Item title',
    titlePlaceholder: 'e.g. Private deployment bundle',
    icon: typeIcons.custom_secret,
    fields: [
      { key: 'customFields', label: 'Custom fields', kind: 'customFields', required: true, fullWidth: true },
      ...commonFields,
    ],
  },
  totp: {
    type: 'totp',
    label: typeLabels.totp,
    description: 'Existing authenticator records remain supported.',
    titleLabel: 'Authenticator label',
    titlePlaceholder: 'e.g. GitHub TOTP',
    icon: typeIcons.totp,
    fields: [
      { key: 'issuer', label: 'Issuer', kind: 'text' },
      { key: 'account', label: 'Account', kind: 'text' },
      { key: 'secret', label: 'Secret key', kind: 'secret', required: true, sensitive: true, copyable: true },
      { key: 'digits', label: 'Digits', kind: 'select', options: ['6', '8'] },
      { key: 'algorithm', label: 'Algorithm', kind: 'select', options: ['SHA1', 'SHA256', 'SHA512'] },
      ...commonFields,
    ],
  },
}

export const selectableTemplates = selectableVaultItemTypes.map((type) => itemTemplates[type])

export function initialFieldsFor(type: VaultItemType): VaultItem['fields'] {
  const fields: VaultItem['fields'] = {}
  for (const field of itemTemplates[type].fields) {
    if (field.kind === 'checkbox') fields[field.key] = false
    else if (field.kind === 'customFields' || field.kind === 'recoveryCodes') fields[field.key] = []
    else if (field.kind === 'select') fields[field.key] = field.options?.[0] ?? ''
    else fields[field.key] = ''
  }
  return fields
}

export function fieldTemplateFor(type: VaultItemType, key: string): FieldTemplate | undefined {
  return itemTemplates[type].fields.find((field) => field.key === key)
}
