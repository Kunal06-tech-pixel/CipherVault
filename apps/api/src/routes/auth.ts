import type { FastifyInstance } from 'fastify'
import {
  loginRequestSchema,
  preloginRequestSchema,
  recoveryChallengeRequestSchema,
  recoveryCompleteRequestSchema,
  recoveryStartRequestSchema,
  reauthenticateRequestSchema,
  registerRequestSchema,
} from '@ciphervault/contracts'
import { requireAuthentication, type ApiContext } from '../api-context'
import { clientIpHash } from '../request-policy'
import { fakePreloginSalt, hashAuthKey, opaqueToken, sha256, verifyAuthKey } from '../security'
import { issueBrowserSession } from '../session-service'
import { decryptMfaSecret, verifyTotp, type SecretEnvelope } from '../mfa-security'

export function registerAuthRoutes(app: FastifyInstance, context: ApiContext): void {
  const { config, database, email, sessionCookie } = context

  app.post('/v1/auth/prelogin', { config: { rateLimit: { max: 15, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = preloginRequestSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const user = await database.findUserByEmail(parsed.data.email)
    return {
      kdf: user?.kdf ?? { algorithm: 'argon2id', memoryKiB: 65_536, iterations: 3, parallelism: 1, hashLength: 32 },
      salt: user?.kdfSalt ?? fakePreloginSalt(config.preloginSecret, parsed.data.email),
    }
  })

  app.post('/v1/auth/register', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const parsed = registerRequestSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten().fieldErrors })
    const authVerifierHash = await hashAuthKey(parsed.data.authKey, config.authPepper)
    const verificationToken = opaqueToken()
    const user = await database.createUser({
      email: parsed.data.email,
      authVerifierHash,
      wrappedVaultKey: parsed.data.wrappedVaultKey,
      recoveryWrappedVaultKey: parsed.data.recoveryWrappedVaultKey,
    }, sha256(verificationToken))

    // Existing and newly created accounts deliberately receive the same response.
    if (!user) return reply.code(202).send({ accepted: true, verificationRequired: true })
    await database.writeSecurityEvent(user.id, 'account_registered', { ip: clientIpHash(request, config) })
    try {
      await email.sendVerification(user.email, verificationToken)
    } catch (error) {
      request.log.error({ error }, 'verification_email_failed')
    }
    return reply.code(202).send({ accepted: true, verificationRequired: true })
  })

  app.post('/v1/auth/verify-email', async (request, reply) => {
    const token = typeof (request.body as { token?: unknown } | null)?.token === 'string'
      ? (request.body as { token: string }).token
      : ''
    if (!token || !(await database.verifyEmail(sha256(token)))) {
      return reply.code(400).send({ error: 'invalid_or_expired_token' })
    }
    return { verified: true }
  })

  app.post('/v1/auth/login', { config: { rateLimit: { max: 8, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const parsed = loginRequestSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const user = await database.findUserByEmail(parsed.data.email)
    const valid = user ? await verifyAuthKey(user.authVerifierHash, parsed.data.authKey, config.authPepper) : false
    if (!user || !valid) {
      await database.writeSecurityEvent(user?.id ?? null, 'login_failed', { ip: clientIpHash(request, config) })
      return reply.code(401).send({ error: 'invalid_credentials' })
    }
    if (!user.emailVerifiedAt && !config.allowUnverifiedLogin) {
      return reply.code(403).send({ error: 'email_not_verified' })
    }
    const factors = await database.listMfaFactors(user.id)
    if (factors.length) {
      const mfaToken = opaqueToken()
      await database.createMfaLoginChallenge(user.id, sha256(mfaToken), parsed.data.deviceName)
      await database.writeSecurityEvent(user.id, 'login_mfa_challenged', {
        ip: clientIpHash(request, config),
        methods: [...new Set(factors.map((factor) => factor.kind))],
      })
      return reply.code(202).send({
        mfaRequired: true,
        mfaToken,
        methods: [...new Set(factors.map((factor) => factor.kind))],
      })
    }
    return issueBrowserSession(context, user, parsed.data.deviceName, request, reply)
  })

  app.post('/v1/auth/recovery/start', { config: { rateLimit: { max: 3, timeWindow: '30 minutes' } } }, async (request, reply) => {
    const parsed = recoveryStartRequestSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const user = await database.findUserByEmail(parsed.data.email)
    if (user) {
      const token = opaqueToken()
      await database.createRecoveryRequest(user.id, sha256(token))
      try {
        await email.sendRecovery(user.email, token)
      } catch (error) {
        request.log.error({ error }, 'recovery_email_failed')
      }
      await database.writeSecurityEvent(user.id, 'recovery_requested', { ip: clientIpHash(request, config) })
    }
    return reply.code(202).send({ accepted: true })
  })

  app.post('/v1/auth/recovery/challenge', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (request, reply) => {
    const parsed = recoveryChallengeRequestSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const challenge = await database.recoveryChallenge(sha256(parsed.data.token))
    if (!challenge) return reply.code(400).send({ error: 'invalid_or_expired_token' })
    const factors = await database.listMfaFactors(challenge.userId)
    return { email: challenge.email, recoveryWrappedVaultKey: challenge.recoveryWrappedVaultKey, mfaRequired: factors.length > 0, mfaMethods: [...new Set(factors.map((factor) => factor.kind))] }
  })

  app.post('/v1/auth/recovery/complete', { config: { rateLimit: { max: 5, timeWindow: '30 minutes' } } }, async (request, reply) => {
    const parsed = recoveryCompleteRequestSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const challenge = await database.recoveryChallenge(sha256(parsed.data.token))
    if (!challenge) return reply.code(400).send({ error: 'invalid_or_expired_token' })
    const factors = await database.listMfaFactors(challenge.userId)
    if (factors.length) {
      if (!parsed.data.mfaCode) return reply.code(401).send({ error: 'mfa_required_for_recovery' })
      let mfaValid = false
      if (parsed.data.mfaCode.includes('-')) {
        mfaValid = await database.consumeMfaRecoveryCode(challenge.userId, sha256(parsed.data.mfaCode))
      } else {
        for (const factor of factors.filter((value) => value.kind === 'totp')) {
          try {
            const secret = decryptMfaSecret((factor.credential as unknown as { envelope: SecretEnvelope }).envelope, config.mfaEncryptionKey)
            if (verifyTotp(secret, parsed.data.mfaCode)) { mfaValid = true; break }
          } catch { /* malformed stored factor is treated as a failed factor */ }
        }
      }
      if (!mfaValid) return reply.code(401).send({ error: 'invalid_mfa_code' })
    }
    const verifier = await hashAuthKey(parsed.data.authKey, config.authPepper)
    const completed = await database.completeRecovery(
      sha256(parsed.data.token),
      verifier,
      parsed.data.wrappedVaultKey,
    )
    if (!completed) return reply.code(400).send({ error: 'invalid_or_expired_token' })
    return { recovered: true, sessionsRevoked: true }
  })

  app.post('/v1/auth/logout', async (request, reply) => {
    if (request.auth) await database.revokeSession(request.auth.session.id, request.auth.user.id)
    reply.clearCookie(sessionCookie, { path: '/', secure: config.cookieSecure, sameSite: 'strict' })
    reply.header('Clear-Site-Data', '"cache", "cookies"')
    return reply.code(204).send()
  })

  app.post('/v1/auth/reauthenticate', { preHandler: requireAuthentication }, async (request, reply) => {
    const parsed = reauthenticateRequestSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const valid = await verifyAuthKey(request.auth!.user.authVerifierHash, parsed.data.authKey, config.authPepper)
    if (!valid) {
      await database.writeSecurityEvent(request.auth!.user.id, 'reauthentication_failed', {
        sessionId: request.auth!.session.id,
        ip: clientIpHash(request, config),
      })
      return reply.code(401).send({ error: 'invalid_credentials' })
    }
    await database.markSessionReauthenticated(request.auth!.session.id, request.auth!.user.id)
    await database.writeSecurityEvent(request.auth!.user.id, 'reauthentication_succeeded', {
      sessionId: request.auth!.session.id,
      ip: clientIpHash(request, config),
    })
    return { reauthenticated: true }
  })
}
