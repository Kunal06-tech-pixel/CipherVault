import type { FastifyInstance } from 'fastify'
import { deleteAccountRequestSchema } from '@keywall/contracts'
import { requireAuthentication, type ApiContext } from '../api-context'
import { browserSessionSameSite } from '../cookies'

export function registerSessionRoutes(app: FastifyInstance, context: ApiContext): void {
  const { database, config, sessionCookie } = context
  const authenticatedRateLimit = { max: 60, timeWindow: '1 minute' }
  const sensitiveRateLimit = { max: 10, timeWindow: '10 minutes' }

  app.get('/v1/account', { preHandler: requireAuthentication, config: { rateLimit: authenticatedRateLimit } }, async (request) => ({
    id: request.auth!.user.id,
    email: request.auth!.user.email,
    emailVerified: Boolean(request.auth!.user.emailVerifiedAt),
  }))

  app.get('/v1/sessions', { preHandler: requireAuthentication, config: { rateLimit: authenticatedRateLimit } }, async (request) =>
    database.listSessions(request.auth!.user.id, request.auth!.session.id))

  app.delete('/v1/sessions/:id', { preHandler: requireAuthentication, config: { rateLimit: sensitiveRateLimit } }, async (request, reply) => {
    const id = (request.params as { id: string }).id
    await database.revokeSession(id, request.auth!.user.id)
    if (id === request.auth!.session.id) {
      reply.clearCookie(sessionCookie, { path: '/', secure: config.cookieSecure, sameSite: browserSessionSameSite(config) })
    }
    return reply.code(204).send()
  })

  app.delete('/v1/account', { preHandler: requireAuthentication, config: { rateLimit: sensitiveRateLimit } }, async (request, reply) => {
    const parsed = deleteAccountRequestSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const result = await database.scheduleAccountDeletion(
      request.auth!.user.id,
      request.auth!.session.id,
      parsed.data.email,
    )
    if (result === 'reauthentication_required') return reply.code(403).send({ error: 'recent_reauthentication_required' })
    if (result === 'confirmation_mismatch') return reply.code(400).send({ error: 'account_confirmation_mismatch' })
    await database.writeSecurityEvent(request.auth!.user.id, 'account_deletion_scheduled', {
      sessionId: request.auth!.session.id,
    })
    reply.clearCookie(sessionCookie, { path: '/', secure: config.cookieSecure, sameSite: browserSessionSameSite(config) })
    reply.header('Clear-Site-Data', '"cache", "cookies", "storage"')
    return reply.code(202).send({ deletionScheduled: true, purgeAfterDays: 7 })
  })
}
