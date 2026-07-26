import postgres from 'postgres'
import { loadDatabaseUrl } from './config'
import { loadMigrationFiles, runMigrations } from './migrations'

async function run(): Promise<void> {
  const url = loadDatabaseUrl()
  const migrations = await loadMigrationFiles(new URL('../migrations/', import.meta.url))
  let success = false

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    let sql: ReturnType<typeof postgres> | undefined
    try {
      sql = postgres(url, { max: 1, onnotice: () => undefined, connect_timeout: 10 })
      await sql`select 1`
      const applied = await runMigrations(sql, migrations)
      console.log(applied.length ? `Applied migrations: ${applied.join(', ')}` : 'Database schema is current.')
      success = true
      break
    } catch (error) {
      console.log(`Migration attempt ${attempt}/30 failed (${(error as Error)?.message}). Retrying in 2s...`)
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } finally {
      if (sql) await sql.end().catch(() => undefined)
    }
  }

  if (!success) {
    throw new Error('Database migration failed after 30 attempts.')
  }
}

await run()
