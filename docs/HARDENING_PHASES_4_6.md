# Hardening phases 4–6

## Why

The beta needed enforced MFA, a device-bound extension authorization model, deployable verification, and repeatable recovery operations. The previous web-to-extension bridge moved decrypted items across an externally connectable boundary and was not an acceptable production authorization mechanism.

## Implemented

- TOTP enrollment and login enforcement with AES-256-GCM server-side secret envelopes, bounded verification windows, hashed one-time recovery codes, recent reauthentication, and audit events.
- WebAuthn registration/authentication with required user verification, stored counters, replay-resistant challenges, and passkey management.
- PKCE extension grants, RSA-wrapped vault-key transfer, non-extractable device keys, ECDSA refresh proofs, replay timestamps, opaque short-lived access tokens, and ciphertext-only extension sync.
- Migration/retention support for MFA and extension credentials.
- Compose integration covering SMTP, PostgreSQL, S3, MFA enforcement, sync, and deletion.
- Encrypted Postgres/object-volume backups, isolated restore drills, and plaintext-negative checks.
- Read-only/non-root API and worker containers with dropped capabilities, resource bounds, diagnostics, stronger CSP/Trusted Types, CodeQL, Gitleaks, Trivy, SBOM, and ZAP CI gates.

## Alternatives considered

- JWT browser sessions were rejected in favor of the existing server-revocable opaque cookie model.
- A custom WebAuthn signature parser was rejected in favor of SimpleWebAuthn.
- Persisting decrypted extension items was rejected; the extension stores only wrapped key material and device-bound credentials, with plaintext remaining in memory.
- Bucket-level CORS alone was rejected after current MinIO returned `NotImplemented`; Compose configures MinIO server CORS while S3 providers may still accept bucket CORS.

## Remaining external gates

Browser store review, production infrastructure credentials/domains, independent cryptographic review, and penetration testing cannot be completed solely by repository changes. They remain mandatory before GA.
