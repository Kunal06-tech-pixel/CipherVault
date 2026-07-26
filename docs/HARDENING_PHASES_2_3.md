# Hardening Phases 2-3: Modular Boundaries and Product Completion

## Why this was needed

The API, persistence layer, and web application were concentrated in three large modules. This made security policy changes difficult to review and blocked safe completion of attachment, import, TOTP, health, and account-lifecycle features.

## Benefits

- API bootstrap now owns middleware only; auth, health, sessions, sync, attachments, and password-health routes are isolated modules.
- PostgreSQL writes are grouped into user/recovery, session, sync, attachment, and security-event repositories behind a stable database facade.
- The React application is split into auth, recovery, vault, settings, attachment, import/export, password-health, TOTP, and shared UI modules.
- CSV and plaintext JSON are parsed locally and encrypted before synchronization. Encrypted JSON restore verifies decryption locally before upload.
- Attachment chunks use per-attachment HKDF keys and authenticated chunk positions. Names, types, nonces, and sizes live in encrypted item metadata.
- TOTP is generated locally and tested against RFC 6238 vectors.
- Compromised-password checks hash locally and send only five-character k-anonymous prefixes after explicit opt-in.
- Account deletion requires recent reauthentication, revokes every session immediately, and defers hard purge until object cleanup succeeds.

## Best practices

- Shared Zod contracts remain the DTO and persisted-item validation source of truth.
- No vault plaintext was added to API DTOs, server logs, database columns, queues, or object metadata.
- Object-storage URLs are short-lived and the configured public endpoint is separated from the private service endpoint.
- Sensitive destructive operations are confirmation- and reauthentication-gated.
- Existing route shapes and visual direction were preserved during modularization.

## Alternatives considered

- Server-side CSV parsing was rejected because it would cross the zero-knowledge boundary.
- Storing attachment names in PostgreSQL was rejected; they remain inside encrypted item ciphertext.
- Immediate database deletion was rejected because object cleanup must succeed first to prevent orphaned encrypted blobs.
- Sending full password hashes to a breach provider was rejected in favor of range queries.

## Remaining repository work

MFA/passkeys, extension PKCE pairing, broader integration and Playwright suites, observability, backup/restore automation, and additional container/runtime hardening remain. External cryptographic review, penetration testing, and browser-store review remain external release gates.
