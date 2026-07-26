function decodeBase32(value: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const normalized = value.toUpperCase().replace(/[\s=-]/gu, '')
  if (!normalized || [...normalized].some((character) => !alphabet.includes(character))) {
    throw new Error('The TOTP secret is not valid Base32.')
  }
  const bytes: number[] = []
  let bits = 0
  let buffer = 0
  for (const character of normalized) {
    buffer = (buffer << 5) | alphabet.indexOf(character)
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >>> bits) & 0xff)
    }
  }
  return new Uint8Array(bytes)
}

export async function generateTotp(
  secret: string,
  timestamp = Date.now(),
  digits: 6 | 8 = 6,
  periodSeconds = 30,
): Promise<{ code: string; remainingSeconds: number }> {
  const counter = Math.floor(timestamp / 1000 / periodSeconds)
  const message = new ArrayBuffer(8)
  const view = new DataView(message)
  view.setUint32(0, Math.floor(counter / 0x1_0000_0000), false)
  view.setUint32(4, counter >>> 0, false)
  const secretBytes = decodeBase32(secret)
  const rawKey = secretBytes.buffer.slice(secretBytes.byteOffset, secretBytes.byteOffset + secretBytes.byteLength) as ArrayBuffer
  const key = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, message))
  const offset = (digest.at(-1) ?? 0) & 0x0f
  const binary = (
    ((digest[offset] ?? 0) & 0x7f) << 24 |
    ((digest[offset + 1] ?? 0) & 0xff) << 16 |
    ((digest[offset + 2] ?? 0) & 0xff) << 8 |
    ((digest[offset + 3] ?? 0) & 0xff)
  ) >>> 0
  return {
    code: String(binary % 10 ** digits).padStart(digits, '0'),
    remainingSeconds: periodSeconds - (Math.floor(timestamp / 1000) % periodSeconds),
  }
}
