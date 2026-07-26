import { base58 } from '@scure/base'
import { argon2id } from 'hash-wasm'
import {
  CRYPTO_VERSION,
  type EncryptedItem,
  type EncryptedPayload,
  type KdfParameters,
  type VaultItem,
  type WrappedVaultKey,
} from '@ciphervault/contracts'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const DEFAULT_KDF: KdfParameters = Object.freeze({
  algorithm: 'argon2id',
  memoryKiB: 65_536,
  iterations: 3,
  parallelism: 1,
  hashLength: 32,
})

export interface MasterKeys {
  authKey: Uint8Array
  wrappingKey: CryptoKey
}

export interface RecoveryEnvelope {
  cryptoVersion: typeof CRYPTO_VERSION
  nonce: string
  ciphertext: string
}

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

export function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padding = '='.repeat((4 - normalized.length % 4) % 4)
  const binary = atob(normalized + padding)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function buffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer
}

async function hkdf(root: Uint8Array, info: string, salt = new Uint8Array(32)): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey('raw', buffer(root), 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: buffer(salt), info: buffer(encoder.encode(info)) },
    material,
    256,
  )
  return new Uint8Array(bits)
}

async function importAesKey(bytes: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', buffer(bytes), { name: 'AES-GCM', length: 256 }, false, usages)
}

export async function deriveMasterKeys(
  masterPassword: string,
  salt: Uint8Array,
  kdf: KdfParameters = DEFAULT_KDF,
): Promise<MasterKeys> {
  if (masterPassword.length < 12 || masterPassword.length > 256) {
    throw new Error('Master password must be between 12 and 256 characters.')
  }
  const root = await argon2id({
    password: masterPassword,
    salt,
    parallelism: kdf.parallelism,
    iterations: kdf.iterations,
    memorySize: kdf.memoryKiB,
    hashLength: kdf.hashLength,
    outputType: 'binary',
  })
  const rootBytes = new Uint8Array(root)
  const authKey = await hkdf(rootBytes, 'ciphervault:authentication:v2')
  const wrappingBytes = await hkdf(rootBytes, 'ciphervault:vault-key-wrapping:v2')
  rootBytes.fill(0)
  const wrappingKey = await importAesKey(wrappingBytes, ['encrypt', 'decrypt'])
  wrappingBytes.fill(0)
  return { authKey, wrappingKey }
}

export async function wrapVaultKey(
  vaultKey: Uint8Array,
  wrappingKey: CryptoKey,
  salt: Uint8Array,
  kdf: KdfParameters = DEFAULT_KDF,
): Promise<WrappedVaultKey> {
  const nonce = randomBytes(12)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: buffer(nonce), additionalData: buffer(encoder.encode('ciphervault:vault-key:v2')) },
    wrappingKey,
    buffer(vaultKey),
  )
  return {
    cryptoVersion: CRYPTO_VERSION,
    kdf,
    salt: toBase64Url(salt),
    nonce: toBase64Url(nonce),
    ciphertext: toBase64Url(new Uint8Array(ciphertext)),
  }
}

export async function unwrapVaultKey(envelope: WrappedVaultKey, wrappingKey: CryptoKey): Promise<Uint8Array> {
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: buffer(fromBase64Url(envelope.nonce)),
        additionalData: buffer(encoder.encode('ciphervault:vault-key:v2')),
      },
      wrappingKey,
      buffer(fromBase64Url(envelope.ciphertext)),
    )
    return new Uint8Array(plaintext)
  } catch {
    throw new Error('Unable to unlock the vault key.')
  }
}

async function deriveItemKey(vaultKey: Uint8Array, itemId: string): Promise<CryptoKey> {
  const itemKey = await hkdf(vaultKey, 'ciphervault:item-key:v2', encoder.encode(itemId))
  const key = await importAesKey(itemKey, ['encrypt', 'decrypt'])
  itemKey.fill(0)
  return key
}

async function deriveAttachmentKey(vaultKey: Uint8Array, attachmentId: string): Promise<CryptoKey> {
  const bytes = await hkdf(vaultKey, 'ciphervault:attachment-key:v2', encoder.encode(attachmentId))
  const key = await importAesKey(bytes, ['encrypt', 'decrypt'])
  bytes.fill(0)
  return key
}

function attachmentAad(attachmentId: string, chunkIndex: number, chunkCount: number): ArrayBuffer {
  return buffer(encoder.encode(`ciphervault:attachment:v2:${attachmentId}:${chunkIndex}:${chunkCount}`))
}

export async function encryptAttachmentChunk(
  plaintext: Uint8Array,
  vaultKey: Uint8Array,
  attachmentId: string,
  chunkIndex: number,
  chunkCount: number,
): Promise<{ nonce: string; ciphertext: Uint8Array }> {
  if (chunkIndex < 0 || chunkIndex >= chunkCount || chunkCount < 1 || chunkCount > 160) throw new Error('Invalid attachment chunk metadata.')
  const key = await deriveAttachmentKey(vaultKey, attachmentId)
  const nonce = randomBytes(12)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: buffer(nonce), additionalData: attachmentAad(attachmentId, chunkIndex, chunkCount) },
    key,
    buffer(plaintext),
  )
  return { nonce: toBase64Url(nonce), ciphertext: new Uint8Array(ciphertext) }
}

