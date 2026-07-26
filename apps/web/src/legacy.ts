import type { VaultItem } from '@ciphervault/contracts'
import { normalizeVaultItem } from './features/vault/vault-item-normalize'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

function buffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer
}

export interface LegacyEnvelope {
  version: 1
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}

export function hasLegacyVault(): boolean {
  return Boolean(localStorage.getItem('ciphervault.encrypted.v1'))
}

export async function unlockLegacyVault(masterPassword: string): Promise<VaultItem[]> {
  const stored = localStorage.getItem('ciphervault.encrypted.v1')
  if (!stored) return []
  const envelope = JSON.parse(stored) as LegacyEnvelope
  const material = await crypto.subtle.importKey('raw', encoder.encode(masterPassword), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: buffer(fromBase64(envelope.salt)), iterations: envelope.iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: buffer(fromBase64(envelope.iv)) }, key, buffer(fromBase64(envelope.ciphertext)),
    )
    const legacy = JSON.parse(decoder.decode(plaintext)) as { entries?: Array<Record<string, unknown>> }
    return (legacy.entries ?? []).map((entry) => normalizeVaultItem({
      id: typeof entry.id === 'string' ? entry.id : crypto.randomUUID(),
      type: 'login',
      name: String(entry.title || 'Imported login'),
      category: String(entry.category || 'Personal'),
      favorite: Boolean(entry.favorite),
      tags: [String(entry.category || 'Imported')],
      archived: false,
      createdAt: String(entry.createdAt || new Date().toISOString()),
      updatedAt: String(entry.updatedAt || new Date().toISOString()),
      fields: {
        username: String(entry.username || ''), password: String(entry.password || ''),
        url: String(entry.website || ''), notes: String(entry.notes || ''),
      },
    }))
  } catch {
    throw new Error('The legacy vault password is incorrect.')
  }
}

export function removeLegacyVault(): void {
  localStorage.removeItem('ciphervault.encrypted.v1')
}
