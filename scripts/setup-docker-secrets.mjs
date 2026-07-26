import { randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, rmdir, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const secretDirectory = resolve('infra/secrets')

async function readSecret(name) {
  const path = resolve(secretDirectory, `${name}.txt`)
  try {
    const metadata = await stat(path)
    if (metadata.isDirectory()) {
      const entries = await readdir(path)
      if (entries.length) throw new Error(`${name}.txt is a non-empty directory; refusing to replace it.`)
      await rmdir(path)
      return ''
    }
    return (await readFile(path, 'utf8')).trim()
  } catch (error) {
    if (error?.code === 'ENOENT') return ''
    throw error
  }
}

async function ensureSecret(name, bytes = 48) {
  const existing = await readSecret(name)
  if (existing) return existing
  const value = randomBytes(bytes).toString('base64url')
  await writeFile(resolve(secretDirectory, `${name}.txt`), `${value}\n`, { mode: 0o644 })
  return value
}

await mkdir(secretDirectory, { recursive: true })

const postgresPassword = await ensureSecret('postgres_password')
await ensureSecret('auth_pepper')
await ensureSecret('prelogin_secret')
await ensureSecret('mfa_encryption_key', 32)
await ensureSecret('backup_key', 32)
await ensureSecret('minio_password')

const expectedDatabaseUrl = `postgres://ciphervault:${encodeURIComponent(postgresPassword)}@postgres:5432/ciphervault`
const existingDatabaseUrl = await readSecret('database_url')
if (existingDatabaseUrl && existingDatabaseUrl !== expectedDatabaseUrl) {
  throw new Error('database_url.txt does not match postgres_password.txt. Reconcile them before starting Compose.')
}
if (!existingDatabaseUrl) {
  await writeFile(resolve(secretDirectory, 'database_url.txt'), `${expectedDatabaseUrl}\n`, { mode: 0o644 })
}

console.log('Docker secrets are present and internally consistent. Existing non-empty secrets were preserved.')
