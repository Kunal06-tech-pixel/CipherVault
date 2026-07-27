import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import type { AppConfig } from './config'
import { Database } from './database'
import { EmailService } from './email'
import { AttachmentStorage } from './attachments'
import { allowedWebOrigins, isAllowedMutationOrigin, isExtensionOrigin } from './origins'
import { constantTimeEqual, sha256 } from './security'
import type { ApiContext, ApiDependencies } from './api-context'
import { clientIpHash, isDependencyUnavailable, PUBLIC_AUTH_MUTATIONS } from './request-policy'
import { registerAttachmentRoutes } from './routes/attachments'
import { registerAuthRoutes } from './routes/auth'
import { registerHealthRoutes } from './routes/health'
import { registerSessionRoutes } from './routes/sessions'
import { registerSyncRoutes } from './routes/sync'
import { registerPasswordHealthRoutes } from './routes/password-health'
import { registerMfaRoutes } from './routes/mfa'
import { registerExtensionRoutes } from './routes/extension'

export type { ApiDependencies } from './api-context'

export async function buildApp(config: AppConfig, overrides: Partial<ApiDependencies> = {}): Promise<FastifyInstance> {
  const sessionCookie = config.cookieSecure ? '__Host-cv_session' : 'cv_session'
  const app = Fastify({
    logger: {
      level: config.nodeEnv === 'test' ? 'silent' : 'info',
      redact: [
        'req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie',
        '*.authKey', '*.ciphertext', '*.token', '*.recoveryKey', '*.password',
      ],
    },
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: config.nodeEnv === 'production' ? 1 : false,
    genReqId: () => crypto.randomUUID(),
  })
  const context: ApiContext = {
    config,
    sessionCookie,
    database: overrides.database ?? new Database(config.databaseUrl),
    email: overrides.email ?? new EmailService(config),
    attachments: config.attachmentsEnabled ? overrides.attachments ?? new AttachmentStorage(config) : overrides.attachments,
  }
  const webOrigins = allowedWebOrigins(config)

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'request_failed')
    if (isDependencyUnavailable(error)) return reply.code(503).send({ error: 'service_unavailable' })
    const failure = error as { statusCode?: number; code?: string }
    const statusCode = failure.statusCode && failure.statusCode >= 400 ? failure.statusCode : 500
    return reply.code(statusCode).send({ error: statusCode >= 500 ? 'request_failed' : failure.code ?? 'request_failed' })
  })

  await app.register(cookie)
  await app.register(cors, {
    origin: (origin, callback) => callback(null, !origin || webOrigins.includes(origin) || isExtensionOrigin(origin)),
    credentials: true,
    allowedHeaders: ['content-type', 'x-cv-csrf'],
  })
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: true,
  })
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    keyGenerator: (request) => `${clientIpHash(request, config)}:${request.routeOptions.url}`,
  })

  app.decorateRequest('auth', null)
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    reply.header('Pragma', 'no-cache')
    const token = request.cookies[sessionCookie]
    if (!token) return
    const session = await context.database.findSession(sha256(token))
    if (!session) return
    const user = await context.database.findUserById(session.userId)
    if (user) request.auth = { session, user }
  })

  app.addHook('preHandler', async (request, reply) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return
    const extensionPublicRoute = request.routeOptions.url === '/v1/extension/token' || request.routeOptions.url === '/v1/extension/token/refresh'
    if (!isAllowedMutationOrigin(request.headers.origin, webOrigins) && !(extensionPublicRoute && isExtensionOrigin(request.headers.origin))) {
      return reply.code(403).send({ error: 'origin_rejected' })
    }
    if (request.routeOptions.url && PUBLIC_AUTH_MUTATIONS.has(request.routeOptions.url)) return
    if (!request.auth) return reply.code(401).send({ error: 'authentication_required' })
    const csrf = request.headers['x-cv-csrf']
    if (typeof csrf !== 'string' || !constantTimeEqual(sha256(csrf), request.auth.session.csrfHash)) {
      return reply.code(403).send({ error: 'csrf_rejected' })
    }
  })

  registerHealthRoutes(app, context)
  registerAuthRoutes(app, context)
  registerSessionRoutes(app, context)
  registerSyncRoutes(app, context)
  if (config.attachmentsEnabled) registerAttachmentRoutes(app, context)
  registerPasswordHealthRoutes(app, context)
  registerMfaRoutes(app, context)
  registerExtensionRoutes(app, context)

  app.addHook('onClose', async () => context.database.close())
  return app
}
