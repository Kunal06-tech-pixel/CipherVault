import postgres from 'postgres'
import { loadDatabaseUrl } from './config'
import { loadMigrationFiles, runMigrations } from './migrations'

async function run(): Promise<void> {
  const url = loadDatabaseUrl()
  let sql: ReturnType<typeof postgres> | undefined
  let connected = false

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      sql = postgres(url, { max: 1, onnotice: () => undefined, connect_timeout: 5 })
      await sql`select 1`
      connected = true
      break
    } catch (error) {
      if (sql) await sql.end().catch(() => undefined)
      console.log(`Database connection attempt ${attempt}/30 failed (${(error as Error)?.message}). Retrying in 1s...`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  if (!connected || !sql) {
    throw new Error('Could not connect to PostgreSQL database after 30 attempts.')
  }

  try {
    const migrations = await loadMigrationFiles(new URL('../migrations/', import.meta.url))
    const applied = await runMigrations(sql, migrations)
    console.log(applied.length ? `Applied migrations: ${applied.join(', ')}` : 'Database schema is current.')
  } finally {
    await sql.end()
  }
}

await run()
