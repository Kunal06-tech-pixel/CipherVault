import { readFileSync } from 'node:fs'
import { brand } from '@keywall/brand'
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
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().positive().optional(),
  smtpFrom: z.string().email().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  redisUrl: z.string().optional(),
  emailDelivery: z.enum(['disabled', 'direct', 'queue']),
  attachmentsEnabled: z.boolean(),
  s3Endpoint: z.string().url().optional(),
  s3PublicEndpoint: z.string().url().optional(),
  s3Region: z.string().optional(),
  s3Bucket: z.string().optional(),
  s3AccessKey: z.string().optional(),
  s3SecretKey: z.string().optional(),
}).superRefine((value, context) => {
  if (value.emailDelivery === 'direct') {
    for (const key of ['smtpHost', 'smtpPort', 'smtpFrom'] as const) {
      if (!value[key]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when EMAIL_DELIVERY=direct`,
        })
      }
    }
  }
  if (!value.attachmentsEnabled) return
  for (const key of ['s3Endpoint', 's3PublicEndpoint', 's3Region', 's3Bucket', 's3AccessKey', 's3SecretKey'] as const) {
    if (!value[key]) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required when ENABLE_ATTACHMENTS=true`,
      })
    }
  }
})

export type AppConfig = z.infer<typeof schema>

export function loadDatabaseUrl(): string {
  return z.string().min(1).parse(
    secret('DATABASE_URL', 'postgres://keywall:keywall@localhost:5432/keywall'),
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
    smtpFrom: process.env.SMTP_FROM ?? brand.smtpFrom,
    smtpUser: process.env.SMTP_USER,
    smtpPassword: secret('SMTP_PASSWORD'),
    redisUrl: secret('REDIS_URL'),
    emailDelivery: process.env.EMAIL_DELIVERY === 'queue'
      ? 'queue'
      : process.env.EMAIL_DELIVERY === 'disabled'
        ? 'disabled'
        : 'direct',
    attachmentsEnabled: process.env.ENABLE_ATTACHMENTS === undefined
      ? !isProduction
      : process.env.ENABLE_ATTACHMENTS === 'true',
    s3Endpoint: process.env.S3_ENDPOINT ?? (isProduction ? undefined : 'http://localhost:9000'),
    s3PublicEndpoint: process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT ?? (isProduction ? undefined : 'http://localhost:9000'),
    s3Region: process.env.S3_REGION ?? 'us-east-1',
    s3Bucket: process.env.S3_BUCKET ?? `${brand.slug}-attachments`,
    s3AccessKey: secret('S3_ACCESS_KEY', isProduction ? undefined : brand.slug),
    s3SecretKey: secret('S3_SECRET_KEY', isProduction ? undefined : 'development-minio-password'),
  })
}
