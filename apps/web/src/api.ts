import type { EncryptedItem, KdfParameters, SyncMutation, SyncPage, WrappedVaultKey } from '@keywall/contracts'
import type { RecoveryEnvelope } from '@keywall/crypto'

const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '')).replace(/\/+$/u, '')
let csrfToken = ''

export interface BrowserSession {
  csrfToken: string
  wrappedVaultKey: WrappedVaultKey
  email: string
}

export interface MfaLoginChallenge {
  mfaRequired: true
  mfaToken: string
  methods: Array<'totp' | 'webauthn'>
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code)
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(csrfToken && init.method && init.method !== 'GET' ? { 'x-cv-csrf': csrfToken } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'request_failed' })) as { error?: string }
    throw new ApiError(response.status, body.error ?? 'request_failed')
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function prelogin(email: string): Promise<{ kdf: KdfParameters; salt: string }> {
  return request('/v1/auth/prelogin', { method: 'POST', body: JSON.stringify({ email }) })
}

export async function registerAccount(input: {
  email: string
  authKey: string
  wrappedVaultKey: WrappedVaultKey
  recoveryWrappedVaultKey: RecoveryEnvelope
}): Promise<{ accepted: true; verificationRequired: boolean }> {
  return request('/v1/auth/register', { method: 'POST', body: JSON.stringify(input) })
}

export async function login(input: { email: string; authKey: string; deviceName: string }): Promise<BrowserSession | MfaLoginChallenge> {
  const result = await request<BrowserSession | MfaLoginChallenge>('/v1/auth/login', {
    method: 'POST', body: JSON.stringify(input),
  })
  if ('csrfToken' in result) csrfToken = result.csrfToken
  return result
}

function acceptBrowserSession(result: BrowserSession): BrowserSession {
  csrfToken = result.csrfToken
  return result
}

export async function completeTotpMfa(mfaToken: string, code: string): Promise<BrowserSession> {
  return acceptBrowserSession(await request('/v1/auth/mfa/totp/complete', {
    method: 'POST', body: JSON.stringify({ mfaToken, code }),
  }))
}

export async function webAuthnMfaOptions(mfaToken: string): Promise<{ options: Record<string, unknown> }> {
  return request('/v1/auth/mfa/webauthn/options', { method: 'POST', body: JSON.stringify({ mfaToken }) })
}

export async function completeWebAuthnMfa(mfaToken: string, response: unknown): Promise<BrowserSession> {
  return acceptBrowserSession(await request('/v1/auth/mfa/webauthn/complete', {
    method: 'POST', body: JSON.stringify({ mfaToken, response }),
  }))
}

export interface MfaFactorInfo {
  id: string
  kind: 'totp' | 'webauthn'
  label: string
  createdAt: string
  lastUsedAt: string | null
}

export async function listMfaFactors(): Promise<{ factors: MfaFactorInfo[] }> {
  return request('/v1/auth/mfa')
}

export async function startTotpEnrollment(label: string): Promise<{
  factorId: string; secret: string; otpauthUri: string
}> {
  return request('/v1/auth/mfa/totp/start', { method: 'POST', body: JSON.stringify({ label }) })
}

export async function confirmTotpEnrollment(factorId: string, code: string): Promise<{
  enabled: true; recoveryCodes: string[]
}> {
  return request('/v1/auth/mfa/totp/confirm', { method: 'POST', body: JSON.stringify({ factorId, code }) })
}

export async function startPasskeyEnrollment(label: string): Promise<{
  enrollmentToken: string; options: Record<string, unknown>
}> {
  return request('/v1/auth/mfa/passkey/start', { method: 'POST', body: JSON.stringify({ label }) })
}

export async function completePasskeyEnrollment(enrollmentToken: string, response: unknown): Promise<{
  enabled: true; recoveryCodes: string[]
}> {
  return request('/v1/auth/mfa/passkey/complete', {
    method: 'POST', body: JSON.stringify({ enrollmentToken, response }),
  })
}

