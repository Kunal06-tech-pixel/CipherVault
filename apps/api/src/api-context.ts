import type { FastifyReply, FastifyRequest } from 'fastify'
import type { AppConfig } from './config'
import type { Database } from './database'
import type { EmailService } from './email'
import type { AttachmentStorage } from './attachments'

export interface ApiDependencies {
  database: Pick<Database,
    'close' | 'ping' | 'findUserByEmail' | 'findUserById' | 'createUser' | 'verifyEmail' |
    'createRecoveryRequest' | 'recoveryChallenge' | 'completeRecovery' | 'createSession' |
    'scheduleAccountDeletion' |
    'listMfaFactors' | 'createTotpFactor' | 'findMfaFactor' | 'confirmTotpFactor' |
    'createMfaLoginChallenge' | 'findMfaChallenge' | 'recordMfaFailure' | 'consumeMfaChallenge' |
    'setMfaChallengeValue' | 'createPasskeyChallenge' | 'addPasskey' | 'markMfaFactorUsed' |
    'consumeMfaRecoveryCode' | 'disableMfaFactor' |
    'createExtensionGrant' | 'approveExtensionGrant' | 'findExtensionGrant' | 'exchangeExtensionGrant' |
    'findExtensionDevice' | 'acceptExtensionDeviceProof' | 'rotateExtensionAccessToken' | 'authenticateExtensionToken' |
    'listExtensionDevices' | 'revokeExtensionDevice' |
    'findSession' | 'revokeSession' | 'markSessionReauthenticated' | 'listSessions' | 'pageChanges' | 'applyMutations' |
    'reserveAttachment' | 'findAttachment' | 'completeAttachment' | 'deleteAttachment' |
    'writeSecurityEvent'>
  email: Pick<EmailService, 'sendVerification' | 'sendRecovery' | 'diagnostics'>
  attachments: Pick<AttachmentStorage,
    'ensureBucket' | 'uploadUrls' | 'verifyChunks' | 'downloadUrls' | 'deleteChunks'>
}

export interface ApiContext extends ApiDependencies {
  config: AppConfig
  sessionCookie: string
}

export async function requireAuthentication(request: FastifyRequest, reply: FastifyReply) {
  if (!request.auth) return reply.code(401).send({ error: 'authentication_required' })
}
