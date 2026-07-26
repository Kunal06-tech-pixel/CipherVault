import { z } from 'zod'

export const CRYPTO_VERSION = 2 as const

export const kdfParametersSchema = z.object({
  algorithm: z.literal('argon2id'),
  memoryKiB: z.number().int().min(19_456).max(262_144),
  iterations: z.number().int().min(2).max(10),
  parallelism: z.number().int().min(1).max(4),
  hashLength: z.literal(32),
})

export type KdfParameters = z.infer<typeof kdfParametersSchema>

export const encryptedPayloadSchema = z.object({
  cryptoVersion: z.literal(CRYPTO_VERSION),
  itemVersion: z.string().uuid(),
  nonce: z.string().min(16).max(32),
  ciphertext: z.string().min(16).max(2_000_000),
})

export const encryptedItemSchema = encryptedPayloadSchema.extend({
  id: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  deletedAt: z.string().datetime().nullable(),
})

export type EncryptedPayload = z.infer<typeof encryptedPayloadSchema>
export type EncryptedItem = z.infer<typeof encryptedItemSchema>

export const wrappedVaultKeySchema = z.object({
  cryptoVersion: z.literal(CRYPTO_VERSION),
  kdf: kdfParametersSchema,
  salt: z.string().min(20).max(64),
  nonce: z.string().min(16).max(32),
  ciphertext: z.string().min(32).max(256),
})

export type WrappedVaultKey = z.infer<typeof wrappedVaultKeySchema>

export const encryptedAttachmentSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  size: z.number().int().nonnegative().max(10 * 1024 * 1024),
  chunkCount: z.number().int().positive().max(160),
  cryptoVersion: z.literal(CRYPTO_VERSION),
})

export type EncryptedAttachment = z.infer<typeof encryptedAttachmentSchema>

export const attachmentInitiateSchema = encryptedAttachmentSchema.extend({
  ciphertextSha256: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
})

export const attachmentCompleteSchema = z.object({
  chunkSha256: z.array(z.string().regex(/^[A-Za-z0-9_-]{43}$/u)).min(1).max(160),
})

export const syncMutationSchema = z.object({
  itemId: z.string().uuid(),
  // Older API builds serialized PostgreSQL BIGINT revisions as strings.
  // Coercion keeps those cached clients compatible while the repository
  // boundary now consistently emits JSON numbers.
  baseRevision: z.coerce.number().int().nonnegative(),
  encryptedPayload: encryptedPayloadSchema.optional(),
  tombstone: z.boolean().optional(),
}).refine((value) => Boolean(value.encryptedPayload) !== Boolean(value.tombstone), {
  message: 'Provide exactly one of encryptedPayload or tombstone',
})

export type SyncMutation = z.infer<typeof syncMutationSchema>

export const preloginRequestSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.trim().toLowerCase()),
})

export const preloginResponseSchema = z.object({
  kdf: kdfParametersSchema,
  salt: z.string(),
})

export const registerRequestSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.trim().toLowerCase()),
  authKey: z.string().min(40).max(128),
  wrappedVaultKey: wrappedVaultKeySchema,
  recoveryWrappedVaultKey: z.object({
    cryptoVersion: z.literal(CRYPTO_VERSION),
    nonce: z.string(),
    ciphertext: z.string(),
  }),
})

export const loginRequestSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.trim().toLowerCase()),
  authKey: z.string().min(40).max(128),
  deviceName: z.string().trim().min(1).max(100),
})

export const mfaTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{40,128}$/u)
export const totpCodeSchema = z.string().regex(/^\d{6}$/u)
export const recoveryCodeSchema = z.string().regex(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/u)

export const mfaTotpCompleteRequestSchema = z.object({
  mfaToken: mfaTokenSchema,
  code: z.union([totpCodeSchema, recoveryCodeSchema]),
})
export const mfaWebAuthnOptionsRequestSchema = z.object({ mfaToken: mfaTokenSchema })
export const mfaWebAuthnCompleteRequestSchema = z.object({
  mfaToken: mfaTokenSchema,
  response: z.record(z.string(), z.unknown()),
})
export const totpEnrollmentStartSchema = z.object({ label: z.string().trim().min(1).max(100) })
export const totpEnrollmentConfirmSchema = z.object({
  factorId: z.string().uuid(),
  code: totpCodeSchema,
})
export const passkeyEnrollmentStartSchema = z.object({ label: z.string().trim().min(1).max(100) })
export const passkeyEnrollmentCompleteSchema = z.object({
  enrollmentToken: mfaTokenSchema,
  response: z.record(z.string(), z.unknown()),
})

const publicJwkSchema = z.record(z.string(), z.unknown()).refine((value) => value.kty === 'RSA' || value.kty === 'EC', {
  message: 'A public JWK is required',
})
export const extensionGrantRequestSchema = z.object({
  pkceChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
  devicePublicKey: z.object({ wrapKey: publicJwkSchema, signingKey: publicJwkSchema }),
  label: z.string().trim().min(1).max(100),
})
export const extensionGrantApprovalSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9_-]{40,128}$/u),
  wrappedVaultKey: z.string().regex(/^[A-Za-z0-9_-]{100,1024}$/u),
})
export const extensionTokenExchangeSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9_-]{40,128}$/u),
  verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/u),
})
export const extensionTokenRefreshSchema = z.object({
  refreshToken: z.string().regex(/^[A-Za-z0-9_-]{40,128}$/u),
  timestamp: z.number().int().positive(),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{20,128}$/u),
  signature: z.string().regex(/^[A-Za-z0-9_-]{40,256}$/u),
})

export const reauthenticateRequestSchema = z.object({
  authKey: z.string().min(40).max(128),
})

export const deleteAccountRequestSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.trim().toLowerCase()),
})

export const passwordRangeRequestSchema = z.object({
  prefix: z.string().regex(/^[A-F0-9]{5}$/u),
})

export const recoveryStartRequestSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.trim().toLowerCase()),
})

export const recoveryChallengeRequestSchema = z.object({ token: z.string().min(32).max(256) })

export const recoveryCompleteRequestSchema = z.object({
  token: z.string().min(32).max(256),
  authKey: z.string().min(40).max(128),
  wrappedVaultKey: wrappedVaultKeySchema,
  mfaCode: z.union([totpCodeSchema, recoveryCodeSchema]).optional(),
})

export const batchSyncRequestSchema = z.object({
  mutations: z.array(syncMutationSchema).min(1).max(100),
})

export const vaultItemTypeSchema = z.enum(['login', 'secureNote', 'card', 'identity', 'totp'])
export type VaultItemType = z.infer<typeof vaultItemTypeSchema>

export const vaultItemSchema = z.object({
  id: z.string().uuid(),
  type: vaultItemTypeSchema,
  name: z.string().trim().min(1).max(500),
  favorite: z.boolean(),
  tags: z.array(z.string().trim().min(1).max(100)).max(100),
  archived: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  fields: z.record(z.string(), z.unknown()),
  passwordHistory: z.array(z.object({ password: z.string(), changedAt: z.string().datetime() })).max(100).optional(),
  attachmentIds: z.array(z.string().uuid()).max(100).optional(),
  attachments: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(500),
    contentType: z.string().max(200),
    size: z.number().int().positive().max(10 * 1024 * 1024),
    nonces: z.array(z.string().min(16).max(32)).min(1).max(160),
  })).max(100).optional(),
})

export type VaultItem = z.infer<typeof vaultItemSchema>

export interface SyncPage {
  cursor: number
  hasMore: boolean
  items: EncryptedItem[]
}

export interface SessionInfo {
  id: string
  deviceName: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  current: boolean
}
