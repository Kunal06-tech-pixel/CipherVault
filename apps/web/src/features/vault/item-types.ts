import {
  BadgeCheck,
  Banknote,
  CreditCard,
  FileKey,
  FileText,
  Fingerprint,
  IdCard,
  KeyRound,
  Landmark,
  NotebookText,
  QrCode,
  Wifi,
} from 'lucide-react'
import type { VaultItemType } from '@keywall/contracts'

export const typeLabels: Record<VaultItemType, string> = {
  login: 'Login Credential',
  payment_card: 'Payment Card',
  bank_account: 'Bank Account',
  secure_note: 'Secure Note',
  recovery_codes: 'Recovery Codes',
  api_secret: 'API Secret',
  wifi: 'Wi-Fi Credential',
  identity_document: 'Identity Document',
  software_license: 'Software Licence',
  custom_secret: 'Custom Secret',
  totp: 'Authenticator',
}

export const typeIcons: Record<VaultItemType, typeof KeyRound> = {
  login: KeyRound,
  payment_card: CreditCard,
  bank_account: Landmark,
  secure_note: NotebookText,
  recovery_codes: QrCode,
  api_secret: FileKey,
  wifi: Wifi,
  identity_document: IdCard,
  software_license: BadgeCheck,
  custom_secret: FileText,
  totp: Fingerprint,
}

export const selectableVaultItemTypes: VaultItemType[] = [
  'login',
  'payment_card',
  'bank_account',
  'secure_note',
  'recovery_codes',
  'api_secret',
  'wifi',
  'identity_document',
  'software_license',
  'custom_secret',
]

export const legacyTypeAliases: Partial<Record<string, VaultItemType>> = {
  secureNote: 'secure_note',
  card: 'payment_card',
  identity: 'identity_document',
}

export const dashboardTypeOrder: VaultItemType[] = [...selectableVaultItemTypes]
