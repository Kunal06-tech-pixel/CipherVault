import { createDecipheriv, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const directory = process.argv[2]
if (!directory) throw new Error('Usage: node scripts/restore-drill.mjs <backup-directory>')
const key = Buffer.from((await readFile(resolve('infra/secrets/backup_key.txt'), 'utf8')).trim(), 'base64url')
function decrypt(payload, context) {
  if (payload.subarray(0, 5).toString() !== 'CVBK1') throw new Error('Invalid backup format')
  const decipher = createDecipheriv('aes-256-gcm', key, payload.subarray(5, 17))
  decipher.setAAD(Buffer.from(`ciphervault-backup:${context}:v1`)); decipher.setAuthTag(payload.subarray(17, 33))
  return Buffer.concat([decipher.update(payload.subarray(33)), decipher.final()])
}
function run(arguments_, input) {
  const result = spawnSync('docker', arguments_, { input, encoding: null, maxBuffer: 1024 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(Buffer.from(result.stderr ?? '').toString() || `docker ${arguments_.join(' ')} failed`)
  return Buffer.from(result.stdout)
}

const database = decrypt(await readFile(resolve(directory, 'postgres.dump.cvbk')), 'postgres')
const objects = decrypt(await readFile(resolve(directory, 'objects.tar.gz.cvbk')), 'objects')
const name = `ciphervault-restore-${randomBytes(4).toString('hex')}`
try {
  run(['run', '--rm', '-i', 'alpine:3.21', 'tar', '-tzf', '-'], objects)
  run(['run', '-d', '--name', name, '-e', 'POSTGRES_PASSWORD=restore-only-password', 'postgres:17-alpine'])
  let ready = false
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const check = spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres'])
    if (check.status === 0) { ready = true; break }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
  }
  if (!ready) throw new Error('Isolated restore PostgreSQL did not become ready')
  run(['exec', '-i', name, 'pg_restore', '-U', 'postgres', '-d', 'postgres',
    '--clean', '--if-exists', '--no-owner', '--no-acl'], database)
  const count = run(['exec', name, 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc',
    "select count(*) from information_schema.tables where table_schema='public'"]).toString().trim()
  if (Number(count) < 10) throw new Error(`Restore produced only ${count} public tables`)
  console.log(JSON.stringify({ ok: true, restoredTables: Number(count), objectArchiveBytes: objects.length }))
} finally {
  spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' })
}
