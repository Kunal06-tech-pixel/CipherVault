import { describe, expect, it } from 'vitest'
import { normalizeVaultItem } from './vault-item-normalize'

describe('vault item normalization', () => {
  it('maps legacy secure notes, cards, and identity records to v2 types', () => {
    expect(normalizeVaultItem({ type: 'secureNote', name: 'Note', fields: { note: 'private' } }).type).toBe('secure_note')
    expect(normalizeVaultItem({ type: 'card', name: 'Card', fields: { number: '4111111111111111' } }).type).toBe('payment_card')
    expect(normalizeVaultItem({ type: 'identity', name: 'Passport', fields: { documentNumber: 'A123' } }).type).toBe('identity_document')
  })

  it('preserves existing totp records and defaults category from legacy tags', () => {
    const item = normalizeVaultItem({
      id: 'totp-1',
      type: 'totp',
      name: 'GitHub',
      tags: ['Work', 'mfa'],
      fields: { secret: 'BASE32SECRET', issuer: 'GitHub' },
    })

    expect(item).toMatchObject({
      id: 'totp-1',
      schemaVersion: 2,
      type: 'totp',
      category: 'Work',
      tags: ['Work', 'mfa'],
    })
  })

  it('normalizes legacy card expiry and fills missing timestamps', () => {
    const item = normalizeVaultItem({ type: 'card', name: 'Travel', fields: { expiry: '09/30' } })
    expect(item.fields).toMatchObject({ expiryMonth: '09', expiryYear: '2030' })
    expect(Date.parse(item.createdAt)).not.toBeNaN()
    expect(Date.parse(item.updatedAt)).not.toBeNaN()
  })
})
