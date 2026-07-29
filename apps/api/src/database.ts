import postgres, { type Sql } from 'postgres'
import type { SyncMutation, WrappedVaultKey } from '@keywall/contracts'
import { AttachmentRepository } from './repositories/attachment-repository'
import { SecurityEventRepository } from './repositories/security-event-repository'
import { SessionRepository } from './repositories/session-repository'
import { SyncRepository } from './repositories/sync-repository'
import { UserRepository } from './repositories/user-repository'
import { MfaRepository } from './repositories/mfa-repository'
import { ExtensionRepository, type ExtensionGrant } from './repositories/extension-repository'
import type { CreateUserInput, StoredAttachment, StoredMfaChallenge } from './repositories/types'

export type {
  CreateUserInput,
  StoredAttachment,
  StoredSession,
  StoredUser,
  SyncResult,
} from './repositories/types'

export class Database {
  readonly sql: Sql
  private readonly users: UserRepository
  private readonly sessions: SessionRepository
  private readonly sync: SyncRepository
  private readonly attachments: AttachmentRepository
  private readonly securityEvents: SecurityEventRepository
  private readonly mfa: MfaRepository
  private readonly extension: ExtensionRepository

  constructor(databaseUrl: string, max = 10) {
    this.sql = postgres(databaseUrl, {
      max,
      idle_timeout: 20,
      connect_timeout: 10,
      transform: postgres.camel,
      onnotice: () => undefined,
    })
    this.users = new UserRepository(this.sql)
    this.sessions = new SessionRepository(this.sql)
    this.sync = new SyncRepository(this.sql)
    this.attachments = new AttachmentRepository(this.sql)
    this.securityEvents = new SecurityEventRepository(this.sql)
    this.mfa = new MfaRepository(this.sql)
    this.extension = new ExtensionRepository(this.sql)
  }

  async close(): Promise<void> { await this.sql.end({ timeout: 5 }) }
  async ping(): Promise<void> { await this.sql`select 1` }

  findUserByEmail(email: string) { return this.users.findByEmail(email) }
  findUserById(id: string) { return this.users.findById(id) }
  createUser(input: CreateUserInput, verificationTokenHash: string) {
    return this.users.create(input, verificationTokenHash)
  }
  verifyEmail(tokenHash: string) { return this.users.verifyEmail(tokenHash) }
  createRecoveryRequest(userId: string, tokenHash: string) {
    return this.users.createRecoveryRequest(userId, tokenHash)
  }
  recoveryChallenge(tokenHash: string) { return this.users.recoveryChallenge(tokenHash) }
  completeRecovery(tokenHash: string, authVerifierHash: string, wrappedVaultKey: WrappedVaultKey) {
    return this.users.completeRecovery(tokenHash, authVerifierHash, wrappedVaultKey)
  }
  scheduleAccountDeletion(userId: string, sessionId: string, confirmationEmail: string) {
    return this.users.scheduleDeletion(userId, sessionId, confirmationEmail)
  }

  createSession(userId: string, tokenHash: string, csrfHash: string, deviceName: string) {
    return this.sessions.create(userId, tokenHash, csrfHash, deviceName)
  }
  findSession(tokenHash: string) { return this.sessions.find(tokenHash) }
  revokeSession(sessionId: string, userId: string) { return this.sessions.revoke(sessionId, userId) }
  markSessionReauthenticated(sessionId: string, userId: string) {
    return this.sessions.markReauthenticated(sessionId, userId)
  }
  listSessions(userId: string, currentId: string) { return this.sessions.list(userId, currentId) }

