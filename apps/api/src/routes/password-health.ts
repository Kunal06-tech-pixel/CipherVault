import type { FastifyInstance } from 'fastify'
import { passwordRangeRequestSchema } from '@ciphervault/contracts'
import { requireAuthentication, type ApiContext } from '../api-context'

export function registerPasswordHealthRoutes(app: FastifyInstance, _context: ApiContext): void {
  app.post('/v1/security/password-range', {
    preHandler: requireAuthentication,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = passwordRangeRequestSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    try {
      const response = await fetch(`https://api.pwnedpasswords.com/range/${parsed.data.prefix}`, {
        headers: { 'user-agent': 'CipherVault-Password-Health/2', 'add-padding': 'true' },
        signal: AbortSignal.timeout(8_000),
      })
      if (!response.ok) throw new Error('Password range provider rejected the request.')
      reply.type('text/plain; charset=utf-8')
      return await response.text()
    } catch {
      return reply.code(503).send({ error: 'password_range_unavailable' })
    }
  })
}
