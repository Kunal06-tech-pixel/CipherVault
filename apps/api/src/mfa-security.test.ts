import { describe, expect, it } from 'vitest'
import { decryptMfaSecret, encryptMfaSecret, totpAt, verifyTotp } from './mfa-security'

describe('MFA security primitives', () => {
  it('matches the RFC 6238 SHA-1 vector truncated to six digits', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
    expect(totpAt(secret, 59_000)).toBe('287082')
    expect(verifyTotp(secret, '287082', 59_000)).toBe(true)
    expect(verifyTotp(secret, '287083', 59_000)).toBe(false)
  })

  it('encrypts secrets with authenticated encryption and rejects tampering', () => {
    const key = Buffer.alloc(32, 4).toString('base64url')
    const envelope = encryptMfaSecret('TOPSECRET', key)
    const tamperedCiphertext = `${envelope.ciphertext.slice(0, -1)}${envelope.ciphertext.endsWith('A') ? 'B' : 'A'}`
    expect(decryptMfaSecret(envelope, key)).toBe('TOPSECRET')
    expect(() => decryptMfaSecret({ ...envelope, ciphertext: tamperedCiphertext }, key)).toThrow()
  })
})
