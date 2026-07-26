import type { EncryptedItem, KdfParameters, WrappedVaultKey } from '@ciphervault/contracts'

export interface StoredUser {
  id: string
  email: string
  emailVerifiedAt: Date | null
  authVerifierHash: string
  kdf: KdfParameters
  kdfSalt: string
  wrappedVaultKey: WrappedVaultKey
  recoveryWrappedVaultKey: { cryptoVersion: 2; nonce: string; ciphertext: string }
}

export interface StoredSession {
  id: string
  userId: string
  csrfHash: string
  deviceName: string
  createdAt: Date
  lastSeenAt: Date
  expiresAt: Date
  reauthenticatedAt: Date | null
}

export interface CreateUserInput {
  email: string
  authVerifierHash: string
  wrappedVaultKey: WrappedVaultKey
  recoveryWrappedVaultKey: { cryptoVersion: 2; nonce: string; ciphertext: string }
}

export interface SyncResult {
  accepted: EncryptedItem[]
  conflicts: EncryptedItem[]
  cursor: number
}

export interface StoredAttachment {
  id: string
  userId: string
  itemId: string
  size: number
  chunkCount: number
  cryptoVersion: number
  ciphertextSha256: string
  status: 'pending' | 'complete' | 'deleted'
}

export interface StoredMfaFactor {
  id: string
  userId: string
  kind: 'totp' | 'webauthn'
  label: string
  credential: Record<string, unknown>
  createdAt: Date
  lastUsedAt: Date | null
  verifiedAt: Date | null
}

export interface StoredMfaChallenge {
  id: string
  userId: string
  purpose: 'login' | 'webauthn_registration'
  challenge: string | null
  deviceName: string | null
  factorId: string | null
  label: string | null
  attempts: number
  expiresAt: Date
}
