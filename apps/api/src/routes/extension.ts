import { createPublicKey, verify, type JsonWebKey as NodeJsonWebKey } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import {
  extensionGrantApprovalSchema,
  extensionGrantRequestSchema,
  extensionTokenExchangeSchema,
  extensionTokenRefreshSchema,
} from '@keywall/contracts'
import { requireAuthentication, type ApiContext } from '../api-context'
import { opaqueToken, sha256 } from '../security'

function bearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}

function verifyDeviceSignature(publicJwk: JsonWebKey, message: string, signature: string): boolean {
  try {
    return verify(
      'sha256',
      Buffer.from(message),
      { key: createPublicKey({ key: publicJwk as NodeJsonWebKey, format: 'jwk' }), dsaEncoding: 'ieee-p1363' },
      Buffer.from(signature, 'base64url'),
    )
  } catch { return false }
}

export function registerExtensionRoutes(app: FastifyInstance, context: ApiContext): void {
  const { database } = context

  app.get('/v1/devices', { preHandler: requireAuthentication }, async (request) => ({
    devices: await database.listExtensionDevices(request.auth!.user.id),
  }))

  app.delete('/v1/devices/:id', { preHandler: requireAuthentication }, async (request, reply) => {
    const deviceId = (request.params as { id?: string }).id ?? ''
    const revoked = await database.revokeExtensionDevice(request.auth!.user.id, deviceId)
    if (!revoked) return reply.code(404).send({ error: 'device_not_found' })
    await database.writeSecurityEvent(request.auth!.user.id, 'extension_device_revoked', { deviceId })
    return reply.code(204).send()
  })

  app.post('/v1/extension/grants', { preHandler: requireAuthentication }, async (request, reply) => {
    const parsed = extensionGrantRequestSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    if (parsed.data.devicePublicKey.wrapKey.kty !== 'RSA' || parsed.data.devicePublicKey.signingKey.kty !== 'EC') {
      return reply.code(400).send({ error: 'invalid_device_keys' })
    }
    const code = opaqueToken()
    await database.createExtensionGrant({
      userId: request.auth!.user.id,
      codeHash: sha256(code),
      pkceChallenge: parsed.data.pkceChallenge,
      devicePublicKey: parsed.data.devicePublicKey as { wrapKey: JsonWebKey; signingKey: JsonWebKey },
      label: parsed.data.label,
    })
    return { code }
  })

  app.post('/v1/extension/grants/approve', { preHandler: requireAuthentication }, async (request, reply) => {
    const parsed = extensionGrantApprovalSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const approved = await database.approveExtensionGrant(
      request.auth!.user.id,
      sha256(parsed.data.code),
      parsed.data.wrappedVaultKey,
    )
    if (!approved) return reply.code(400).send({ error: 'invalid_or_expired_extension_grant' })
    await database.writeSecurityEvent(request.auth!.user.id, 'extension_pairing_approved')
    return { approved: true }
  })

  app.post('/v1/extension/token', { config: { rateLimit: { max: 10, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const parsed = extensionTokenExchangeSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const grant = await database.findExtensionGrant(sha256(parsed.data.code))
    if (!grant || sha256(parsed.data.verifier) !== grant.pkceChallenge || !grant.wrappedVaultKey) {
      return reply.code(400).send({ error: 'invalid_or_expired_extension_grant' })
    }
    const refreshToken = opaqueToken()
    const accessToken = opaqueToken()
    const deviceId = await database.exchangeExtensionGrant(grant.id, sha256(refreshToken), sha256(accessToken))
    if (!deviceId) return reply.code(400).send({ error: 'invalid_or_expired_extension_grant' })
    await database.writeSecurityEvent(grant.userId, 'extension_paired', { deviceId })
    return { accessToken, expiresIn: 300, refreshToken, wrappedVaultKey: grant.wrappedVaultKey }
  })

  app.post('/v1/extension/token/refresh', { config: { rateLimit: { max: 20, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const parsed = extensionTokenRefreshSchema.safeParse(request.body)
    if (!parsed.success || Math.abs(Date.now() - parsed.data.timestamp) > 60_000) {
      return reply.code(400).send({ error: 'invalid_device_proof' })
    }
    const device = await database.findExtensionDevice(sha256(parsed.data.refreshToken))
    const proof = `${parsed.data.refreshToken}.${parsed.data.timestamp}.${parsed.data.nonce}`
    if (!device || !verifyDeviceSignature(device.devicePublicKey.signingKey, proof, parsed.data.signature)) {
      return reply.code(401).send({ error: 'invalid_device_proof' })
    }
    if (!(await database.acceptExtensionDeviceProof(device.id, parsed.data.timestamp))) {
      return reply.code(409).send({ error: 'replayed_device_proof' })
    }
    const accessToken = opaqueToken()
    await database.rotateExtensionAccessToken(device.id, device.userId, sha256(accessToken))
    return { accessToken, expiresIn: 300 }
  })

  app.get('/v1/extension/sync', async (request, reply) => {
    const token = bearer(request)
    const authenticated = token ? await database.authenticateExtensionToken(sha256(token)) : null
    if (!authenticated) return reply.code(401).send({ error: 'invalid_access_token' })
    const query = request.query as { cursor?: string; limit?: string }
    const cursor = Math.max(0, Number(query.cursor ?? 0) || 0)
    const limit = Math.min(200, Math.max(1, Number(query.limit ?? 200) || 200))
    return database.pageChanges(authenticated.userId, cursor, limit)
  })
}
