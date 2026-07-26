import { spawn } from 'node:child_process'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const databaseDirectory = resolve('.data/pglite')
const migrationsDirectory = resolve('apps/api/migrations')
const minioSecretPath = resolve('infra/secrets/minio_password.txt')
const databaseUrl = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres'

let database
let socketServer
let services
let shuttingDown = false

async function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  if (services && services.exitCode === null) services.kill('SIGTERM')
  await socketServer?.stop().catch(() => undefined)
  await database?.close().catch(() => undefined)
  process.exitCode = exitCode
}

async function main() {
  console.log(`[database] Starting persistent local PostgreSQL at ${databaseDirectory}`)
  await mkdir(dirname(databaseDirectory), { recursive: true })
  database = await PGlite.create(databaseDirectory, {
    extensions: { pgcrypto },
  })

  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((filename) => /^\d{4,}_[a-z0-9_]+\.sql$/u.test(filename))
    .sort((left, right) => left.localeCompare(right))
  if (!migrationFiles.length) throw new Error(`No migrations found in ${migrationsDirectory}`)
  for (const filename of migrationFiles) {
    await database.exec(await readFile(resolve(migrationsDirectory, filename), 'utf8'))
  }
  console.log('[database] Schema is ready')

  socketServer = new PGLiteSocketServer({
    db: database,
    host: '127.0.0.1',
    port: 5432,
    maxConnections: 20,
  })
  await socketServer.start()
  console.log('[database] Listening on postgresql://127.0.0.1:5432/postgres')

  const minioPassword = await readFile(minioSecretPath, 'utf8').then((value) => value.trim()).catch(() => '')
  const npmCli = process.env.npm_execpath
  if (!npmCli) throw new Error('npm executable path is unavailable.')
  services = spawn(process.execPath, [npmCli, 'run', 'dev:services'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      ...(minioPassword && !process.env.S3_SECRET_KEY ? { S3_SECRET_KEY: minioPassword } : {}),
    },
    stdio: 'inherit',
  })

  services.on('error', async (error) => {
    console.error('[dev] Could not start application services:', error)
    await shutdown(1)
  })
  services.on('exit', async (code, signal) => {
    if (!shuttingDown && signal !== 'SIGTERM') await shutdown(code ?? 1)
  })
}

process.once('SIGINT', () => void shutdown(0))
process.once('SIGTERM', () => void shutdown(0))
process.once('uncaughtException', (error) => {
  console.error('[dev] Startup failed:', error)
  void shutdown(1)
})
process.once('unhandledRejection', (error) => {
  console.error('[dev] Startup failed:', error)
  void shutdown(1)
})

await main()
