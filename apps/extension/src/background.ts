import type { EncryptedItem, SyncPage, VaultItem } from '@ciphervault/contracts'
import { decryptItem, fromBase64Url, randomBytes, toBase64Url, zeroize } from '@ciphervault/crypto'
import type { ExtensionMessage, ExtensionStatus } from './messages'
import { deviceIdentity } from './device-identity'

const API_URL = 'http://localhost:8080'
const WEB_URLS = new Set(['http://localhost:8080', 'http://localhost:5173', 'https://vault.example.com'])
const IDLE_SECONDS = 300
let items: VaultItem[] = []
let vaultKey: Uint8Array | null = null
let accessToken = ''
let accessExpiresAt = 0
let lastActivity = Date.now()

function status(): ExtensionStatus {
  return { unlocked: Boolean(vaultKey), itemCount: items.length, lastActivity }
}
function hostname(value: string): string {
  try { return new URL(value).hostname.replace(/^www\./u, '') } catch { return '' }
}
function bytes(value: string): ArrayBuffer { return Uint8Array.from(new TextEncoder().encode(value)).buffer }

async function pkceChallenge(verifier: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(verifier))))
}

async function refreshAccessToken(): Promise<string> {
  const stored = await chrome.storage.local.get(['refreshToken']) as { refreshToken?: string }
  if (!stored.refreshToken) throw new Error('Extension is not paired')
  const timestamp = Date.now()
  const nonce = toBase64Url(randomBytes(24))
  const proof = `${stored.refreshToken}.${timestamp}.${nonce}`
  const { signingPrivateKey } = await deviceIdentity()
  const signature = toBase64Url(new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, signingPrivateKey, bytes(proof),
  )))
  const response = await fetch(`${API_URL}/v1/extension/token/refresh`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: stored.refreshToken, timestamp, nonce, signature }),
  })
  if (!response.ok) throw new Error('Extension credential refresh failed')
  const result = await response.json() as { accessToken: string; expiresIn: number }
  accessToken = result.accessToken; accessExpiresAt = Date.now() + result.expiresIn * 1000
  await chrome.storage.session.set({ accessToken, accessExpiresAt })
  return accessToken
}

async function validAccessToken(): Promise<string> {
  if (accessToken && accessExpiresAt > Date.now() + 10_000) return accessToken
  const stored = await chrome.storage.session.get(['accessToken', 'accessExpiresAt']) as {
    accessToken?: string; accessExpiresAt?: number
  }
  if (stored.accessToken && (stored.accessExpiresAt ?? 0) > Date.now() + 10_000) {
    accessToken = stored.accessToken; accessExpiresAt = stored.accessExpiresAt ?? 0; return accessToken
  }
  return refreshAccessToken()
}

async function synchronize(): Promise<void> {
  if (!vaultKey) throw new Error('Extension is locked')
  let cursor = 0
  let hasMore = true
  const encrypted = new Map<string, EncryptedItem>()
  while (hasMore) {
    const token = await validAccessToken()
    const response = await fetch(`${API_URL}/v1/extension/sync?cursor=${cursor}&limit=200`, {
      headers: { authorization: `Bearer ${token}` },
    })
    if (response.status === 401) { accessToken = ''; continue }
    if (!response.ok) throw new Error('Encrypted extension sync failed')
    const page = await response.json() as SyncPage
    for (const item of page.items) encrypted.set(item.id, item)
    cursor = page.cursor; hasMore = page.hasMore
  }
  const live = [...encrypted.values()].filter((item) => !item.deletedAt)
  items = (await Promise.all(live.map((item) => decryptItem(item, vaultKey!)))).filter((item) => item.type === 'login')
  lastActivity = Date.now()
}

async function restore(): Promise<void> {
  const stored = await chrome.storage.local.get(['wrappedVaultKey', 'locked']) as {
    wrappedVaultKey?: string; locked?: boolean
  }
  if (!stored.wrappedVaultKey || stored.locked !== false) return
  const { wrapPrivateKey } = await deviceIdentity()
  zeroize(vaultKey)
  vaultKey = new Uint8Array(await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' }, wrapPrivateKey, Uint8Array.from(fromBase64Url(stored.wrappedVaultKey)).buffer,
  ))
  await synchronize()
}

async function pairingRequest() {
  const verifier = toBase64Url(randomBytes(48))
  const identity = await deviceIdentity()
  await chrome.storage.session.set({ pairingVerifier: verifier })
  return {
    pkceChallenge: await pkceChallenge(verifier),
    devicePublicKey: identity.publicKeys,
    label: `${navigator.platform || 'Browser'} extension`,
  }
}

async function completePairing(code: string): Promise<{ paired: boolean }> {
  const stored = await chrome.storage.session.get(['pairingVerifier']) as { pairingVerifier?: string }
  if (!stored.pairingVerifier) throw new Error('Pairing request expired')
  const response = await fetch(`${API_URL}/v1/extension/token`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, verifier: stored.pairingVerifier }),
  })
  if (!response.ok) throw new Error('Pairing exchange failed')
  const result = await response.json() as {
    accessToken: string; expiresIn: number; refreshToken: string; wrappedVaultKey: string
  }
  await chrome.storage.local.set({
    refreshToken: result.refreshToken,
    wrappedVaultKey: result.wrappedVaultKey,
    locked: false,
  })
  await chrome.storage.session.remove('pairingVerifier')
  accessToken = result.accessToken; accessExpiresAt = Date.now() + result.expiresIn * 1000
  const { wrapPrivateKey } = await deviceIdentity()
  zeroize(vaultKey)
  vaultKey = new Uint8Array(await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' }, wrapPrivateKey, Uint8Array.from(fromBase64Url(result.wrappedVaultKey)).buffer,
  ))
  await synchronize()
  return { paired: true }
}

async function lock(): Promise<void> {
  zeroize(vaultKey); vaultKey = null; items = []; accessToken = ''; accessExpiresAt = 0
  await chrome.storage.session.clear()
  await chrome.storage.local.set({ locked: true })
}

chrome.runtime.onInstalled.addListener(() => chrome.idle.setDetectionInterval(IDLE_SECONDS))
chrome.runtime.onStartup.addListener(() => { void restore().catch(() => lock()) })
chrome.idle.onStateChanged.addListener((state) => { if (state !== 'active') void lock() })

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, respond) => {
  lastActivity = Date.now()
  if (message.type === 'status') {
    if (!vaultKey) void restore().then(() => respond(status())).catch(() => respond(status()))
    else respond(status())
    return true
  }
  if (message.type === 'lock') { void lock().then(() => respond(status())); return true }
  if (message.type === 'items-for-url') {
    const target = hostname(message.url)
    respond(items.filter((item) => {
      const domain = hostname(String(item.fields.url ?? ''))
      return domain && (target === domain || target.endsWith(`.${domain}`))
    }))
    return
  }
  if (message.type === 'login-candidate') {
    void chrome.storage.session.set({ pendingLogin: { ...message, capturedAt: Date.now() } })
    void chrome.action.setBadgeText({ text: '1', tabId: sender.tab?.id })
  }
})

chrome.runtime.onMessageExternal.addListener((message: ExtensionMessage, sender, respond) => {
  let origin = ''
  try { origin = new URL(sender.url ?? '').origin } catch { return }
  if (!WEB_URLS.has(origin)) return
  if (message.type === 'pairing-request') {
    void pairingRequest().then(respond).catch(() => respond(null)); return true
  }
  if (message.type === 'pairing-approved') {
    void completePairing(message.code).then(respond).catch(() => respond({ paired: false })); return true
  }
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-ciphervault') await chrome.action.openPopup()
})
