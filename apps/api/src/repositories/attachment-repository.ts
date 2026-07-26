import type { Sql } from 'postgres'
import type { StoredAttachment } from './types'

export class AttachmentRepository {
  constructor(private readonly sql: Sql) {}

  async reserve(input: Omit<StoredAttachment, 'status' | 'userId'>, userId: string): Promise<StoredAttachment | null> {
    return this.sql.begin(async (transaction) => {
      const quota = await transaction`
        update users set used_bytes = used_bytes + ${input.size}
        where id = ${userId} and deleted_at is null and used_bytes + ${input.size} <= quota_bytes
        returning id
      `
      if (!quota.length) return null
      try {
        const rows = await transaction<StoredAttachment[]>`
          insert into attachments (id, user_id, item_id, object_key, size, chunk_count, crypto_version, ciphertext_sha256)
          values (${input.id}, ${userId}, ${input.itemId}, ${`${userId}/${input.id}`}, ${input.size}, ${input.chunkCount}, ${input.cryptoVersion}, ${input.ciphertextSha256})
          returning id, user_id, item_id, size, chunk_count, crypto_version, ciphertext_sha256, status
        `
        return rows[0] ?? null
      } catch (error) {
        await transaction`update users set used_bytes = greatest(0, used_bytes - ${input.size}) where id = ${userId}`
        throw error
      }
    })
  }

  async find(id: string, userId: string): Promise<StoredAttachment | null> {
    const rows = await this.sql<StoredAttachment[]>`
      select id, user_id, item_id, size, chunk_count, crypto_version, ciphertext_sha256, status
      from attachments where id = ${id} and user_id = ${userId} and status <> 'deleted' limit 1
    `
    return rows[0] ?? null
  }

  async complete(id: string, userId: string, chunkHashes: string[]): Promise<boolean> {
    const rows = await this.sql`
      update attachments set status = 'complete', chunk_hashes = ${this.sql.json(chunkHashes)}, completed_at = now()
      where id = ${id} and user_id = ${userId} and status = 'pending' and chunk_count = ${chunkHashes.length}
      returning id
    `
    return rows.length === 1
  }

  async delete(id: string, userId: string): Promise<StoredAttachment | null> {
    return this.sql.begin(async (transaction) => {
      const rows = await transaction<StoredAttachment[]>`
        update attachments set status = 'deleted', deleted_at = now()
        where id = ${id} and user_id = ${userId} and status <> 'deleted'
        returning id, user_id, item_id, size, chunk_count, crypto_version, ciphertext_sha256, status
      `
      const attachment = rows[0]
      if (attachment) {
        await transaction`update users set used_bytes = greatest(0, used_bytes - ${attachment.size}) where id = ${userId}`
      }
      return attachment ?? null
    })
  }
}
