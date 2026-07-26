import type { Sql } from 'postgres'
import type { StoredMfaChallenge, StoredMfaFactor } from './types'

export class MfaRepository {
  constructor(private readonly sql: Sql) {}

  listEnabled(userId: string): Promise<StoredMfaFactor[]> {
    return this.sql<StoredMfaFactor[]>`
      select id, user_id, kind, label, credential, created_at, last_used_at, verified_at
      from mfa_factors
      where user_id = ${userId} and verified_at is not null and disabled_at is null
      order by created_at
    `
  }

  async createTotp(userId: string, label: string, credential: Record<string, unknown>): Promise<string> {
    const rows = await this.sql<{ id: string }[]>`
      insert into mfa_factors (user_id, kind, label, credential)
      values (${userId}, 'totp', ${label}, ${this.sql.json(credential as never)}) returning id
    `
    return rows[0]!.id
  }

  findFactor(userId: string, factorId: string): Promise<StoredMfaFactor | null> {
    return this.sql<StoredMfaFactor[]>`
      select id, user_id, kind, label, credential, created_at, last_used_at, verified_at
      from mfa_factors where id = ${factorId} and user_id = ${userId} and disabled_at is null limit 1
    `.then((rows) => rows[0] ?? null)
  }

  async confirmTotp(userId: string, factorId: string, recoveryCodeHashes: string[]): Promise<boolean> {
    return this.sql.begin(async (transaction) => {
      const factors = await transaction<{ id: string }[]>`
        update mfa_factors set verified_at = now()
        where id = ${factorId} and user_id = ${userId} and kind = 'totp'
          and verified_at is null and disabled_at is null returning id
      `
      if (!factors[0]) return false
      if (recoveryCodeHashes.length) {
        await transaction`delete from mfa_recovery_codes where user_id = ${userId}`
        for (const hash of recoveryCodeHashes) {
          await transaction`insert into mfa_recovery_codes (user_id, code_hash) values (${userId}, ${hash})`
        }
      }
      return true
    })
  }

  async createLoginChallenge(userId: string, tokenHash: string, deviceName: string): Promise<void> {
    await this.sql.begin(async (transaction) => {
      await transaction`
        update mfa_challenges set consumed_at = now()
        where user_id = ${userId} and purpose = 'login' and consumed_at is null
      `
      await transaction`
        insert into mfa_challenges (user_id, token_hash, purpose, device_name, expires_at)
        values (${userId}, ${tokenHash}, 'login', ${deviceName}, now() + interval '5 minutes')
      `
    })
  }

  activeChallenge(tokenHash: string, purpose: StoredMfaChallenge['purpose']): Promise<StoredMfaChallenge | null> {
    return this.sql<StoredMfaChallenge[]>`
      select id, user_id, purpose, challenge, device_name, factor_id, label, attempts, expires_at
      from mfa_challenges
      where token_hash = ${tokenHash} and purpose = ${purpose} and consumed_at is null
        and expires_at > now() and attempts < 5 limit 1
    `.then((rows) => rows[0] ?? null)
  }

  async recordFailedAttempt(id: string): Promise<void> {
    await this.sql`
      update mfa_challenges set attempts = attempts + 1,
        consumed_at = case when attempts + 1 >= 5 then now() else consumed_at end
      where id = ${id} and consumed_at is null
    `
  }

  async consumeChallenge(id: string): Promise<boolean> {
    const rows = await this.sql<{ id: string }[]>`
      update mfa_challenges set consumed_at = now()
      where id = ${id} and consumed_at is null and expires_at > now() returning id
    `
    return Boolean(rows[0])
  }

  async setChallengeValue(id: string, challenge: string): Promise<void> {
    await this.sql`update mfa_challenges set challenge = ${challenge} where id = ${id} and consumed_at is null`
  }

  async createRegistrationChallenge(userId: string, tokenHash: string, label: string, challenge: string): Promise<void> {
    await this.sql`
      insert into mfa_challenges (user_id, token_hash, purpose, label, challenge, expires_at)
      values (${userId}, ${tokenHash}, 'webauthn_registration', ${label}, ${challenge}, now() + interval '5 minutes')
    `
  }

  async addPasskey(
    challengeId: string,
    userId: string,
    label: string,
    credential: Record<string, unknown>,
    recoveryCodeHashes: string[],
  ): Promise<boolean> {
    return this.sql.begin(async (transaction) => {
      const consumed = await transaction<{ id: string }[]>`
        update mfa_challenges set consumed_at = now()
        where id = ${challengeId} and user_id = ${userId} and purpose = 'webauthn_registration'
          and consumed_at is null and expires_at > now() returning id
      `
      if (!consumed[0]) return false
      await transaction`
        insert into mfa_factors (user_id, kind, label, credential, verified_at)
        values (${userId}, 'webauthn', ${label}, ${transaction.json(credential as never)}, now())
      `
      if (recoveryCodeHashes.length) {
        await transaction`delete from mfa_recovery_codes where user_id = ${userId}`
        for (const hash of recoveryCodeHashes) {
          await transaction`insert into mfa_recovery_codes (user_id, code_hash) values (${userId}, ${hash})`
        }
      }
      return true
    })
  }

  async markFactorUsed(factorId: string, counter?: number): Promise<void> {
    if (counter === undefined) {
      await this.sql`update mfa_factors set last_used_at = now() where id = ${factorId}`
      return
    }
    await this.sql`
      update mfa_factors set last_used_at = now(),
        credential = jsonb_set(credential, '{counter}', ${this.sql.json(counter)})
      where id = ${factorId}
    `
  }

  async consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean> {
    const rows = await this.sql<{ id: string }[]>`
      update mfa_recovery_codes set used_at = now()
      where user_id = ${userId} and code_hash = ${codeHash} and used_at is null returning id
    `
    return Boolean(rows[0])
  }

  async disableFactor(userId: string, factorId: string): Promise<boolean> {
    return this.sql.begin(async (transaction) => {
      const count = await transaction<{ count: number }[]>`
        select count(*)::int as count from mfa_factors
        where user_id = ${userId} and verified_at is not null and disabled_at is null
      `
      if ((count[0]?.count ?? 0) <= 1) return false
      const rows = await transaction<{ id: string }[]>`
        update mfa_factors set disabled_at = now()
        where id = ${factorId} and user_id = ${userId} and verified_at is not null
          and disabled_at is null returning id
      `
      return Boolean(rows[0])
    })
  }
}
