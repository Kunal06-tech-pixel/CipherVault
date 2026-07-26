const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const STORAGE_KEY = 'ciphervault.encrypted.v1'
export const KDF_ITERATIONS = 310_000

function bytesToBase64(bytes) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function base64ToBytes(value) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export function randomBase64(length) {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(length)))
}

export async function deriveKey(masterPassword, saltBase64, iterations = KDF_ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(saltBase64),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptVault(vault, key, salt, iterations = KDF_ITERATIONS) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(vault)),
  )

  return {
    version: 1,
    cipher: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA-256',
    iterations,
    salt,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    updatedAt: new Date().toISOString(),
  }
}

export async function decryptVault(envelope, masterPassword) {
  if (!envelope || envelope.version !== 1 || !envelope.salt || !envelope.iv || !envelope.ciphertext) {
    throw new Error('This vault file is invalid or unsupported.')
  }

  const key = await deriveKey(masterPassword, envelope.salt, envelope.iterations)
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) },
      key,
      base64ToBytes(envelope.ciphertext),
    )
    return { key, vault: JSON.parse(decoder.decode(plaintext)) }
  } catch {
    throw new Error('Incorrect master password or damaged vault.')
  }
}

export async function createEncryptedVault(masterPassword, vault) {
  const salt = randomBase64(16)
  const key = await deriveKey(masterPassword, salt)
  const envelope = await encryptVault(vault, key, salt)
  return { key, envelope }
}

export function saveEnvelope(envelope) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
}

export function loadEnvelope() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}
