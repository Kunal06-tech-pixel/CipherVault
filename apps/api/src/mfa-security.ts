import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export interface SecretEnvelope {
  version: 1
  nonce: string
  ciphertext: string
  tag: string
}

export function createTotpSecret(bytes = 20): string {
  const input = randomBytes(bytes)
  let bits = ''
  for (const value of input) bits += value.toString(2).padStart(8, '0')
  let output = ''
  for (let index = 0; index < bits.length; index += 5) {
    output += BASE32[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)]
  }
  return output
}

function decodeBase32(value: string): Buffer {
  let bits = ''
  for (const character of value.toUpperCase().replace(/=+$/u, '')) {
    const index = BASE32.indexOf(character)
    if (index < 0) throw new Error('Invalid base32 value')
    bits += index.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2))
  }
  return Buffer.from(bytes)
}

export function totpAt(secret: string, timestamp = Date.now()): string {
  const counter = Math.floor(timestamp / 30_000)
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest()
  const offset = digest[digest.length - 1]! & 0x0f
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return code.toString().padStart(6, '0')
}

export function verifyTotp(secret: string, code: string, timestamp = Date.now()): boolean {
  if (!/^\d{6}$/u.test(code)) return false
  return [-1, 0, 1].some((window) => {
    const expected = Buffer.from(totpAt(secret, timestamp + window * 30_000))
    const actual = Buffer.from(code)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  })
}

export function encryptMfaSecret(secret: string, encodedKey: string): SecretEnvelope {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(encodedKey, 'base64url'), nonce)
  cipher.setAAD(Buffer.from('ciphervault:mfa-secret:v1'))
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return {
    version: 1,
    nonce: nonce.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
  }
}

export function decryptMfaSecret(envelope: SecretEnvelope, encodedKey: string): string {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(encodedKey, 'base64url'),
    Buffer.from(envelope.nonce, 'base64url'),
  )
  decipher.setAAD(Buffer.from('ciphervault:mfa-secret:v1'))
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const value = randomBytes(8).toString('base64url').toUpperCase().replace(/[01ILO_-]/gu, 'A')
    return `${value.slice(0, 4)}-${value.slice(4, 8)}`
  })
}
