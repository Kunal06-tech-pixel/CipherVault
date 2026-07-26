import { describe, expect, it } from 'vitest'
import { batchSyncRequestSchema, encryptedItemSchema, reauthenticateRequestSchema, registerRequestSchema } from './index'

describe('public contracts', () => {
  it('rejects a mutation containing plaintext-shaped data', () => {
    const result = batchSyncRequestSchema.safeParse({ mutations: [{ itemId: crypto.randomUUID(), baseRevision: 0, title: 'secret' }] })
    expect(result.success).toBe(false)
  })

  it('requires authenticated encryption metadata', () => {
    const result = encryptedItemSchema.safeParse({ id: crypto.randomUUID(), revision: 1, ciphertext: 'not-enough' })
    expect(result.success).toBe(false)
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
