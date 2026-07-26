import { describe, expect, it } from 'vitest'
import { batchSyncRequestSchema, encryptedItemSchema, reauthenticateRequestSchema, registerRequestSchema, vaultItemSchema, vaultItemTypeSchema } from './index'

describe('public contracts', () => {
  it('rejects a mutation containing plaintext-shaped data', () => {
    const result = batchSyncRequestSchema.safeParse({ mutations: [{ itemId: crypto.randomUUID(), baseRevision: 0, tombstone: true, title: 'secret' }] })
    expect(result.success).toBe(false)
  })

  it('requires authenticated encryption metadata', () => {
    const result = encryptedItemSchema.safeParse({ id: crypto.randomUUID(), revision: 1, ciphertext: 'not-enough' })
    expect(result.success).toBe(false)
  })

  it('accepts every v2 vault item type with encrypted-client fields', () => {
    for (const type of vaultItemTypeSchema.options) {
      expect(vaultItemSchema.safeParse({
        id: crypto.randomUUID(),
        schemaVersion: 2,
        type,
        name: `${type} item`,
        category: 'Personal',
        favorite: false,
        tags: [],
        archived: false,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        fields: type === 'custom_secret'
          ? { customFields: [{ id: crypto.randomUUID(), label: 'Token', value: 'secret', type: 'secret', sensitive: true }] }
          : type === 'recovery_codes'
            ? { codes: [{ id: crypto.randomUUID(), value: 'ABCD-EFGH', used: false }] }
            : { value: 'encrypted-client-validated' },
      }).success).toBe(true)
    }
  })

  it('normalizes registration emails without accepting short authentication keys', () => {
    const result = registerRequestSchema.safeParse({ email: ' USER@EXAMPLE.COM ', authKey: 'weak' })
    expect(result.success).toBe(false)
  })

  it('accepts only high-entropy client-derived material for reauthentication', () => {
    expect(reauthenticateRequestSchema.safeParse({ authKey: 'short' }).success).toBe(false)
    expect(reauthenticateRequestSchema.safeParse({ authKey: 'A'.repeat(43) }).success).toBe(true)
  })
})
