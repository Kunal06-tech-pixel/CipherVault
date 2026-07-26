import { describe, expect, it } from 'vitest'
import { generatePassword } from './generator'

describe('extension password generator', () => {
  it('includes every enabled character class', () => {
    const password = generatePassword(30)
    expect(password).toHaveLength(30)
    expect(password).toMatch(/[a-z]/u)
    expect(password).toMatch(/[A-Z]/u)
    expect(password).toMatch(/\d/u)
    expect(password).toMatch(/[^A-Za-z0-9]/u)
  })
})
