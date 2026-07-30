import { describe, expect, it, vi } from 'vitest'
import type { WrappedVaultKey } from '@keywall/contracts'
import { buildApp, type ApiDependencies } from './app'
import type { AppConfig } from './config'
import { hashAuthKey, sha256 } from './security'

const config: AppConfig = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 3001,
  publicOrigin: 'https://vault.example.com',
  publicOriginHostSuffixes: [],
  databaseUrl: 'postgres://unused',
  authPepper: 'test-auth-pepper-that-is-at-least-32-characters',
  preloginSecret: 'test-prelogin-secret-at-least-32-characters',
  mfaEncryptionKey: Buffer.alloc(32, 9).toString('base64url'),
  cookieSecure: true,
  allowUnverifiedLogin: false,
  attachmentsEnabled: false,
  smtpHost: 'unused',
  smtpPort: 1025,
  smtpFrom: 'security@example.com',
  emailDelivery: 'direct',
  s3Endpoint: 'https://objects.example.com',
  s3PublicEndpoint: 'https://objects.example.com',
  s3Region: 'test',
  s3Bucket: 'test',
  s3AccessKey: 'test',
  s3SecretKey: 'test-secret',
}

const wrappedVaultKey: WrappedVaultKey = {
  cryptoVersion: 2,
  kdf: { algorithm: 'argon2id', memoryKiB: 65_536, iterations: 3, parallelism: 1, hashLength: 32 },
  salt: 'A'.repeat(22),
  nonce: 'B'.repeat(16),
  ciphertext: 'C'.repeat(43),
}

function testDependencies(
  createUser: ApiDependencies['database']['createUser'],
  databaseOverrides: Partial<ApiDependencies['database']> = {},
): ApiDependencies {
  return {
    database: {
      close: vi.fn(async () => undefined),
      findSession: vi.fn(async () => null),
      findUserByEmail: vi.fn(async () => null),
      createUser,
      ...databaseOverrides,
    } as unknown as ApiDependencies['database'],
    email: {
      sendVerification: vi.fn(async () => undefined),
      sendRecovery: vi.fn(async () => undefined),
      diagnostics: vi.fn(async () => ({ mode: 'direct' as const, waiting: 0, failed: 0 })),
    },
    attachments: {} as ApiDependencies['attachments'],
  }
}