export async function decryptAttachmentChunk(
  ciphertext: Uint8Array,
  nonce: string,
  vaultKey: Uint8Array,
  attachmentId: string,
  chunkIndex: number,
  chunkCount: number,
): Promise<Uint8Array> {
  const key = await deriveAttachmentKey(vaultKey, attachmentId)
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: buffer(fromBase64Url(nonce)), additionalData: attachmentAad(attachmentId, chunkIndex, chunkCount) },
      key,
      buffer(ciphertext),
    )
    return new Uint8Array(plaintext)
  } catch {
    throw new Error('Encrypted attachment chunk authentication failed.')
  }
}

function itemAad(id: string, itemVersion: string): Uint8Array {
  return encoder.encode(`ciphervault:item:v2:${id}:${itemVersion}`)
}

export async function encryptItem(item: VaultItem, vaultKey: Uint8Array, revision = 0): Promise<EncryptedItem> {
  const itemVersion = crypto.randomUUID()
  const nonce = randomBytes(12)
  const key = await deriveItemKey(vaultKey, item.id)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: buffer(nonce), additionalData: buffer(itemAad(item.id, itemVersion)) },
    key,
    buffer(encoder.encode(JSON.stringify(item))),
  )
  return {
    id: item.id,
    revision,
    cryptoVersion: CRYPTO_VERSION,
    itemVersion,
    nonce: toBase64Url(nonce),
    ciphertext: toBase64Url(new Uint8Array(ciphertext)),
    deletedAt: null,
  }
}

export async function decryptItem(item: EncryptedItem | (EncryptedPayload & { id: string }), vaultKey: Uint8Array): Promise<VaultItem> {
  const key = await deriveItemKey(vaultKey, item.id)
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: buffer(fromBase64Url(item.nonce)),
        additionalData: buffer(itemAad(item.id, item.itemVersion)),
      },
      key,
      buffer(fromBase64Url(item.ciphertext)),
    )
    return JSON.parse(decoder.decode(plaintext)) as VaultItem
  } catch {
    throw new Error('Encrypted item authentication failed.')
  }
}

async function recoveryWrappingKey(recoveryKey: Uint8Array): Promise<CryptoKey> {
  const bytes = await hkdf(recoveryKey, 'ciphervault:recovery-wrapping:v2')
  const key = await importAesKey(bytes, ['encrypt', 'decrypt'])
  bytes.fill(0)
  return key
}

async function checksum(payload: Uint8Array): Promise<Uint8Array> {
  const first = await crypto.subtle.digest('SHA-256', buffer(payload))
  const second = await crypto.subtle.digest('SHA-256', first)
  return new Uint8Array(second).slice(0, 4)
}

export async function createRecoveryKey(): Promise<{ encoded: string; bytes: Uint8Array }> {
  const bytes = randomBytes(32)
  const payload = new Uint8Array(33)
  payload[0] = 2
  payload.set(bytes, 1)
  const check = await checksum(payload)
  const encoded = base58.encode(new Uint8Array([...payload, ...check]))
  return { encoded, bytes }
}

export async function decodeRecoveryKey(encoded: string): Promise<Uint8Array> {
  const decoded = base58.decode(encoded.trim())
  if (decoded.length !== 37 || decoded[0] !== 2) throw new Error('Invalid recovery key.')
  const payload = decoded.slice(0, 33)
  const expected = await checksum(payload)
  let difference = 0
  expected.forEach((byte, index) => { difference |= byte ^ (decoded[33 + index] ?? 0) })
  if (difference !== 0) {
    throw new Error('Invalid recovery key checksum.')
  }
  return payload.slice(1)
}

export async function recoveryWrapVaultKey(vaultKey: Uint8Array, recoveryKey: Uint8Array): Promise<RecoveryEnvelope> {
  const key = await recoveryWrappingKey(recoveryKey)
  const nonce = randomBytes(12)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: buffer(nonce), additionalData: buffer(encoder.encode('ciphervault:recovery:v2')) },
    key,
    buffer(vaultKey),
  )
  return { cryptoVersion: CRYPTO_VERSION, nonce: toBase64Url(nonce), ciphertext: toBase64Url(new Uint8Array(ciphertext)) }
}

export async function recoveryUnwrapVaultKey(envelope: RecoveryEnvelope, recoveryKey: Uint8Array): Promise<Uint8Array> {
  const key = await recoveryWrappingKey(recoveryKey)
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: buffer(fromBase64Url(envelope.nonce)), additionalData: buffer(encoder.encode('ciphervault:recovery:v2')) },
      key,
      buffer(fromBase64Url(envelope.ciphertext)),
    )
    return new Uint8Array(plaintext)
  } catch {
    throw new Error('Recovery key could not unwrap this vault.')
  }
}

export function zeroize(bytes: Uint8Array | null | undefined): void {
  bytes?.fill(0)
}
