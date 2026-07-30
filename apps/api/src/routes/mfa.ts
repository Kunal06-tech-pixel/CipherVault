import type { FastifyInstance } from 'fastify'
import { brand } from '@keywall/brand'
import type { AuthenticationResponseJSON, RegistrationResponseJSON, WebAuthnCredential } from '@simplewebauthn/server'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { isoUint8Array } from '@simplewebauthn/server/helpers'
import {
  mfaTotpCompleteRequestSchema,
  mfaWebAuthnCompleteRequestSchema,
  mfaWebAuthnOptionsRequestSchema,
  passkeyEnrollmentCompleteSchema,
  passkeyEnrollmentStartSchema,
  totpEnrollmentConfirmSchema,
  totpEnrollmentStartSchema,
} from '@keywall/contracts'
import { requireAuthentication, type ApiContext } from '../api-context'
import {
  createTotpSecret,
  decryptMfaSecret,
  encryptMfaSecret,
  generateRecoveryCodes,
  verifyTotp,
  type SecretEnvelope,
} from '../mfa-security'
import { clientIpHash } from '../request-policy'
import { issueBrowserSession } from '../session-service'
import { opaqueToken, sha256 } from '../security'

interface TotpCredential { envelope: SecretEnvelope }
interface PasskeyCredential {
  id: string
  publicKey: string
  counter: number
  transports?: WebAuthnCredential['transports']
  deviceType: string
  backedUp: boolean
}

function relyingParty(config: ApiContext['config']) {
  const origin = new URL(config.publicOrigin)
  return { origin: origin.origin, rpID: origin.hostname }
}

function recentlyReauthenticated(context: ApiContext, request: Parameters<typeof requireAuthentication>[0]): boolean {
  const timestamp = request.auth?.session.reauthenticatedAt?.getTime() ?? 0
  return timestamp > Date.now() - 5 * 60_000
}

function methods(factors: Awaited<ReturnType<ApiContext['database']['listMfaFactors']>>) {
  return [...new Set(factors.map((factor) => factor.kind))]
}

async function finishMfaLogin(
  appContext: ApiContext,
  challenge: NonNullable<Awaited<ReturnType<ApiContext['database']['findMfaChallenge']>>>,
  request: Parameters<typeof requireAuthentication>[0],
  reply: Parameters<typeof requireAuthentication>[1],
) {
  if (!(await appContext.database.consumeMfaChallenge(challenge.id))) {
    return reply.code(400).send({ error: 'invalid_or_expired_mfa_challenge' })
  }
  const user = await appContext.database.findUserById(challenge.userId)
  if (!user || !challenge.deviceName) return reply.code(400).send({ error: 'invalid_or_expired_mfa_challenge' })
  return issueBrowserSession(appContext, user, challenge.deviceName, request, reply)
}

