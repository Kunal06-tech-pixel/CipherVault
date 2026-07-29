import type { Sql } from 'postgres'
import type { EncryptedItem, SyncMutation } from '@keywall/contracts'
import type { SyncResult } from './types'

function normalizeItem(item: EncryptedItem): EncryptedItem {
  return { ...item, revision: Number(item.revision) }
}

export class SyncRepository {
  constructor(private readonly sql: Sql) {}

  async pageChanges(userId: string, cursor: number, limit: number): Promise<{
    items: EncryptedItem[]
    cursor: number
    hasMore: boolean
  }> {
    const rows = await this.sql<Array<EncryptedItem & { sequence: number }>>`
      select i.id, i.revision, i.crypto_version, i.item_version, i.nonce, i.ciphertext,
             i.deleted_at, c.sequence
      from sync_changes c join vault_items i on i.user_id = c.user_id and i.id = c.item_id
      where c.user_id = ${userId} and c.sequence > ${cursor}
      order by c.sequence asc limit ${limit + 1}
    `
    const page = rows.slice(0, limit)
    const nextCursor = page.length ? Number(page.at(-1)?.sequence ?? cursor) : cursor
    return {
      items: page.map(({ sequence: _sequence, ...item }) => normalizeItem(item)),
      cursor: nextCursor,
      hasMore: rows.length > limit,
    }
  }

  async applyMutations(userId: string, mutations: SyncMutation[]): Promise<SyncResult> {
    return this.sql.begin(async (transaction) => {
      const accepted: EncryptedItem[] = []
      const conflicts: EncryptedItem[] = []
      let cursor = 0

      for (const mutation of mutations) {
        const existingRows = await transaction<EncryptedItem[]>`
          select id, revision, crypto_version, item_version, nonce, ciphertext, deleted_at
          from vault_items where user_id = ${userId} and id = ${mutation.itemId} for update
        `
        const existing = existingRows[0] ? normalizeItem(existingRows[0]) : undefined
        if ((existing?.revision ?? 0) !== mutation.baseRevision) {
          if (existing) conflicts.push(existing)
          continue
        }

        const nextRevision = (existing?.revision ?? 0) + 1
        const payload = mutation.encryptedPayload
        const cryptoVersion = payload?.cryptoVersion ?? existing?.cryptoVersion ?? 2
        const itemVersion = payload?.itemVersion ?? existing?.itemVersion ?? crypto.randomUUID()
        const nonce = payload?.nonce ?? existing?.nonce ?? ''
        const ciphertext = payload?.ciphertext ?? existing?.ciphertext ?? ''
        const rows = await transaction<EncryptedItem[]>`
          insert into vault_items (
            user_id, id, revision, crypto_version, item_version, nonce, ciphertext, deleted_at
          ) values (
            ${userId}, ${mutation.itemId}, ${nextRevision}, ${cryptoVersion},
            ${itemVersion}, ${nonce}, ${ciphertext}, ${mutation.tombstone ? transaction`now()` : null}
          ) on conflict (user_id, id) do update set
            revision = excluded.revision, crypto_version = excluded.crypto_version,
            item_version = excluded.item_version, nonce = excluded.nonce,
            ciphertext = excluded.ciphertext, deleted_at = excluded.deleted_at, updated_at = now()
          returning id, revision, crypto_version, item_version, nonce, ciphertext, deleted_at
        `
        const stored = rows[0] ? normalizeItem(rows[0]) : undefined
        if (!stored) throw new Error('Sync mutation failed')
        accepted.push(stored)
        const changes = await transaction<{ sequence: number }[]>`
          insert into sync_changes (user_id, item_id, revision, operation)
          values (${userId}, ${mutation.itemId}, ${nextRevision}, ${mutation.tombstone ? 'delete' : 'upsert'})
          returning sequence
        `
        cursor = Number(changes[0]?.sequence ?? cursor)
      }
      return { accepted, conflicts, cursor }
    })
  }
}
