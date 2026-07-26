import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'

const origin = process.env.CV_ORIGIN ?? 'http://localhost:8080'
const mailpit = process.env.CV_MAILPIT ?? 'http://localhost:8025'
const email = `compose-smoke-${Date.now()}@example.invalid`
const authKey = randomBytes(32).toString('base64url')
let cookie = ''
let csrf = ''

function base64url(bytes) { return Buffer.from(bytes).toString('base64url') }
function digest(bytes) { return base64url(createHash('sha256').update(bytes).digest()) }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

async function request(path, { method = 'GET', body, authenticated = false } = {}) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      origin,
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(authenticated ? { 'x-cv-csrf': csrf } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const setCookie = response.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';', 1)[0]
  const contentType = response.headers.get('content-type') ?? ''
  const payload = response.status === 204 ? null : contentType.includes('json') ? await response.json() : await response.text()
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(payload)}`)
  return payload
}

async function verificationToken() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const listing = await fetch(`${mailpit}/api/v1/messages`).then((response) => response.json())
    const summary = listing.messages.find((message) => message.To.some((recipient) => recipient.Address === email))
    if (summary) {
      const message = await fetch(`${mailpit}/api/v1/message/${summary.ID}`).then((response) => response.json())
      const match = message.Text.match(/[?&]token=([A-Za-z0-9_-]+)/u)
      if (match) return match[1]
    }
    await sleep(500)
  }
  throw new Error('Verification email was not delivered to Mailpit')
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function decodeBase32(value) {
  let bits = ''
  for (const character of value) bits += BASE32.indexOf(character).toString(2).padStart(5, '0')
  const bytes = []
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2))
  return Buffer.from(bytes)
}
function totp(secret) {
  const counter = Math.floor(Date.now() / 30_000)
  const message = Buffer.alloc(8); message.writeBigUInt64BE(BigInt(counter))
  const hash = createHmac('sha1', decodeBase32(secret)).update(message).digest()
  const offset = hash.at(-1) & 15
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0')
}

const wrappedVaultKey = {
  cryptoVersion: 2,
  kdf: { algorithm: 'argon2id', memoryKiB: 65_536, iterations: 3, parallelism: 1, hashLength: 32 },
  salt: base64url(randomBytes(16)),
  nonce: base64url(randomBytes(12)),
  ciphertext: base64url(randomBytes(48)),
}

await request('/v1/auth/register', { method: 'POST', body: {
  email,
  authKey,
  wrappedVaultKey,
  recoveryWrappedVaultKey: { cryptoVersion: 2, nonce: base64url(randomBytes(12)), ciphertext: base64url(randomBytes(48)) },
} })
await request('/v1/auth/verify-email', { method: 'POST', body: { token: await verificationToken() } })
let session = await request('/v1/auth/login', { method: 'POST', body: { email, authKey, deviceName: 'Compose smoke test' } })
csrf = session.csrfToken

const itemId = randomUUID()
const itemVersion = randomUUID()
const sync = await request('/v1/sync', { method: 'POST', authenticated: true, body: { mutations: [{
  itemId,
  baseRevision: 0,
  encryptedPayload: { cryptoVersion: 2, itemVersion, nonce: base64url(randomBytes(12)), ciphertext: base64url(randomBytes(96)) },
}] } })
if (sync.accepted.length !== 1 || sync.conflicts.length) throw new Error('Encrypted sync mutation was not accepted')

const attachmentId = randomUUID()
const chunk = randomBytes(32)
const chunkHash = digest(chunk)
const initiated = await request('/v1/attachments/initiate', { method: 'POST', authenticated: true, body: {
  id: attachmentId, itemId, size: chunk.length, chunkCount: 1, cryptoVersion: 2, ciphertextSha256: chunkHash,
} })
const upload = await fetch(initiated.uploadUrls[0], {
  method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: chunk,
})
if (!upload.ok) throw new Error(`Signed attachment upload failed: ${upload.status}`)
await request(`/v1/attachments/${attachmentId}/complete`, {
  method: 'POST', authenticated: true, body: { chunkSha256: [chunkHash] },
})
const download = await request(`/v1/attachments/${attachmentId}`, { authenticated: true })
const downloaded = Buffer.from(await fetch(download.downloadUrls[0]).then((response) => response.arrayBuffer()))
if (!downloaded.equals(chunk)) throw new Error('Encrypted attachment round-trip changed bytes')
await request(`/v1/attachments/${attachmentId}`, { method: 'DELETE', authenticated: true })

const enrollment = await request('/v1/auth/mfa/totp/start', {
  method: 'POST', authenticated: true, body: { label: 'Compose authenticator' },
})
const confirmation = await request('/v1/auth/mfa/totp/confirm', {
  method: 'POST', authenticated: true, body: { factorId: enrollment.factorId, code: totp(enrollment.secret) },
})
if (confirmation.recoveryCodes.length !== 10) throw new Error('MFA recovery codes were not generated')
await request('/v1/auth/logout', { method: 'POST', authenticated: true })
cookie = ''; csrf = ''
const challenge = await request('/v1/auth/login', {
  method: 'POST', body: { email, authKey, deviceName: 'Compose MFA login' },
})
if (!challenge.mfaRequired) throw new Error('MFA was not enforced during login')
session = await request('/v1/auth/mfa/totp/complete', {
  method: 'POST', body: { mfaToken: challenge.mfaToken, code: totp(enrollment.secret) },
})
csrf = session.csrfToken
await request('/v1/auth/reauthenticate', { method: 'POST', authenticated: true, body: { authKey } })
await request('/v1/account', { method: 'DELETE', authenticated: true, body: { email } })

console.log(JSON.stringify({
  ok: true,
  verified: true,
  sync: true,
  attachmentRoundTrip: true,
  mfaEnforced: true,
  accountDeletionScheduled: true,
}))
