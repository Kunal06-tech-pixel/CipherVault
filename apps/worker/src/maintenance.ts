import type { Sql } from 'postgres'

export interface MaintenanceResult {
  sessionsDeleted: number
  verificationTokensDeleted: number
  recoveryRequestsDeleted: number
  pendingAttachmentsReleased: number
  mfaChallengesDeleted: number
  pendingMfaFactorsDeleted: number
  extensionCredentialsDeleted: number
}

export async function runMaintenance(database: Sql): Promise<MaintenanceResult> {
  return database.begin(async (transaction) => {
    const sessions = await transaction`
      delete from sessions
      where expires_at < now() - interval '7 days' or revoked_at < now() - interval '7 days'
    `
    const verificationTokens = await transaction`
      delete from email_verification_tokens where expires_at < now() - interval '1 day'
    `
    const recoveryRequests = await transaction`
      delete from recovery_requests where expires_at < now() - interval '1 day'
    `
    const mfaChallenges = await transaction`
      delete from mfa_challenges where expires_at < now() - interval '1 day'
    `
    const pendingMfaFactors = await transaction`
      delete from mfa_factors where verified_at is null and created_at < now() - interval '1 day'
    `
    const extensionAccess = await transaction`
      delete from extension_access_tokens where expires_at < now() - interval '1 day'
    `
    const extensionGrants = await transaction`
      delete from extension_grants where expires_at < now() - interval '1 day'
    `
    const extensionDevices = await transaction`
      delete from extension_devices
      where expires_at < now() - interval '7 days' or revoked_at < now() - interval '7 days'
    `
    const releasedAttachments = await transaction`
      with expired as (
        update attachments set status = 'deleted', deleted_at = now()
        where status = 'pending' and created_at < now() - interval '24 hours'
        returning user_id, size
      ), released as (
        select user_id, sum(size)::bigint as bytes, count(*)::integer as attachment_count
        from expired group by user_id
      ), updated_users as (
        update users u set used_bytes = greatest(0, u.used_bytes - released.bytes)
        from released where u.id = released.user_id
        returning released.attachment_count
      )
      select coalesce(sum(attachment_count), 0)::integer as count from updated_users
    `

    return {
      sessionsDeleted: sessions.count,
      verificationTokensDeleted: verificationTokens.count,
      recoveryRequestsDeleted: recoveryRequests.count,
      pendingAttachmentsReleased: Number(releasedAttachments[0]?.count ?? 0),
      mfaChallengesDeleted: mfaChallenges.count,
      pendingMfaFactorsDeleted: pendingMfaFactors.count,
      extensionCredentialsDeleted: extensionAccess.count + extensionGrants.count + extensionDevices.count,
    }
  })
}
