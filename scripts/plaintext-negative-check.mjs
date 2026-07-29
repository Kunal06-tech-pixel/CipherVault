import { spawnSync } from 'node:child_process'

const marker = process.env.CV_FORBIDDEN_MARKER
if (!marker || marker.length < 12) throw new Error('Set CV_FORBIDDEN_MARKER to a 12+ character test plaintext that was never sent to the API')
function output(arguments_) {
  const result = spawnSync('docker', arguments_, { encoding: null, maxBuffer: 1024 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(Buffer.from(result.stderr ?? '').toString())
  return Buffer.from(result.stdout)
}
const minioContainer = output(['compose', '-f', 'infra/docker-compose.yml', 'ps', '-q', 'minio']).toString().trim()
if (!minioContainer) throw new Error('MinIO container is not running')
const surfaces = {
  logs: output(['compose', '-f', 'infra/docker-compose.yml', 'logs', '--no-color', 'api', 'worker']),
  database: output(['compose', '-f', 'infra/docker-compose.yml', 'exec', '-T', 'postgres',
    'pg_dump', '-U', 'keywall', '-d', 'keywall', '--inserts']),
  objectStorage: output(['run', '--rm', '--volumes-from', minioContainer, 'alpine:3.21',
    'tar', '-cf', '-', '-C', '/data', '.']),
}
const failures = Object.entries(surfaces).filter(([, bytes]) => bytes.includes(Buffer.from(marker))).map(([name]) => name)
if (failures.length) throw new Error(`Forbidden plaintext marker found in: ${failures.join(', ')}`)
console.log(JSON.stringify({ ok: true, checked: Object.keys(surfaces) }))
