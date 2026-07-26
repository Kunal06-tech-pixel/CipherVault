import { describe, expect, it } from 'vitest'
import { safeSubtitle, validateVaultItemInput } from './vault-item-validation'

describe('vault item validation', () => {
  it('validates payment card number, expiry, cvv, and pin locally', () => {
    const valid = {
      cardholder: 'Kunal',
      cardType: 'Credit',
      network: 'Visa',
      number: '4111 1111 1111 1111',
      expiryMonth: '12',
      expiryYear: String(new Date().getFullYear() + 2),
      cvv: '123',
      pin: '1234',
    }

    expect(validateVaultItemInput('payment_card', 'Travel card', 'Finance', valid)).toBeUndefined()
    expect(validateVaultItemInput('payment_card', 'Travel card', 'Finance', { ...valid, number: '1234' })).toBe('Enter a valid card number.')
    expect(validateVaultItemInput('payment_card', 'Travel card', 'Finance', { ...valid, cvv: '12' })).toBe('CVV must be 3 or 4 digits.')
  })

  it('validates banking, recovery code, API environment, and custom-field limits', () => {
    expect(validateVaultItemInput('bank_account', 'Salary', 'Finance', {
      bankName: 'Bank',
      accountHolder: 'Kunal',
      accountNumber: '1234567890',
      ifsc: 'HDFC0001234',
    })).toBeUndefined()
    expect(validateVaultItemInput('bank_account', 'Salary', 'Finance', {
      bankName: 'Bank',
      accountHolder: 'Kunal',
      accountNumber: '123',
    })).toBe('Account number length is invalid.')
    expect(validateVaultItemInput('recovery_codes', 'GitHub', 'Work', { codes: [] })).toBe('Add at least one recovery code.')
    expect(validateVaultItemInput('api_secret', 'API', 'Work', {
      provider: 'OpenAI',
      apiKey: 'sk-test',
      environment: 'Sandbox',
    })).toBe('Environment is invalid.')
    expect(validateVaultItemInput('custom_secret', 'Bundle', 'Personal', {
      customFields: [{ id: '1', label: 'Token', value: 'a', type: 'secret', sensitive: true }, { id: '2', label: 'Token', value: 'b', type: 'secret', sensitive: true }],
    })).toBe('Custom field labels must be unique.')
  })

  it('keeps sensitive identifiers masked in safe subtitles', () => {
    expect(safeSubtitle({
      id: 'card',
      schemaVersion: 2,
      type: 'payment_card',
      name: 'Card',
      category: 'Finance',
      tags: [],
      favorite: false,
      archived: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      fields: { number: '4111111111111111' },
    })).toBe('**** 1111')
  })
})