  listMfaFactors(userId: string) { return this.mfa.listEnabled(userId) }
  createTotpFactor(userId: string, label: string, credential: Record<string, unknown>) {
    return this.mfa.createTotp(userId, label, credential)
  }
  findMfaFactor(userId: string, factorId: string) { return this.mfa.findFactor(userId, factorId) }
  confirmTotpFactor(userId: string, factorId: string, recoveryCodeHashes: string[]) {
    return this.mfa.confirmTotp(userId, factorId, recoveryCodeHashes)
  }
  createMfaLoginChallenge(userId: string, tokenHash: string, deviceName: string) {
    return this.mfa.createLoginChallenge(userId, tokenHash, deviceName)
  }
  findMfaChallenge(tokenHash: string, purpose: StoredMfaChallenge['purpose']) {
    return this.mfa.activeChallenge(tokenHash, purpose)
  }
  recordMfaFailure(id: string) { return this.mfa.recordFailedAttempt(id) }
  consumeMfaChallenge(id: string) { return this.mfa.consumeChallenge(id) }
  setMfaChallengeValue(id: string, challenge: string) { return this.mfa.setChallengeValue(id, challenge) }
  createPasskeyChallenge(userId: string, tokenHash: string, label: string, challenge: string) {
    return this.mfa.createRegistrationChallenge(userId, tokenHash, label, challenge)
  }
  addPasskey(
    challengeId: string,
    userId: string,
    label: string,
    credential: Record<string, unknown>,
    recoveryCodeHashes: string[],
  ) {
    return this.mfa.addPasskey(challengeId, userId, label, credential, recoveryCodeHashes)
  }
  markMfaFactorUsed(factorId: string, counter?: number) { return this.mfa.markFactorUsed(factorId, counter) }
  consumeMfaRecoveryCode(userId: string, codeHash: string) { return this.mfa.consumeRecoveryCode(userId, codeHash) }
  disableMfaFactor(userId: string, factorId: string) { return this.mfa.disableFactor(userId, factorId) }

  createExtensionGrant(input: {
    userId: string; codeHash: string; pkceChallenge: string
    devicePublicKey: ExtensionGrant['devicePublicKey']; label: string
  }) { return this.extension.createGrant(input) }
  approveExtensionGrant(userId: string, codeHash: string, wrappedVaultKey: string) {
    return this.extension.approveGrant(userId, codeHash, wrappedVaultKey)
  }
  findExtensionGrant(codeHash: string) { return this.extension.findGrant(codeHash) }
  exchangeExtensionGrant(grantId: string, refreshTokenHash: string, accessTokenHash: string) {
    return this.extension.exchangeGrant(grantId, refreshTokenHash, accessTokenHash)
  }
  findExtensionDevice(refreshTokenHash: string) { return this.extension.findDevice(refreshTokenHash) }
  acceptExtensionDeviceProof(deviceId: string, timestamp: number) {
    return this.extension.acceptDeviceProof(deviceId, timestamp)
  }
  rotateExtensionAccessToken(deviceId: string, userId: string, tokenHash: string) {
    return this.extension.rotateAccessToken(deviceId, userId, tokenHash)
  }
  authenticateExtensionToken(tokenHash: string) { return this.extension.authenticateAccessToken(tokenHash) }
  listExtensionDevices(userId: string) { return this.extension.listDevices(userId) }
  revokeExtensionDevice(userId: string, deviceId: string) { return this.extension.revokeDevice(userId, deviceId) }

  pageChanges(userId: string, cursor: number, limit: number) {
    return this.sync.pageChanges(userId, cursor, limit)
  }
  applyMutations(userId: string, mutations: SyncMutation[]) {
    return this.sync.applyMutations(userId, mutations)
  }

  reserveAttachment(input: Omit<StoredAttachment, 'status' | 'userId'>, userId: string) {
    return this.attachments.reserve(input, userId)
  }
  findAttachment(id: string, userId: string) { return this.attachments.find(id, userId) }
  completeAttachment(id: string, userId: string, chunkHashes: string[]) {
    return this.attachments.complete(id, userId, chunkHashes)
  }
  deleteAttachment(id: string, userId: string) { return this.attachments.delete(id, userId) }

  writeSecurityEvent(userId: string | null, event: string, metadata: Record<string, unknown> = {}) {
    return this.securityEvents.write(userId, event, metadata)
  }
}
