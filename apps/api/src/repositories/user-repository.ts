import type { Sql } from 'postgres'
import type { WrappedVaultKey } from '@ciphervault/contracts'
import type { CreateUserInput, StoredUser } from './types'

export class UserRepository {
  constructor(private readonly sql: Sql) {}

  async findByEmail(email: string): Promise<StoredUser | null> {
    const rows = await this.sql<StoredUser[]>`
      select id, email, email_verified_at, auth_verifier_hash, kdf, kdf_salt,
             wrapped_vault_key, recovery_wrapped_vault_key
      from users where email = ${email} and deleted_at is null limit 1
    `
    return rows[0] ?? null
  }

  async findById(id: string): Promise<StoredUser | null> {
    const rows = await this.sql<StoredUser[]>`
      select id, email, email_verified_at, auth_verifier_hash, kdf, kdf_salt,
             wrapped_vault_key, recovery_wrapped_vault_key
      from users where id = ${id} and deleted_at is null limit 1
    `
    return rows[0] ?? null
  }

  async create(input: CreateUserInput, verificationTokenHash: string): Promise<StoredUser | null> {
    return this.sql.begin(async (transaction) => {
      const rows = await transaction<StoredUser[]>`
        insert into users (
          email, auth_verifier_hash, kdf, kdf_salt, wrapped_vault_key, recovery_wrapped_vault_key
        ) values (
          ${input.email}, ${input.authVerifierHash}, ${transaction.json(input.wrappedVaultKey.kdf)},
          ${input.wrappedVaultKey.salt}, ${transaction.json(input.wrappedVaultKey)},
          ${transaction.json(input.recoveryWrappedVaultKey)}
        ) on conflict (email) do nothing
        returning id, email, email_verified_at, auth_verifier_hash, kdf, kdf_salt,
                  wrapped_vault_key, recovery_wrapped_vault_key
      `
      const user = rows[0]
      if (!user) return null
      await transaction`
        insert into email_verification_tokens (user_id, token_hash, expires_at)
        values (${user.id}, ${verificationTokenHash}, now() + interval '30 minutes')
      `
      return user
    })
  }

  async verifyEmail(tokenHash: string): Promise<boolean> {
    return this.sql.begin(async (transaction) => {
      const tokens = await transaction<{ id: string; userId: string }[]>`
        delete from email_verification_tokens
        where token_hash = ${tokenHash} and used_at is null and expires_at > now()
        returning id, user_id
      `
      const token = tokens[0]
      if (!token) return false
      await transaction`update users set email_verified_at = now(), updated_at = now() where id = ${token.userId}`
      return true
    })
  }

  async createRecoveryRequest(userId: string, tokenHash: string): Promise<void> {
    await this.sql.begin(async (transaction) => {
      await transaction`select id from users where id = ${userId} and deleted_at is null for update`
      await transaction`delete from recovery_requests where user_id = ${userId} and completed_at is null`
      await transaction`
        insert into recovery_requests (user_id, token_hash, expires_at)
        values (${userId}, ${tokenHash}, now() + interval '30 minutes')
      `
    })
  }

  async recoveryChallenge(tokenHash: string): Promise<{
    userId: string
    email: string
    recoveryWrappedVaultKey: StoredUser['recoveryWrappedVaultKey']
  } | null> {
    const rows = await this.sql<Array<{
      userId: string
      email: string
      recoveryWrappedVaultKey: StoredUser['recoveryWrappedVaultKey']
    }>>`
      select r.user_id, u.email, u.recovery_wrapped_vault_key
      from recovery_requests r join users u on u.id = r.user_id
      where r.token_hash = ${tokenHash} and r.completed_at is null and r.expires_at > now() and u.deleted_at is null
      limit 1
    `
    return rows[0] ?? null
  }

  async completeRecovery(tokenHash: string, authVerifierHash: string, wrappedVaultKey: WrappedVaultKey): Promise<boolean> {
    return this.sql.begin(async (transaction) => {
      const requests = await transaction<{ id: string; userId: string }[]>`
        update recovery_requests set completed_at = now()
        where token_hash = ${tokenHash} and completed_at is null and expires_at > now()
        returning id, user_id
      `
      const request = requests[0]
      if (!request) return false
      await transaction`
        update users set auth_verifier_hash = ${authVerifierHash}, kdf = ${transaction.json(wrappedVaultKey.kdf)},
          kdf_salt = ${wrappedVaultKey.salt}, wrapped_vault_key = ${transaction.json(wrappedVaultKey)}, updated_at = now()
        where id = ${request.userId}
      `
      await transaction`update sessions set revoked_at = now() where user_id = ${request.userId} and revoked_at is null`
      return true
    })
  }

  async scheduleDeletion(userId: string, sessionId: string, confirmationEmail: string): Promise<
    'scheduled' | 'reauthentication_required' | 'confirmation_mismatch'
  > {
    return this.sql.begin(async (transaction) => {
      const rows = await transaction<Array<{ email: string; reauthenticatedAt: Date | null }>>`
        select u.email, s.reauthenticated_at
        from users u join sessions s on s.user_id = u.id
        where u.id = ${userId} and s.id = ${sessionId} and u.deleted_at is null
          and s.revoked_at is null and s.expires_at > now()
        for update of u, s
      `
      const account = rows[0]
      if (!account?.reauthenticatedAt || account.reauthenticatedAt.getTime() < Date.now() - 5 * 60_000) {
        return 'reauthentication_required'
      }
      if (account.email.toLowerCase() !== confirmationEmail.toLowerCase()) return 'confirmation_mismatch'
      await transaction`
        update users set deleted_at = now(), purge_after = now() + interval '7 days', updated_at = now()
        where id = ${userId}
      `
      await transaction`update sessions set revoked_at = now() where user_id = ${userId} and revoked_at is null`
      return 'scheduled'
    })
  }
}
