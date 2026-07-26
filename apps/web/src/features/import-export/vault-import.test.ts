import { describe, expect, it } from 'vitest'
import { parseVaultImport } from './vault-import'

describe('local vault import', () => {
  it('parses quoted CSV fields without uploading plaintext', () => {
    const result = parseVaultImport('vault.csv', 'type,name,username,password,tags\nlogin,"Work, admin",person@example.com,secret,"work; admin"')
    expect(result.kind).toBe('plaintext')
    if (result.kind === 'plaintext') {
      expect(result.items[0]?.name).toBe('Work, admin')
      expect(result.items[0]?.fields.password).toBe('secret')
      expect(result.items[0]?.tags).toEqual(['work', 'admin'])
    }
  })

  it('rejects unknown JSON envelopes', () => {
    expect(() => parseVaultImport('vault.json', '{"items":[]}')).toThrow('Unsupported')
  })
})
