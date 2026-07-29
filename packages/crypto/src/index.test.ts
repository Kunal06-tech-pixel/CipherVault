import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { VaultItem } from '@keywall/contracts'
import {
  createRecoveryKey,
  decryptAttachmentChunk,
  decodeRecoveryKey,
  decryptItem,
  deriveMasterKeys,
  encryptItem,
  encryptAttachmentChunk,
  fromBase64Url,
  randomBytes,
  recoveryUnwrapVaultKey,
  recoveryWrapVaultKey,
  unwrapVaultKey,
  wrapVaultKey,
} from './index'

const testKdf = { algorithm: 'argon2id' as const, memoryKiB: 19_456, iterations: 2, parallelism: 1, hashLength: 32 as const }

describe('Keywall v2 cryptography', () => {
  it('derives independent authentication and wrapping material', async () => {
    const salt = randomBytes(16)
    const keys = await deriveMasterKeys('correct horse battery staple', salt, testKdf)
    expect(keys.authKey).toHaveLength(32)
    expect(keys.wrappingKey.extractable).toBe(false)
  })

  it('wraps a random vault key and encrypts individual items', async () => {
    const salt = randomBytes(16)
    const vaultKey = randomBytes(32)
    const { wrappingKey } = await deriveMasterKeys('correct horse battery staple', salt, testKdf)
    const wrapped = await wrapVaultKey(vaultKey, wrappingKey, salt, testKdf)
    const unwrapped = await unwrapVaultKey(wrapped, wrappingKey)
    expect(unwrapped).toEqual(vaultKey)

    const item: VaultItem = {
      id: randomUUID(), schemaVersion: 2, type: 'login', name: 'Private service', category: 'Personal', favorite: false, tags: [], archived: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), fields: { password: 'never-store-me' },
    }
    const encrypted = await encryptItem(item, vaultKey)
    expect(JSON.stringify(encrypted)).not.toContain('never-store-me')
    await expect(decryptItem(encrypted, vaultKey)).resolves.toEqual(item)
  })

  it('rejects item tampering', async () => {
    const vaultKey = randomBytes(32)
    const item: VaultItem = {
      id: randomUUID(), schemaVersion: 2, type: 'secure_note', name: 'Note', category: 'Personal', favorite: false, tags: [], archived: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), fields: { note: 'classified' },
    }
    const encrypted = await encryptItem(item, vaultKey)
    const bytes = fromBase64Url(encrypted.ciphertext)
    bytes[0] = (bytes[0] ?? 0) ^ 1
    const tampered = { ...encrypted, ciphertext: Buffer.from(bytes).toString('base64url') }
    await expect(decryptItem(tampered, vaultKey)).rejects.toThrow('authentication failed')
  })

  it('creates checksum-protected recovery material', async () => {
    const vaultKey = randomBytes(32)
    const recovery = await createRecoveryKey()
    const decoded = await decodeRecoveryKey(recovery.encoded)
    expect(decoded).toEqual(recovery.bytes)
    const envelope = await recoveryWrapVaultKey(vaultKey, decoded)
    await expect(recoveryUnwrapVaultKey(envelope, decoded)).resolves.toEqual(vaultKey)
  })

  it('encrypts attachment chunks with position-bound authenticated data', async () => {
    const vaultKey = randomBytes(32)
    const attachmentId = randomUUID()
    const plaintext = new TextEncoder().encode('private attachment bytes')
    const encrypted = await encryptAttachmentChunk(plaintext, vaultKey, attachmentId, 0, 1)
    await expect(decryptAttachmentChunk(encrypted.ciphertext, encrypted.nonce, vaultKey, attachmentId, 0, 1)).resolves.toEqual(plaintext)
    await expect(decryptAttachmentChunk(encrypted.ciphertext, encrypted.nonce, vaultKey, attachmentId, 0, 2)).rejects.toThrow('authentication failed')
  })
})
