import { describe, expect, it } from 'vitest'
import { allowedWebOrigins, isAllowedMutationOrigin, isAllowedWebOrigin } from './origins'

describe('web origin policy', () => {
  it('accepts both loopback spellings during local development', () => {
    const origins = allowedWebOrigins({ nodeEnv: 'development', publicOrigin: 'http://localhost:5173' })
    expect(origins).toEqual(expect.arrayContaining([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]))
    expect(isAllowedWebOrigin('http://127.0.0.1:5173', origins)).toBe(true)
  })

  it('keeps the configured production origin exact', () => {
    const origins = allowedWebOrigins({ nodeEnv: 'production', publicOrigin: 'https://vault.example.com' })
    expect(origins).toEqual(['https://vault.example.com'])
    expect(isAllowedWebOrigin('https://admin.example.com', origins)).toBe(false)
  })

  it('allows configured HTTPS deployment host suffixes without allowing lookalikes', () => {
    const origins = allowedWebOrigins({ nodeEnv: 'production', publicOrigin: 'https://keywall.kun6lgit.workers.dev' })
    const suffixes = ['-keywall.kun6lgit.workers.dev']

    expect(isAllowedWebOrigin('https://6a241aa9-keywall.kun6lgit.workers.dev', origins, suffixes)).toBe(true)
    expect(isAllowedMutationOrigin('https://6a241aa9-keywall.kun6lgit.workers.dev', origins, suffixes)).toBe(true)
    expect(isAllowedWebOrigin('http://6a241aa9-keywall.kun6lgit.workers.dev', origins, suffixes)).toBe(false)
    expect(isAllowedWebOrigin('https://keywall.kun6lgit.workers.dev.attacker.example', origins, suffixes)).toBe(false)
    expect(isAllowedWebOrigin('https://6a241aa9-keywall.evil.workers.dev', origins, suffixes)).toBe(false)
  })

  it('rejects malformed origins', () => {
    expect(isAllowedWebOrigin('not-an-origin', ['https://vault.example.com'])).toBe(false)
  })

  it('checks the origin on every browser mutation while allowing non-browser clients', () => {
    const allowed = ['https://vault.example.com']
    expect(isAllowedMutationOrigin(undefined, allowed)).toBe(true)
    expect(isAllowedMutationOrigin('https://vault.example.com', allowed)).toBe(true)
    expect(isAllowedMutationOrigin('https://attacker.example', allowed)).toBe(false)
    expect(isAllowedMutationOrigin('null', allowed)).toBe(false)
  })
})
