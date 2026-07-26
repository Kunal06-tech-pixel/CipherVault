import type { Sql } from 'postgres'
import type { StoredSession } from './types'

export class SessionRepository {
  constructor(private readonly sql: Sql) {}

  async create(userId: string, tokenHash: string, csrfHash: string, deviceName: string): Promise<StoredSession> {
    const rows = await this.sql<StoredSession[]>`
      insert into sessions (user_id, token_hash, csrf_hash, device_name, expires_at, reauthenticated_at)
      values (${userId}, ${tokenHash}, ${csrfHash}, ${deviceName}, now() + interval '12 hours', now())
      returning id, user_id, csrf_hash, device_name, created_at, last_seen_at, expires_at, reauthenticated_at
    `
    const session = rows[0]
    if (!session) throw new Error('Session creation failed')
    return session
  }

  async find(tokenHash: string): Promise<StoredSession | null> {
    const rows = await this.sql<StoredSession[]>`
      update sessions set last_seen_at = now()
      where token_hash = ${tokenHash} and revoked_at is null and expires_at > now()
        and last_seen_at > now() - interval '30 minutes'
      returning id, user_id, csrf_hash, device_name, created_at, last_seen_at, expires_at, reauthenticated_at
    `
    return rows[0] ?? null
  }

  async revoke(sessionId: string, userId: string): Promise<void> {
    await this.sql`update sessions set revoked_at = now() where id = ${sessionId} and user_id = ${userId}`
  }

  async markReauthenticated(sessionId: string, userId: string): Promise<void> {
    await this.sql`
      update sessions set reauthenticated_at = now()
      where id = ${sessionId} and user_id = ${userId} and revoked_at is null and expires_at > now()
    `
  }

  async list(userId: string, currentId: string) {
    return this.sql`
      select id, device_name, created_at, last_seen_at, expires_at, id = ${currentId} as current
      from sessions where user_id = ${userId} and revoked_at is null and expires_at > now()
      order by last_seen_at desc
    `
  }
}
