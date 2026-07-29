import type { VaultItem } from '@keywall/contracts'

export type ExtensionMessage =
  | { type: 'status' }
  | { type: 'items-for-url'; url: string }
  | { type: 'fill'; item: VaultItem }
  | { type: 'lock' }
  | { type: 'login-candidate'; url: string; username: string; password: string }
  | { type: 'pairing-request' }
  | { type: 'pairing-approved'; code: string }

export interface ExtensionStatus {
  unlocked: boolean
  itemCount: number
  lastActivity: number
}