export function registerMfaRoutes(app: FastifyInstance, context: ApiContext): void {
  const { database, config } = context
  const authenticatedRateLimit = { max: 30, timeWindow: '1 minute' }
  const enrollmentRateLimit = { max: 10, timeWindow: '10 minutes' }

  app.get('/v1/auth/mfa', { preHandler: requireAuthentication, config: { rateLimit: authenticatedRateLimit } }, async (request) => {
    const factors = await database.listMfaFactors(request.auth!.user.id)
    return {
      factors: factors.map(({ id, kind, label, createdAt, lastUsedAt }) => ({ id, kind, label, createdAt, lastUsedAt })),
    }
  })

  app.post('/v1/auth/mfa/totp/start', { preHandler: requireAuthentication, config: { rateLimit: enrollmentRateLimit } }, async (request, reply) => {
    if (!recentlyReauthenticated(context, request)) return reply.code(403).send({ error: 'recent_reauthentication_required' })
    const parsed = totpEnrollmentStartSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const secret = createTotpSecret()
    const factorId = await database.createTotpFactor(request.auth!.user.id, parsed.data.label, {
      envelope: encryptMfaSecret(secret, config.mfaEncryptionKey),
    })
    const issuer = encodeURIComponent(brand.productName)
    const account = encodeURIComponent(request.auth!.user.email)
    return { factorId, secret, otpauthUri: `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&digits=6&period=30` }
  })

  app.post('/v1/auth/mfa/totp/confirm', { preHandler: requireAuthentication, config: { rateLimit: enrollmentRateLimit } }, async (request, reply) => {
    if (!recentlyReauthenticated(context, request)) return reply.code(403).send({ error: 'recent_reauthentication_required' })
    const parsed = totpEnrollmentConfirmSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const factor = await database.findMfaFactor(request.auth!.user.id, parsed.data.factorId)
    if (!factor || factor.kind !== 'totp' || factor.verifiedAt) return reply.code(400).send({ error: 'invalid_factor' })
    const secret = decryptMfaSecret((factor.credential as unknown as TotpCredential).envelope, config.mfaEncryptionKey)
    if (!verifyTotp(secret, parsed.data.code)) return reply.code(400).send({ error: 'invalid_mfa_code' })
    const hasExistingFactors = (await database.listMfaFactors(request.auth!.user.id)).length > 0
    const recoveryCodes = hasExistingFactors ? [] : generateRecoveryCodes()
    const confirmed = await database.confirmTotpFactor(
      request.auth!.user.id,
      factor.id,
      recoveryCodes.map((code) => sha256(code)),
    )
    if (!confirmed) return reply.code(409).send({ error: 'factor_already_confirmed' })
    await database.writeSecurityEvent(request.auth!.user.id, 'mfa_factor_enrolled', { kind: 'totp', factorId: factor.id })
    return { enabled: true, recoveryCodes }
  })

  app.post('/v1/auth/mfa/passkey/start', { preHandler: requireAuthentication, config: { rateLimit: enrollmentRateLimit } }, async (request, reply) => {
    if (!recentlyReauthenticated(context, request)) return reply.code(403).send({ error: 'recent_reauthentication_required' })
    const parsed = passkeyEnrollmentStartSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const factors = await database.listMfaFactors(request.auth!.user.id)
    const passkeys = factors.filter((factor) => factor.kind === 'webauthn').map((factor) => factor.credential as unknown as PasskeyCredential)
    const { rpID } = relyingParty(config)
    const options = await generateRegistrationOptions({
      rpName: brand.productName,
      rpID,
      userID: isoUint8Array.fromUTF8String(request.auth!.user.id),
      userName: request.auth!.user.email,
      userDisplayName: request.auth!.user.email,
      attestationType: 'none',
      excludeCredentials: passkeys.map(({ id, transports }) => ({ id, ...(transports ? { transports } : {}) })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
    })
    const enrollmentToken = opaqueToken()
    await database.createPasskeyChallenge(
      request.auth!.user.id,
      sha256(enrollmentToken),
      parsed.data.label,
      options.challenge,
    )
    return { enrollmentToken, options }
  })

  app.post('/v1/auth/mfa/passkey/complete', { preHandler: requireAuthentication, config: { rateLimit: enrollmentRateLimit } }, async (request, reply) => {
    if (!recentlyReauthenticated(context, request)) return reply.code(403).send({ error: 'recent_reauthentication_required' })
    const parsed = passkeyEnrollmentCompleteSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const challenge = await database.findMfaChallenge(sha256(parsed.data.enrollmentToken), 'webauthn_registration')
    if (!challenge?.challenge || challenge.userId !== request.auth!.user.id || !challenge.label) {
      return reply.code(400).send({ error: 'invalid_or_expired_mfa_challenge' })
    }
    const { origin, rpID } = relyingParty(config)
    const verification = await verifyRegistrationResponse({
      response: parsed.data.response as unknown as RegistrationResponseJSON,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    })
    if (!verification.verified) return reply.code(400).send({ error: 'invalid_passkey_response' })
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo
    const existingFactors = await database.listMfaFactors(request.auth!.user.id)
    const recoveryCodes = existingFactors.length ? [] : generateRecoveryCodes()
    const added = await database.addPasskey(challenge.id, request.auth!.user.id, challenge.label, {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: credential.transports,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    }, recoveryCodes.map((code) => sha256(code)))
    if (!added) return reply.code(409).send({ error: 'factor_already_confirmed' })
    await database.writeSecurityEvent(request.auth!.user.id, 'mfa_factor_enrolled', { kind: 'webauthn' })
    return { enabled: true, recoveryCodes }
  })

  app.delete('/v1/auth/mfa/:id', { preHandler: requireAuthentication, config: { rateLimit: enrollmentRateLimit } }, async (request, reply) => {
    if (!recentlyReauthenticated(context, request)) return reply.code(403).send({ error: 'recent_reauthentication_required' })
    const factorId = (request.params as { id?: string }).id ?? ''
    const disabled = await database.disableMfaFactor(request.auth!.user.id, factorId)
    if (!disabled) return reply.code(409).send({ error: 'cannot_disable_last_factor' })
    await database.writeSecurityEvent(request.auth!.user.id, 'mfa_factor_disabled', { factorId })
    return reply.code(204).send()
  })

  app.post('/v1/auth/mfa/totp/complete', { config: { rateLimit: { max: 8, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const parsed = mfaTotpCompleteRequestSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const challenge = await database.findMfaChallenge(sha256(parsed.data.mfaToken), 'login')
    if (!challenge) return reply.code(400).send({ error: 'invalid_or_expired_mfa_challenge' })
    const factors = await database.listMfaFactors(challenge.userId)
    let verifiedFactorId: string | null = null
    if (parsed.data.code.includes('-')) {
      if (await database.consumeMfaRecoveryCode(challenge.userId, sha256(parsed.data.code))) verifiedFactorId = 'recovery-code'
    } else {
      for (const factor of factors.filter((value) => value.kind === 'totp')) {
        const secret = decryptMfaSecret((factor.credential as unknown as TotpCredential).envelope, config.mfaEncryptionKey)
        if (verifyTotp(secret, parsed.data.code)) { verifiedFactorId = factor.id; break }
      }
    }
    if (!verifiedFactorId) {
      await database.recordMfaFailure(challenge.id)
      await database.writeSecurityEvent(challenge.userId, 'mfa_failed', { ip: clientIpHash(request, config), method: 'totp' })
      return reply.code(401).send({ error: 'invalid_mfa_code' })
    }
    if (verifiedFactorId !== 'recovery-code') await database.markMfaFactorUsed(verifiedFactorId)
    await database.writeSecurityEvent(challenge.userId, 'mfa_succeeded', { method: verifiedFactorId === 'recovery-code' ? 'recovery_code' : 'totp' })
    return finishMfaLogin(context, challenge, request, reply)
  })

  app.post('/v1/auth/mfa/webauthn/options', { config: { rateLimit: { max: 8, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const parsed = mfaWebAuthnOptionsRequestSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const challenge = await database.findMfaChallenge(sha256(parsed.data.mfaToken), 'login')
    if (!challenge) return reply.code(400).send({ error: 'invalid_or_expired_mfa_challenge' })
    const passkeys = (await database.listMfaFactors(challenge.userId))
      .filter((factor) => factor.kind === 'webauthn')
      .map((factor) => factor.credential as unknown as PasskeyCredential)
    if (!passkeys.length) return reply.code(400).send({ error: 'passkey_not_available' })
    const { rpID } = relyingParty(config)
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: passkeys.map(({ id, transports }) => ({ id, ...(transports ? { transports } : {}) })),
      userVerification: 'required',
    })
    await database.setMfaChallengeValue(challenge.id, options.challenge)
    return { options }
  })

  app.post('/v1/auth/mfa/webauthn/complete', { config: { rateLimit: { max: 8, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const parsed = mfaWebAuthnCompleteRequestSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const challenge = await database.findMfaChallenge(sha256(parsed.data.mfaToken), 'login')
    if (!challenge?.challenge) return reply.code(400).send({ error: 'invalid_or_expired_mfa_challenge' })
    const response = parsed.data.response as unknown as AuthenticationResponseJSON
    const factor = (await database.listMfaFactors(challenge.userId)).find((value) => {
      return value.kind === 'webauthn' && (value.credential as unknown as PasskeyCredential).id === response.id
    })
    if (!factor) return reply.code(401).send({ error: 'invalid_passkey_response' })
    const stored = factor.credential as unknown as PasskeyCredential
    const { origin, rpID } = relyingParty(config)
    try {
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: stored.id,
          publicKey: new Uint8Array(Buffer.from(stored.publicKey, 'base64url')),
          counter: stored.counter,
          ...(stored.transports ? { transports: stored.transports } : {}),
        },
        requireUserVerification: true,
      })
      if (!verification.verified) throw new Error('Passkey verification failed')
      await database.markMfaFactorUsed(factor.id, verification.authenticationInfo.newCounter)
    } catch {
      await database.recordMfaFailure(challenge.id)
      await database.writeSecurityEvent(challenge.userId, 'mfa_failed', { ip: clientIpHash(request, config), method: 'webauthn' })
      return reply.code(401).send({ error: 'invalid_passkey_response' })
    }
    await database.writeSecurityEvent(challenge.userId, 'mfa_succeeded', { method: 'webauthn' })
    return finishMfaLogin(context, challenge, request, reply)
  })
}