export async function disableMfaFactor(id: string): Promise<void> {
  await request(`/v1/auth/mfa/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function createExtensionGrant(input: {
  pkceChallenge: string
  devicePublicKey: { wrapKey: JsonWebKey; signingKey: JsonWebKey }
  label: string
}): Promise<{ code: string }> {
  return request('/v1/extension/grants', { method: 'POST', body: JSON.stringify(input) })
}

export async function approveExtensionGrant(code: string, wrappedVaultKey: string): Promise<void> {
  await request('/v1/extension/grants/approve', {
    method: 'POST', body: JSON.stringify({ code, wrappedVaultKey }),
  })
}

export async function logout(): Promise<void> {
  await request('/v1/auth/logout', { method: 'POST' })
  csrfToken = ''
}

export async function reauthenticate(authKey: string): Promise<void> {
  await request('/v1/auth/reauthenticate', { method: 'POST', body: JSON.stringify({ authKey }) })
}

export async function deleteAccount(email: string): Promise<void> {
  await request('/v1/account', { method: 'DELETE', body: JSON.stringify({ email }) })
  csrfToken = ''
}

export async function initiateAttachment(input: {
  id: string; itemId: string; size: number; chunkCount: number; cryptoVersion: 2; ciphertextSha256: string
}): Promise<{ attachment: { id: string; chunkCount: number }; uploadUrls: string[] }> {
  return request('/v1/attachments/initiate', { method: 'POST', body: JSON.stringify(input) })
}

export async function completeAttachment(id: string, chunkSha256: string[]): Promise<void> {
  await request(`/v1/attachments/${encodeURIComponent(id)}/complete`, {
    method: 'POST', body: JSON.stringify({ chunkSha256 }),
  })
}

export async function attachmentDownload(id: string): Promise<{ downloadUrls: string[] }> {
  return request(`/v1/attachments/${encodeURIComponent(id)}`)
}

export async function deleteAttachment(id: string): Promise<void> {
  await request(`/v1/attachments/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function passwordRange(prefix: string): Promise<string> {
  const response = await fetch(`${API_URL}/v1/security/password-range`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', 'x-cv-csrf': csrfToken },
    body: JSON.stringify({ prefix }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'request_failed' })) as { error?: string }
    throw new ApiError(response.status, body.error ?? 'request_failed')
  }
  return response.text()
}

export async function verifyEmail(token: string): Promise<void> {
  await request('/v1/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
}

export async function fetchChanges(cursor: number): Promise<SyncPage> {
  return request(`/v1/sync?cursor=${cursor}&limit=200`)
}

export async function pushMutations(mutations: SyncMutation[]): Promise<{
  accepted: EncryptedItem[]
  conflicts: EncryptedItem[]
  cursor: number
}> {
  return request('/v1/sync', { method: 'POST', body: JSON.stringify({ mutations }) })
}

export async function listSessions(): Promise<Array<{
  id: string; deviceName: string; createdAt: string; lastSeenAt: string; expiresAt: string; current: boolean
}>> {
  return request('/v1/sessions')
}

export async function revokeSession(id: string): Promise<void> {
  await request(`/v1/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function startRecovery(email: string): Promise<void> {
  await request('/v1/auth/recovery/start', { method: 'POST', body: JSON.stringify({ email }) })
}

export async function recoveryChallenge(token: string): Promise<{ email: string; recoveryWrappedVaultKey: RecoveryEnvelope; mfaRequired: boolean; mfaMethods: Array<'totp' | 'webauthn'> }> {
  return request('/v1/auth/recovery/challenge', { method: 'POST', body: JSON.stringify({ token }) })
}

export async function completeRecovery(input: { token: string; authKey: string; wrappedVaultKey: WrappedVaultKey; mfaCode?: string }): Promise<void> {
  await request('/v1/auth/recovery/complete', { method: 'POST', body: JSON.stringify(input) })
}
