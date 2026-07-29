import { readFileSync } from 'node:fs'
import { Worker } from 'bullmq'
import { SMTPClient } from 'emailjs'
import { brand } from '@keywall/brand'
import postgres from 'postgres'
import { z } from 'zod'
import { runMaintenance } from './maintenance'
import { AccountPurger } from './account-purge'

function secret(name: string): string | undefined {
  const file = process.env[`${name}_FILE`]
  return file ? readFileSync(file, 'utf8').trim() : process.env[name]
}

const isProduction = process.env.NODE_ENV === 'production'

const config = z.object({
  redisUrl: z.string().min(1),
  databaseUrl: z.string().min(1),
  smtpHost: z.string(),
  smtpPort: z.number().int().positive(),
  smtpFrom: z.string().email(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  s3Endpoint: z.string().url(),
  s3Region: z.string(),
  s3Bucket: z.string(),
  s3AccessKey: z.string(),
  s3SecretKey: z.string(),
}).parse({
  redisUrl: secret('REDIS_URL') ?? 'redis://localhost:6379',
  databaseUrl: secret('DATABASE_URL') ?? 'postgres://keywall:keywall@localhost:5432/keywall',
  smtpHost: process.env.SMTP_HOST ?? 'localhost',
  smtpPort: Number(process.env.SMTP_PORT ?? 1025),
  smtpFrom: process.env.SMTP_FROM ?? brand.smtpFrom,
  smtpUser: process.env.SMTP_USER,
  smtpPassword: secret('SMTP_PASSWORD'),
  s3Endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  s3Region: process.env.S3_REGION ?? 'us-east-1',
  s3Bucket: process.env.S3_BUCKET ?? `${brand.slug}-attachments`,
  s3AccessKey: secret('S3_ACCESS_KEY') ?? (isProduction ? undefined : brand.slug),
  s3SecretKey: secret('S3_SECRET_KEY') ?? (isProduction ? undefined : 'development-minio-password'),
})

const database = postgres(config.databaseUrl, { max: 2 })
const accountPurger = new AccountPurger({
  endpoint: config.s3Endpoint,
  region: config.s3Region,
  bucket: config.s3Bucket,
  accessKey: config.s3AccessKey,
  secretKey: config.s3SecretKey,
})

const emailWorker = new Worker('keywall-email', async (job) => {
  if (!['verification', 'recovery'].includes(job.name)) throw new Error(`Unsupported email job: ${job.name}`)
  const payload = z.object({ email: z.string().email(), url: z.string().url() }).parse(job.data)
  const client = new SMTPClient({
    host: config.smtpHost,
    port: config.smtpPort,
    ...(config.smtpUser ? { user: config.smtpUser } : {}),
    ...(config.smtpPassword ? { password: config.smtpPassword } : {}),
    tls: config.smtpPort !== 1025,
    timeout: 10_000,
  })
  try {
    await client.sendAsync({
      from: config.smtpFrom,
      to: payload.email,
      subject: job.name === 'recovery' ? `Recover your ${brand.productName} account` : `Verify your ${brand.productName} account`,
      text: job.name === 'recovery' ? `Continue recovery within 30 minutes: ${payload.url}\n\nYour offline recovery key is also required.` : `Verify your ${brand.productName} account within 30 minutes: ${payload.url}`,
      attachment: [{ data: job.name === 'recovery' ? `<p>Continue recovery within 30 minutes.</p><p><a href="${payload.url}">Recover account</a></p><p>Your offline recovery key is also required.</p>` : `<p>Verify your ${brand.productName} account within 30 minutes.</p><p><a href="${payload.url}">Verify account</a></p>`, alternative: true }],
    })
  } finally {
    client.smtp.close()
  }
}, { connection: { url: config.redisUrl }, concurrency: 5 })

const maintenance = async () => {
  const result = await runMaintenance(database)
  const accountsPurged = await accountPurger.purge(database)
  console.info('maintenance_completed', { ...result, accountsPurged })
}

const maintenanceTimer = setInterval(() => {
  void maintenance().catch(() => console.error('maintenance_failed'))
}, 60 * 60_000)
await maintenance()

const shutdown = async () => {
  clearInterval(maintenanceTimer)
  await emailWorker.close()
  await database.end({ timeout: 5 })
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown())
process.on('SIGINT', () => void shutdown())
console.log('Keywall worker started with redacted operational logging.')
