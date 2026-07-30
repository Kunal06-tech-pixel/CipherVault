import { createDecipheriv, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const directoryArgument = process.argv.slice(2).find((argument) => argument && argument !== '--')
const directory = directoryArgument === '--ci-backup' ? 'ci-backup' : directoryArgument
if (!directory) throw new Error('Usage: node scripts/restore-drill.mjs <backup-directory>')
const key = Buffer.from((await readFile(resolve('infra/secrets/backup_key.txt'), 'utf8')).trim(), 'base64url')
if (key.length !== 32) throw new Error('infra/secrets/backup_key.txt must contain 32 base64url-encoded bytes')

function decrypt(payload, context) {
  if (payload.subarray(0, 5).toString() !== 'CVBK1') throw new Error('Invalid backup format')
  const decipher = createDecipheriv('aes-256-gcm', key, payload.subarray(5, 17))
  // Backup AAD is a protocol identifier; keep the legacy slug for restore compatibility.
  decipher.setAAD(Buffer.from(`ciphervault-backup:${context}:v1`))
  decipher.setAuthTag(payload.subarray(17, 33))
  return Buffer.concat([decipher.update(payload.subarray(33)), decipher.final()])
}

function run(arguments_, input) {
  const result = spawnSync('docker', arguments_, { input, encoding: null, maxBuffer: 1024 * 1024 * 1024 })
  if (result.status !== 0) {
    const stderr = Buffer.from(result.stderr ?? '').toString().trim()
    const stdout = Buffer.from(result.stdout ?? '').toString().trim()
    throw new Error([
      `docker ${arguments_.join(' ')} failed with exit code ${result.status}`,
      stderr && `stderr:\n${stderr}`,
      stdout && `stdout:\n${stdout}`,
    ].filter(Boolean).join('\n'))
  }
  return Buffer.from(result.stdout)
}

const database = decrypt(await readFile(resolve(directory, 'postgres.dump.cvbk')), 'postgres')
const objects = decrypt(await readFile(resolve(directory, 'objects.tar.gz.cvbk')), 'objects')
const name = `keywall-restore-${randomBytes(4).toString('hex')}`
const postgresPassword = 'restore-only-password'
const postgresPasswordEnv = `${'POSTGRES_PASSWORD'}=${postgresPassword}`
const postgresConnection = ['-h', '127.0.0.1', '-U', 'keywall', '-d', 'keywall']

function containerLogs() {
  const result = spawnSync('docker', ['logs', name], { encoding: null, maxBuffer: 1024 * 1024 })
  return [
    Buffer.from(result.stderr ?? '').toString().trim(),
    Buffer.from(result.stdout ?? '').toString().trim(),
  ].filter(Boolean).join('\n')
}

try {
  // Sanity-check the object archive first.
  run(['run', '--rm', '-i', 'alpine:3.21', 'tar', '-tzf', '-'], objects)

  run(['run', '-d', '--name', name,
    '-e', 'POSTGRES_USER=keywall',
    '-e', postgresPasswordEnv,
    '-e', 'POSTGRES_DB=keywall',
    'postgres:17-alpine'])

  let ready = false
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const inspect = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', name], { encoding: 'utf8' })
    const running = (inspect.stdout || inspect.stderr || '').toString().trim()
    if (running !== 'true') {
      throw new Error(`Postgres container did not stay running. logs:\n${containerLogs()}`)
    }

    const check = spawnSync('docker', ['exec', name, 'pg_isready', ...postgresConnection])
    if (check.status === 0) { ready = true; break }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000)
  }
  if (!ready) throw new Error(`Isolated restore PostgreSQL did not become ready\n${containerLogs()}`)

  try {
    run(['exec', '-i', '-e', `PGPASSWORD=${postgresPassword}`, name, 'pg_restore', ...postgresConnection,
      '--clean', '--if-exists', '--no-owner', '--no-acl'], database)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${message}\nPostgreSQL container logs:\n${containerLogs()}`)
  }

  const count = run(['exec', '-e', `PGPASSWORD=${postgresPassword}`, name, 'psql', ...postgresConnection, '-Atc',
    "select count(*) from information_schema.tables where table_schema='public'"]).toString().trim()
  if (Number(count) < 10) throw new Error(`Restore produced only ${count} public tables`)
  console.log(JSON.stringify({ ok: true, restoredTables: Number(count), objectArchiveBytes: objects.length }))
} finally {
  spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' })
}
