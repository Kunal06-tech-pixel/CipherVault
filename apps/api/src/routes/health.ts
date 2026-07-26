import type { FastifyInstance } from 'fastify'
import type { ApiContext } from '../api-context'

export function registerHealthRoutes(app: FastifyInstance, { database, email, attachments }: ApiContext): void {
  app.get('/health/live', async () => ({ status: 'ok' }))
  app.get('/health/ready', async (_request, reply) => {
    try {
      await Promise.all([database.ping(), email.diagnostics(), attachments.ensureBucket()])
      return { status: 'ready' }
    } catch {
      return reply.code(503).send({ status: 'unavailable' })
    }
  })
  app.get('/health/diagnostics', async (_request, reply) => {
    try {
      const queue = await email.diagnostics()
      await Promise.all([database.ping(), attachments.ensureBucket()])
      return { status: 'ready', database: 'ok', objectStorage: 'ok', queue }
    } catch {
      return reply.code(503).send({ status: 'unavailable' })
    }
  })
}
