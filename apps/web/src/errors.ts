import { ApiError } from './api'

export function readableError(error: unknown): string {
  if (error instanceof ApiError) {
    return ({
      invalid_credentials: 'The email or master password is incorrect.',
      origin_rejected: 'This request did not come from the configured CipherVault application.',
      email_not_verified: 'Verify your email before signing in.',
      csrf_rejected: 'Your session expired. Lock and sign in again.',
      recent_reauthentication_required: 'Re-enter your master password before this sensitive action.',
      account_confirmation_mismatch: 'The confirmation email does not match this account.',
      service_unavailable: import.meta.env.DEV
        ? 'The local vault service is unavailable. Start PostgreSQL and run the database migration.'
        : 'CipherVault is temporarily unavailable. Please try again shortly.',
    } as Record<string, string>)[error.code] ?? 'The server could not complete this request.'
  }
  return error instanceof Error ? error.message : 'Something went wrong.'
}
