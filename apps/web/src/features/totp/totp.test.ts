import { describe, expect, it } from 'vitest'
import { generateTotp } from './totp'

describe('TOTP generation', () => {
  it('matches the RFC 6238 SHA-1 test vector', async () => {
    const result = await generateTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000, 8)
    expect(result.code).toBe('94287082')
    expect(result.remainingSeconds).toBe(1)
  })

  it('rejects malformed secrets', async () => {
    await expect(generateTotp('not/a/base32/secret')).rejects.toThrow('Base32')
  })
})
