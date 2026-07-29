import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Sql } from 'postgres'

const migrationName = /^(\d{4,})_[a-z0-9_]+\.sql$/u

export interface MigrationFile {
  version: string
  filename: string
  checksum: string
  sql: string
}

export async function loadMigrationFiles(directoryUrl: URL): Promise<MigrationFile[]> {
  const directory = fileURLToPath(directoryUrl)
  const filenames = (await readdir(directory))
    .filter((filename) => migrationName.test(filename))
    .sort((left, right) => left.localeCompare(right))

  if (!filenames.length) throw new Error(`No database migrations found in ${directory}`)

  const versions = new Set<string>()
  return Promise.all(filenames.map(async (filename) => {
    const match = migrationName.exec(filename)
    const version = match?.[1]
    if (!version || versions.has(version)) throw new Error(`Duplicate or invalid migration version: ${filename}`)
    versions.add(version)
    const sql = await readFile(new URL(filename, directoryUrl), 'utf8')
    return {
      version,
      filename,
      checksum: createHash('sha256').update(sql).digest('hex'),
      sql,
    }
  }))
}

export async function runMigrations(sql: Sql, migrations: readonly MigrationFile[]): Promise<string[]> {
  return sql.begin(async (transaction) => {
    await transaction`select pg_advisory_xact_lock(hashtext('keywall:schema-migrations'))`
    await transaction`
      create table if not exists schema_migrations (
        version text primary key,
        filename text not null,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `
    await transaction`revoke all on schema_migrations from public`

    const appliedRows = await transaction<Array<{ version: string; checksum: string }>>`
      select version, checksum from schema_migrations
    `
    const applied = new Map(appliedRows.map((row) => [row.version, row.checksum]))
    const completed: string[] = []

    for (const migration of migrations) {
      const recordedChecksum = applied.get(migration.version)
      if (recordedChecksum && recordedChecksum !== migration.checksum) {
        throw new Error(`Applied migration ${migration.filename} has been modified.`)
      }
      if (recordedChecksum) continue

      await transaction.unsafe(migration.sql)
      await transaction`
        insert into schema_migrations (version, filename, checksum)
        values (${migration.version}, ${migration.filename}, ${migration.checksum})
      `
      completed.push(migration.filename)
    }

    return completed
  })
}
