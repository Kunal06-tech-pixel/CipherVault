import type { FastifyReply, FastifyRequest } from 'fastify'
import type { StoredUser } from './database'
import type { ApiContext } from './api-context'
import { clientIpHash } from './request-policy'
import { opaqueToken, sha256 } from './security'
import { browserSessionSameSite } from './cookies'

export async function issueBrowserSession(
  context: ApiContext,
  user: StoredUser,
  deviceName: string,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const sessionToken = opaqueToken()
  const csrfToken = opaqueToken()
  const session = await context.database.createSession(
    user.id,
    sha256(sessionToken),
    sha256(csrfToken),
    deviceName,
  )
  reply.setCookie(context.sessionCookie, sessionToken, {
    path: '/',
    httpOnly: true,
    secure: context.config.cookieSecure,
    sameSite: browserSessionSameSite(context.config),
    maxAge: 12 * 60 * 60,
  })
  await context.database.writeSecurityEvent(user.id, 'login_succeeded', {
    sessionId: session.id,
    ip: clientIpHash(request, context.config),
  })
  return { csrfToken, wrappedVaultKey: user.wrappedVaultKey, email: user.email }
}
