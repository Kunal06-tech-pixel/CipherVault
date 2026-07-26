import type { Sql } from 'postgres'

export class SecurityEventRepository {
  constructor(private readonly sql: Sql) {}

  async write(userId: string | null, event: string, metadata: Record<string, unknown> = {}): Promise<void> {
    await this.sql`
      insert into security_events (user_id, event, metadata)
      values (${userId}, ${event}, ${this.sql.json(metadata as never)})
    `
  }
}
