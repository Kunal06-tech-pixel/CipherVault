import { CreditCard, FileText, Fingerprint, IdCard, KeyRound } from 'lucide-react'
import type { VaultItemType } from '@ciphervault/contracts'

export const typeLabels: Record<VaultItemType, string> = {
  login: 'Login',
  secureNote: 'Secure note',
  card: 'Payment card',
  identity: 'Identity',
  totp: 'Authenticator',
}

export const typeIcons: Record<VaultItemType, typeof KeyRound> = {
  login: KeyRound,
  secureNote: FileText,
  card: CreditCard,
  identity: IdCard,
  totp: Fingerprint,
}
