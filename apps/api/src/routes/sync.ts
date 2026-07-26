import type { FastifyInstance } from 'fastify'
import { batchSyncRequestSchema } from '@ciphervault/contracts'
import { requireAuthentication, type ApiContext } from '../api-context'

export function registerSyncRoutes(app: FastifyInstance, { database }: ApiContext): void {
  app.get('/v1/sync', { preHandler: requireAuthentication }, async (request, reply) => {
    const query = request.query as { cursor?: string; limit?: string }
    const cursor = Math.max(0, Number(query.cursor ?? 0) || 0)
    const limit = Math.min(500, Math.max(1, Number(query.limit ?? 200) || 200))
    return reply.send(await database.pageChanges(request.auth!.user.id, cursor, limit))
  })

  app.post('/v1/sync', { preHandler: requireAuthentication }, async (request, reply) => {
    const parsed = batchSyncRequestSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', details: parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code, message: issue.message })) })
    const result = await database.applyMutations(request.auth!.user.id, parsed.data.mutations)
    return reply.code(result.conflicts.length ? 409 : 200).send(result)
  })
}
