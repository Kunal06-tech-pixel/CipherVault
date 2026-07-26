import { describe, expect, it } from 'vitest'
import { constantTimeEqual, fakePreloginSalt, hashAuthKey, opaqueToken, sha256, verifyAuthKey } from './security'

describe('API security primitives', () => {
  it('hashes authentication material and rejects a different key', async () => {
    const pepper = 'a-distinct-test-pepper-that-is-long-enough'
    const verifier = await hashAuthKey('client-derived-high-entropy-authentication-key', pepper)
    await expect(verifyAuthKey(verifier, 'client-derived-high-entropy-authentication-key', pepper)).resolves.toBe(true)
    await expect(verifyAuthKey(verifier, 'wrong-authentication-key', pepper)).resolves.toBe(false)
    expect(verifier).not.toContain('client-derived')
  })

  it('uses stable opaque fake salts to resist prelogin enumeration', () => {
    const secret = 'prelogin-test-secret-at-least-32-characters'
    expect(fakePreloginSalt(secret, 'a@example.com')).toBe(fakePreloginSalt(secret, 'a@example.com'))
    expect(fakePreloginSalt(secret, 'a@example.com')).not.toBe(fakePreloginSalt(secret, 'b@example.com'))
  })

  it('creates high-entropy tokens and constant-time-comparable hashes', () => {
    const token = opaqueToken()
    expect(token.length).toBeGreaterThanOrEqual(40)
    expect(constantTimeEqual(sha256(token), sha256(token))).toBe(true)
    expect(constantTimeEqual(sha256(token), sha256(`${token}x`))).toBe(false)
  })
})
