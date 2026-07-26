import { readFileSync } from 'node:fs'
import { z } from 'zod'

function secret(name: string, fallback?: string): string | undefined {
  const file = process.env[`${name}_FILE`]
  if (file) return readFileSync(file, 'utf8').trim()
  return process.env[name] ?? fallback
}

const isProduction = process.env.NODE_ENV === 'production'

const schema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']),
  host: z.string(),
  port: z.number().int().positive(),
  publicOrigin: z.string().url(),
  databaseUrl: z.string().min(1),
  authPepper: z.string().min(32),
  preloginSecret: z.string().min(32),
  mfaEncryptionKey: z.string().refine((value) => {
    try { return Buffer.from(value, 'base64url').length === 32 } catch { return false }
  }, 'MFA_ENCRYPTION_KEY must be 32 random bytes encoded as base64url'),
  cookieSecure: z.boolean(),
  allowUnverifiedLogin: z.boolean(),
  smtpHost: z.string(),
  smtpPort: z.number().int().positive(),
  smtpFrom: z.string().email(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  redisUrl: z.string().optional(),
  emailDelivery: z.enum(['direct', 'queue']),
  s3Endpoint: z.string().url(),
  s3PublicEndpoint: z.string().url(),
  s3Region: z.string(),
  s3Bucket: z.string(),
  s3AccessKey: z.string(),
  s3SecretKey: z.string(),
})

export type AppConfig = z.infer<typeof schema>

export function loadDatabaseUrl(): string {
  return z.string().min(1).parse(
    secret('DATABASE_URL', 'postgres://ciphervault:ciphervault@localhost:5432/ciphervault'),
  )
}

export function loadConfig(): AppConfig {
  return schema.parse({
    nodeEnv: process.env.NODE_ENV ?? 'development',
    host: process.env.HOST ?? '0.0.0.0',
    port: Number(process.env.PORT ?? 3001),
    publicOrigin: process.env.PUBLIC_ORIGIN ?? 'http://localhost:5173',
    databaseUrl: loadDatabaseUrl(),
    authPepper: secret('AUTH_PEPPER', isProduction ? undefined : 'development-auth-pepper-change-before-production'),
    preloginSecret: secret('PRELOGIN_SECRET', isProduction ? undefined : 'development-prelogin-secret-change-production'),
    mfaEncryptionKey: secret(
      'MFA_ENCRYPTION_KEY',
      isProduction ? undefined : Buffer.alloc(32, 7).toString('base64url'),
    ),
    cookieSecure: process.env.COOKIE_SECURE === undefined
      ? isProduction
      : process.env.COOKIE_SECURE === 'true',
    allowUnverifiedLogin: process.env.ALLOW_UNVERIFIED_LOGIN === 'true' || !isProduction,
    smtpHost: process.env.SMTP_HOST ?? 'localhost',
    smtpPort: Number(process.env.SMTP_PORT ?? 1025),
    smtpFrom: process.env.SMTP_FROM ?? 'security@ciphervault.local',
    smtpUser: process.env.SMTP_USER,
    smtpPassword: secret('SMTP_PASSWORD'),
    redisUrl: secret('REDIS_URL'),
    emailDelivery: process.env.EMAIL_DELIVERY === 'queue' ? 'queue' : 'direct',
    s3Endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    s3PublicEndpoint: process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    s3Region: process.env.S3_REGION ?? 'us-east-1',
    s3Bucket: process.env.S3_BUCKET ?? 'ciphervault-attachments',
    s3AccessKey: secret('S3_ACCESS_KEY', isProduction ? undefined : 'ciphervault'),
    s3SecretKey: secret('S3_SECRET_KEY', isProduction ? undefined : 'development-minio-password'),
  })
}
