import { describe, expect, it } from 'vitest'
import { createEncryptedVault, decryptVault } from './crypto'

describe('encrypted vault', () => {
  const vault = {
    version: 1,
    entries: [{ id: '1', title: 'Example', password: 'not-in-plaintext-storage' }],
  }

  it('round-trips vault data with the correct master password', async () => {
    const { envelope } = await createEncryptedVault('a long and unique master password', vault)
    const result = await decryptVault(envelope, 'a long and unique master password')

    expect(result.vault).toEqual(vault)
    expect(JSON.stringify(envelope)).not.toContain('not-in-plaintext-storage')
    expect(envelope.cipher).toBe('AES-256-GCM')
  })

  it('rejects an incorrect master password', async () => {
    const { envelope } = await createEncryptedVault('correct master password', vault)
    await expect(decryptVault(envelope, 'incorrect master password')).rejects.toThrow('Incorrect master password')
  })

  it('detects ciphertext tampering', async () => {
    const { envelope } = await createEncryptedVault('correct master password', vault)
    const last = envelope.ciphertext.at(-1)
    const tampered = { ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -1)}${last === 'A' ? 'B' : 'A'}` }

    await expect(decryptVault(tampered, 'correct master password')).rejects.toThrow()
  })
})
