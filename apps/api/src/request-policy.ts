import { createHmac } from 'node:crypto'
import type { FastifyRequest } from 'fastify'
import type { AppConfig } from './config'

export const PUBLIC_AUTH_MUTATIONS = new Set([
  '/v1/auth/prelogin', '/v1/auth/register', '/v1/auth/verify-email', '/v1/auth/login',
  '/v1/auth/recovery/start', '/v1/auth/recovery/challenge', '/v1/auth/recovery/complete',
  '/v1/auth/mfa/totp/complete', '/v1/auth/mfa/webauthn/options', '/v1/auth/mfa/webauthn/complete',
  '/v1/extension/token', '/v1/extension/token/refresh',
])

export function clientIpHash(request: FastifyRequest, config: AppConfig): string {
  return createHmac('sha256', config.preloginSecret).update(request.ip).digest('base64url').slice(0, 16)
}

const unavailableDependencyCodes = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH',
  '53300', '57P01', '57P02', '57P03',
])

export function isDependencyUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; cause?: unknown }
  if (typeof candidate.code === 'string' && unavailableDependencyCodes.has(candidate.code)) return true
  return candidate.cause !== error && isDependencyUnavailable(candidate.cause)
}
