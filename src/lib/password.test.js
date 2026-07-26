import { describe, expect, it } from 'vitest'
import { generatePassword, passwordScore, hostname } from './password'

describe('password utilities', () => {
  it('generates the requested length with every enabled character group', () => {
    const password = generatePassword({ length: 24 })
    expect(password).toHaveLength(24)
    expect(password).toMatch(/[a-z]/)
    expect(password).toMatch(/[A-Z]/)
    expect(password).toMatch(/\d/)
    expect(password).toMatch(/[^A-Za-z0-9]/)
  })

  it('scores longer mixed passwords above simple ones', () => {
    expect(passwordScore('correct').score).toBeLessThan(passwordScore('C0rrect-Horse-Battery-Staple!').score)
  })

  it('normalizes website hostnames', () => {
    expect(hostname('https://www.example.com/login')).toBe('example.com')
  })
})
