# Hardening Phase 1: Authentication, Migrations, Retention, and Offline Shell

## Why this phase was needed

The beta already encrypted vault contents correctly, but several surrounding controls could fail under real production conditions. Public authentication mutations skipped the Origin check, duplicate registration disclosed account existence, migrations had no history or checksum verification, stale attachment reservations could consume quota forever, and sync history was deleted without a stale-cursor recovery protocol.

## Benefits delivered

- Every browser mutation now receives the same strict Origin validation before route-specific authentication and CSRF checks.
- Registration uses an atomic `insert ... on conflict do nothing` and returns one generic accepted response, reducing email enumeration and registration races.
- Sessions now enforce a 30-minute server-side idle limit in addition to the five-minute client vault lock.
- Numbered migrations run under an advisory lock, record SHA-256 checksums, and fail if an applied migration was modified.
- Database constraints and indexes cover quota bounds, token expiry, active recovery requests, tombstones, sessions, and attachment lifecycle queries.
- Recovery request creation is serialized per account.
- Worker maintenance is transactional, releases abandoned pending-attachment quota, and no longer deletes sync history before a safe compaction protocol exists.
- Plaintext JSON export requires current master-password reauthentication and is generated only in the browser after an explicit warning.
- The installable PWA caches only the same-origin application shell and static assets. API, health, and vault data are never placed in Cache Storage.
- API infrastructure dependencies are injectable through narrow interfaces, enabling route security tests without external services.

## Best practices followed

- Opaque `HttpOnly` session cookies remain the browser authentication mechanism.
- Origin and CSRF protections are independent and consistently ordered.
- Sensitive authentication failures use generic public responses while security events remain auditable.
- Database state changes that span records are transactional and concurrency guarded.
- Applied migrations are immutable and repeatable local-development migrations are tested.
- Offline persistence continues to contain ciphertext only; the service worker handles application assets, not vault records.
- Sync-log retention favors correctness until acknowledged-device cursors and full-resync semantics are implemented.

## Main files modified

- `apps/api/src/app.ts`, `apps/api/src/database.ts`, `apps/api/src/migrations.ts`
- `apps/api/migrations/0002_hardening.sql`
- `apps/api/src/app.security.test.ts`, `apps/api/src/migrations.test.ts`
- `apps/worker/src/maintenance.ts`, `apps/worker/src/worker.ts`
- `apps/web/src/App.tsx`, `apps/web/src/api.ts`, `apps/web/src/main.tsx`
- `apps/web/public/service-worker.js`, `apps/web/public/manifest.webmanifest`
- `packages/contracts/src/index.ts`

## Alternatives considered

- JWT browser sessions were not introduced because revocable cookie sessions provide immediate revocation and avoid browser token storage.
- Sync-log time-based deletion was not replaced with blind compaction. Safe compaction requires per-device acknowledged cursors plus an explicit stale-cursor/full-snapshot response.
- A third-party PWA plugin was not added; the small explicit service worker makes the no-API-cache policy reviewable and avoids another supply-chain dependency.
- Plaintext export was not moved to the server because doing so would violate the zero-knowledge boundary.

## Remaining gates

MFA/passkeys, extension PKCE pairing, attachment UI, account deletion, compromised-password checks, full integration/E2E coverage, production extension review, external cryptographic review, and penetration testing remain required before public general availability.