describe('API request security', () => {
  it('sets cross-site compatible secure session cookies for separate frontend and API origins', async () => {
    const authKey = 'correct-client-derived-authentication-key-material'
    const verifier = await hashAuthKey(authKey, config.authPepper)
    const createSession = vi.fn(async () => ({
      id: '10000000-0000-4000-8000-000000000001',
      userId: '20000000-0000-4000-8000-000000000002',
      csrfHash: 'unused',
      deviceName: 'Test browser',
      createdAt: new Date(),
      lastSeenAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      reauthenticatedAt: null,
    }))
    const dependencies = testDependencies(vi.fn(async () => null), {
      findUserByEmail: vi.fn(async () => ({
        id: '20000000-0000-4000-8000-000000000002',
        email: 'person@example.com',
        emailVerifiedAt: null,
        authVerifierHash: verifier,
        kdf: wrappedVaultKey.kdf,
        kdfSalt: wrappedVaultKey.salt,
        wrappedVaultKey,
        recoveryWrappedVaultKey: { cryptoVersion: 2 as const, nonce: 'D'.repeat(16), ciphertext: 'E'.repeat(43) },
      })),
      listMfaFactors: vi.fn(async () => []),
      createSession,
      writeSecurityEvent: vi.fn(async () => undefined),
    })
    const app = await buildApp({ ...config, allowUnverifiedLogin: true }, dependencies)
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        headers: { origin: config.publicOrigin },
        payload: { email: 'person@example.com', authKey, deviceName: 'Test browser' },
      })
      expect(response.statusCode).toBe(200)
      expect(response.headers['set-cookie']).toEqual(expect.stringContaining('SameSite=None'))
      expect(response.headers['set-cookie']).toEqual(expect.stringContaining('Secure'))
      expect(createSession).toHaveBeenCalledOnce()
    } finally {
      await app.close()
    }
  })

  it('allows configured Cloudflare Workers deployment host suffixes in CORS preflight', async () => {
    const dependencies = testDependencies(vi.fn(async () => null))
    const app = await buildApp({
      ...config,
      publicOrigin: 'https://keywall.kun6lgit.workers.dev',
      publicOriginHostSuffixes: ['-keywall.kun6lgit.workers.dev'],
    }, dependencies)
    try {
      const origin = 'https://6a241aa9-keywall.kun6lgit.workers.dev'
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/v1/auth/prelogin',
        headers: {
          origin,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        },
      })

      expect(response.statusCode).toBe(204)
      expect(response.headers['access-control-allow-origin']).toBe(origin)
    } finally {
      await app.close()
    }
  })

  it('reports ready without object storage when attachments are disabled', async () => {
    const ping = vi.fn(async () => undefined)
    const diagnostics = vi.fn(async () => ({ mode: 'disabled' as const, waiting: 0, failed: 0 }))
    const app = await buildApp({
      ...config,
      allowUnverifiedLogin: true,
      emailDelivery: 'disabled',
      attachmentsEnabled: false,
    }, {
      database: {
        close: vi.fn(async () => undefined),
        ping,
        findSession: vi.fn(async () => null),
      } as unknown as ApiDependencies['database'],
      email: {
        sendVerification: vi.fn(async () => undefined),
        sendRecovery: vi.fn(async () => undefined),
        diagnostics,
      },
      attachments: undefined,
    })
    try {
      const response = await app.inject({ method: 'GET', url: '/health/diagnostics' })
      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({
        status: 'ready',
        database: 'ok',
        objectStorage: 'disabled',
        queue: { mode: 'disabled', waiting: 0, failed: 0 },
      })
      expect(ping).toHaveBeenCalledOnce()
      expect(diagnostics).toHaveBeenCalledOnce()
    } finally {
      await app.close()
    }
  })

  it('rejects a hostile Origin on public authentication mutations', async () => {
    const dependencies = testDependencies(vi.fn(async () => null))
    const app = await buildApp(config, dependencies)
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/prelogin',
        headers: { origin: 'https://attacker.example' },
        payload: { email: 'person@example.com' },
      })
      expect(response.statusCode).toBe(403)
      expect(response.json()).toEqual({ error: 'origin_rejected' })
      expect(dependencies.database.findUserByEmail).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('returns an indistinguishable accepted response for an existing registration', async () => {
    const createUser = vi.fn(async () => null)
    const dependencies = testDependencies(createUser)
    const app = await buildApp(config, dependencies)
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        headers: { origin: config.publicOrigin },
        payload: {
          email: 'existing@example.com',
          authKey: 'A'.repeat(43),
          wrappedVaultKey,
          recoveryWrappedVaultKey: { cryptoVersion: 2, nonce: 'D'.repeat(16), ciphertext: 'E'.repeat(43) },
        },
      })
      expect(response.statusCode).toBe(202)
      expect(response.json()).toEqual({ accepted: true, verificationRequired: true })
      expect(createUser).toHaveBeenCalledOnce()
      expect(dependencies.email.sendVerification).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('requires the current authentication key before recording recent reauthentication', async () => {
    const authKey = 'correct-client-derived-authentication-key-material'
    const sessionToken = 'session-token'
    const csrfToken = 'csrf-token'
    const verifier = await hashAuthKey(authKey, config.authPepper)
    const markSessionReauthenticated = vi.fn(async () => undefined)
    const writeSecurityEvent = vi.fn(async () => undefined)
    const dependencies = testDependencies(vi.fn(async () => null), {
      findSession: vi.fn(async (tokenHash) => tokenHash === sha256(sessionToken) ? {
        id: '10000000-0000-4000-8000-000000000001',
        userId: '20000000-0000-4000-8000-000000000002',
        csrfHash: sha256(csrfToken),
        deviceName: 'Test browser',
        createdAt: new Date(),
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        reauthenticatedAt: null,
      } : null),
      findUserById: vi.fn(async () => ({
        id: '20000000-0000-4000-8000-000000000002',
        email: 'person@example.com',
        emailVerifiedAt: new Date(),
        authVerifierHash: verifier,
        kdf: wrappedVaultKey.kdf,
        kdfSalt: wrappedVaultKey.salt,
        wrappedVaultKey,
        recoveryWrappedVaultKey: { cryptoVersion: 2 as const, nonce: 'D'.repeat(16), ciphertext: 'E'.repeat(43) },
      })),
      markSessionReauthenticated,
      writeSecurityEvent,
    })
    const app = await buildApp(config, dependencies)
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/reauthenticate',
        headers: {
          origin: config.publicOrigin,
          cookie: `__Host-cv_session=${sessionToken}`,
          'x-cv-csrf': csrfToken,
        },
        payload: { authKey },
      })
      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ reauthenticated: true })
      expect(markSessionReauthenticated).toHaveBeenCalledOnce()
      expect(writeSecurityEvent).toHaveBeenCalledWith(
        '20000000-0000-4000-8000-000000000002',
        'reauthentication_succeeded',
        expect.objectContaining({ sessionId: '10000000-0000-4000-8000-000000000001' }),
      )
    } finally {
      await app.close()
    }
  })

  it('rejects plaintext-shaped sync mutations before persistence', async () => {
    const sessionToken = 'session-token'
    const csrfToken = 'csrf-token'
    const applyMutations = vi.fn(async () => ({ accepted: [], conflicts: [], cursor: 0 }))
    const dependencies = testDependencies(vi.fn(async () => null), {
      findSession: vi.fn(async (tokenHash) => tokenHash === sha256(sessionToken) ? {
        id: '10000000-0000-4000-8000-000000000001',
        userId: '20000000-0000-4000-8000-000000000002',
        csrfHash: sha256(csrfToken),
        deviceName: 'Test browser',
        createdAt: new Date(),
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        reauthenticatedAt: null,
      } : null),
      findUserById: vi.fn(async () => ({
        id: '20000000-0000-4000-8000-000000000002',
        email: 'person@example.com',
        emailVerifiedAt: new Date(),
        authVerifierHash: 'unused',
        kdf: wrappedVaultKey.kdf,
        kdfSalt: wrappedVaultKey.salt,
        wrappedVaultKey,
        recoveryWrappedVaultKey: { cryptoVersion: 2 as const, nonce: 'D'.repeat(16), ciphertext: 'E'.repeat(43) },
      })),
      applyMutations,
    })
    const app = await buildApp(config, dependencies)
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/sync',
        headers: { origin: config.publicOrigin, cookie: `__Host-cv_session=${sessionToken}`, 'x-cv-csrf': csrfToken },
        payload: { mutations: [{ itemId: '30000000-0000-4000-8000-000000000003', baseRevision: 0, tombstone: true, title: 'plaintext' }] },
      })
      expect(response.statusCode).toBe(400)
      expect(applyMutations).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('rejects malformed encrypted sync envelopes before persistence', async () => {
    const sessionToken = 'session-token'
    const csrfToken = 'csrf-token'
    const applyMutations = vi.fn(async () => ({ accepted: [], conflicts: [], cursor: 0 }))
    const dependencies = testDependencies(vi.fn(async () => null), {
      findSession: vi.fn(async () => ({
        id: '10000000-0000-4000-8000-000000000001',
        userId: '20000000-0000-4000-8000-000000000002',
        csrfHash: sha256(csrfToken),
        deviceName: 'Test browser',
        createdAt: new Date(),
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        reauthenticatedAt: null,
      })),
      findUserById: vi.fn(async () => ({
        id: '20000000-0000-4000-8000-000000000002',
        email: 'person@example.com',
        emailVerifiedAt: new Date(),
        authVerifierHash: 'unused',
        kdf: wrappedVaultKey.kdf,
        kdfSalt: wrappedVaultKey.salt,
        wrappedVaultKey,
        recoveryWrappedVaultKey: { cryptoVersion: 2 as const, nonce: 'D'.repeat(16), ciphertext: 'E'.repeat(43) },
      })),
      applyMutations,
    })
    const app = await buildApp(config, dependencies)
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/sync',
        headers: { origin: config.publicOrigin, cookie: `__Host-cv_session=${sessionToken}`, 'x-cv-csrf': csrfToken },
        payload: {
          mutations: [{
            itemId: '30000000-0000-4000-8000-000000000003',
            baseRevision: 0,
            encryptedPayload: {
              cryptoVersion: 2,
              itemVersion: '40000000-0000-4000-8000-000000000004',
              nonce: 'not valid base64',
              ciphertext: 'plaintext secret',
            },
          }],
        },
      })
      expect(response.statusCode).toBe(400)
      expect(applyMutations).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })
})
