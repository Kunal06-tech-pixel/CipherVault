import { createCipheriv, randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const outputDirectory = resolve(process.argv[2] ?? `backups/${new Date().toISOString().replaceAll(':', '-')}`)
const key = Buffer.from((await readFile(resolve('infra/secrets/backup_key.txt'), 'utf8')).trim(), 'base64url')
if (key.length !== 32) throw new Error('infra/secrets/backup_key.txt must contain 32 base64url-encoded bytes')

function run(arguments_) {
  const result = spawnSync('docker', arguments_, { encoding: null, maxBuffer: 1024 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(Buffer.from(result.stderr ?? '').toString() || `docker ${arguments_.join(' ')} failed`)
  return Buffer.from(result.stdout)
}

function encrypt(payload, context) {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  // Backup AAD is a protocol identifier; keep the legacy slug for restore compatibility.
  cipher.setAAD(Buffer.from(`ciphervault-backup:${context}:v1`))
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()])
  return Buffer.concat([Buffer.from('CVBK1'), nonce, cipher.getAuthTag(), ciphertext])
}

await mkdir(outputDirectory, { recursive: true })
const database = run(['compose', '-f', 'infra/docker-compose.yml', 'exec', '-T', 'postgres',
  'pg_dump', '-U', 'keywall', '-d', 'keywall', '-Fc', '--no-owner', '--no-acl'])
const minioContainer = run(['compose', '-f', 'infra/docker-compose.yml', 'ps', '-q', 'minio']).toString().trim()
if (!minioContainer) throw new Error('MinIO container is not running')
const objects = run(['run', '--rm', '--volumes-from', minioContainer, 'alpine:3.21',
  'tar', '-czf', '-', '-C', '/data', '.'])
await writeFile(resolve(outputDirectory, 'postgres.dump.cvbk'), encrypt(database, 'postgres'))
await writeFile(resolve(outputDirectory, 'objects.tar.gz.cvbk'), encrypt(objects, 'objects'))
await writeFile(resolve(outputDirectory, 'manifest.json'), JSON.stringify({
  format: 1, createdAt: new Date().toISOString(), databaseBytes: database.length, objectBytes: objects.length,
}, null, 2))
console.log(`Encrypted Compose backup written to ${outputDirectory}`)
