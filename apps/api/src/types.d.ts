import type { StoredSession, StoredUser } from './database'

declare module 'fastify' {
  interface FastifyRequest {
    auth: { session: StoredSession; user: StoredUser } | null
  }
}
