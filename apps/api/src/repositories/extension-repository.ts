import type { Sql } from 'postgres'

export interface ExtensionGrant {
  id: string
  userId: string
  pkceChallenge: string
  devicePublicKey: { wrapKey: JsonWebKey; signingKey: JsonWebKey }
  wrappedVaultKey: string | null
  label: string
}

export interface ExtensionDevice {
  id: string
  userId: string
  devicePublicKey: { wrapKey: JsonWebKey; signingKey: JsonWebKey }
  expiresAt: Date
}

export class ExtensionRepository {
  constructor(private readonly sql: Sql) {}

  async createGrant(input: {
    userId: string; codeHash: string; pkceChallenge: string
    devicePublicKey: ExtensionGrant['devicePublicKey']; label: string
  }): Promise<void> {
    await this.sql`
      insert into extension_grants (user_id, code_hash, pkce_challenge, device_public_key, expires_at)
      values (${input.userId}, ${input.codeHash}, ${input.pkceChallenge},
        ${this.sql.json({ ...input.devicePublicKey, label: input.label } as never)}, now() + interval '5 minutes')
    `
  }

  async approveGrant(userId: string, codeHash: string, wrappedVaultKey: string): Promise<boolean> {
    const rows = await this.sql<{ id: string }[]>`
      update extension_grants set wrapped_vault_key = ${wrappedVaultKey}, authorized_at = now()
      where user_id = ${userId} and code_hash = ${codeHash} and consumed_at is null
        and expires_at > now() and authorized_at is null returning id
    `
    return Boolean(rows[0])
  }

  findGrant(codeHash: string): Promise<ExtensionGrant | null> {
    return this.sql<Array<{
      id: string; userId: string; pkceChallenge: string
      devicePublicKey: ExtensionGrant['devicePublicKey'] & { label?: string }
      wrappedVaultKey: string | null
    }>>`
      select id, user_id, pkce_challenge, device_public_key, wrapped_vault_key
      from extension_grants where code_hash = ${codeHash} and consumed_at is null
        and authorized_at is not null and expires_at > now() limit 1
    `.then((rows) => rows[0] ? {
      ...rows[0], label: rows[0].devicePublicKey.label ?? 'Browser extension',
    } : null)
  }

  async exchangeGrant(grantId: string, refreshTokenHash: string, accessTokenHash: string): Promise<string | null> {
    return this.sql.begin(async (transaction) => {
      const grants = await transaction<Array<{
        id: string; userId: string; devicePublicKey: ExtensionGrant['devicePublicKey'] & { label?: string }
      }>>`
        update extension_grants set consumed_at = now()
        where id = ${grantId} and consumed_at is null and authorized_at is not null and expires_at > now()
        returning id, user_id, device_public_key
      `
      const grant = grants[0]
      if (!grant) return null
      const devices = await transaction<{ id: string }[]>`
        insert into extension_devices (user_id, label, device_public_key, refresh_token_hash, expires_at)
        values (${grant.userId}, ${grant.devicePublicKey.label ?? 'Browser extension'},
          ${transaction.json(grant.devicePublicKey as never)}, ${refreshTokenHash}, now() + interval '30 days')
        returning id
      `
      const deviceId = devices[0]!.id
      await transaction`
        insert into extension_access_tokens (device_id, user_id, token_hash, expires_at)
        values (${deviceId}, ${grant.userId}, ${accessTokenHash}, now() + interval '5 minutes')
      `
      return deviceId
    })
  }

  findDevice(refreshTokenHash: string): Promise<ExtensionDevice | null> {
    return this.sql<ExtensionDevice[]>`
      select id, user_id, device_public_key, expires_at from extension_devices
      where refresh_token_hash = ${refreshTokenHash} and revoked_at is null and expires_at > now() limit 1
    `.then((rows) => rows[0] ?? null)
  }

  async rotateAccessToken(deviceId: string, userId: string, tokenHash: string): Promise<void> {
    await this.sql.begin(async (transaction) => {
      await transaction`delete from extension_access_tokens where device_id = ${deviceId}`
      await transaction`
        insert into extension_access_tokens (device_id, user_id, token_hash, expires_at)
        values (${deviceId}, ${userId}, ${tokenHash}, now() + interval '5 minutes')
      `
      await transaction`update extension_devices set last_used_at = now() where id = ${deviceId}`
    })
  }

  async acceptDeviceProof(deviceId: string, timestamp: number): Promise<boolean> {
    const rows = await this.sql<{ id: string }[]>`
      update extension_devices set last_proof_timestamp = ${timestamp}
      where id = ${deviceId} and revoked_at is null and expires_at > now()
        and last_proof_timestamp < ${timestamp} returning id
    `
    return Boolean(rows[0])
  }

  async authenticateAccessToken(tokenHash: string): Promise<{ userId: string; deviceId: string } | null> {
    const rows = await this.sql<{ userId: string; deviceId: string }[]>`
      select t.user_id, t.device_id from extension_access_tokens t
      join extension_devices d on d.id = t.device_id
      where t.token_hash = ${tokenHash} and t.expires_at > now()
        and d.revoked_at is null and d.expires_at > now() limit 1
    `
    return rows[0] ?? null
  }

  listDevices(userId: string) {
    return this.sql`
      select id, label, created_at, last_used_at, expires_at
      from extension_devices where user_id = ${userId} and revoked_at is null and expires_at > now()
      order by last_used_at desc
    `
  }

  async revokeDevice(userId: string, deviceId: string): Promise<boolean> {
    return this.sql.begin(async (transaction) => {
      const rows = await transaction<{ id: string }[]>`
        update extension_devices set revoked_at = now()
        where id = ${deviceId} and user_id = ${userId} and revoked_at is null returning id
      `
      if (!rows[0]) return false
      await transaction`delete from extension_access_tokens where device_id = ${deviceId}`
      return true
    })
  }
}
