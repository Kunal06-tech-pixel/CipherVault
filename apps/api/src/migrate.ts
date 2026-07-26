import postgres from 'postgres'
import { loadDatabaseUrl } from './config'
import { loadMigrationFiles, runMigrations } from './migrations'

const sql = postgres(loadDatabaseUrl(), { max: 1, onnotice: () => undefined })

try {
  const migrations = await loadMigrationFiles(new URL('../migrations/', import.meta.url))
  const applied = await runMigrations(sql, migrations)
  console.log(applied.length ? `Applied migrations: ${applied.join(', ')}` : 'Database schema is current.')
} finally {
  await sql.end()
}
