import { describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { loadMigrationFiles } from './migrations'

describe('database migrations', () => {
  it('discovers immutable, ordered migration files with unique versions', async () => {
    const migrations = await loadMigrationFiles(new URL('../migrations/', import.meta.url))
    expect(migrations.map(({ filename }) => filename)).toEqual([
      '0001_initial.sql',
      '0002_hardening.sql',
      '0003_account_deletion.sql',
      '0004_mfa.sql',
      '0005_extension_pairing.sql',
    ])
    expect(new Set(migrations.map(({ version }) => version)).size).toBe(migrations.length)
    for (const migration of migrations) {
      expect(migration.checksum).toMatch(/^[a-f0-9]{64}$/u)
      expect(migration.sql.trim().length).toBeGreaterThan(100)
    }
  })

  it('applies the complete schema idempotently to a PostgreSQL-compatible database', async () => {
    const database = await PGlite.create({ extensions: { pgcrypto } })
    try {
      const migrations = await loadMigrationFiles(new URL('../migrations/', import.meta.url))
      for (const migration of migrations) await database.exec(migration.sql)
      for (const migration of migrations) await database.exec(migration.sql)

      const indexes = await database.query<{ indexname: string }>(`
        select indexname from pg_indexes where schemaname = 'public'
      `)
      expect(indexes.rows.map(({ indexname }) => indexname)).toEqual(expect.arrayContaining([
        'sync_changes_user_cursor',
        'recovery_requests_one_active_per_user',
        'attachments_pending_expiry',
        'mfa_factors_user_enabled',
        'extension_devices_user_active',
      ]))

      const constraints = await database.query<{ constraint_name: string }>(`
        select constraint_name from information_schema.table_constraints
        where table_schema = 'public' and table_name = 'users'
      `)
      expect(constraints.rows.map(({ constraint_name }) => constraint_name)).toContain('users_quota_bounds')
    } finally {
      await database.close()
    }
  })
})
