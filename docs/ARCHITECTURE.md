# CipherVault architecture

```text
React PWA ── opaque HttpOnly session + CSRF ──> Fastify API ──> PostgreSQL
    │                                                │              ciphertext,
    │ client crypto worker                          ├──> Valkey     revisions,
    │ Argon2id / HKDF / AES-GCM                     │    queues     tombstones
    │                                                ├──> SMTP
    └── encrypted IndexedDB cache                    └──> S3-compatible encrypted chunks

WebExtension ── PKCE grant ──> API
    │ non-extractable RSA-OAEP + ECDSA device keys
    │ five-minute opaque access token / signed refresh proof
    └── wrapped vault key + ciphertext sync; decrypted login cache is memory-only
```

The API never receives the master password, vault key, or decrypted item/attachment fields. The client derives separate authentication and wrapping material, while the API stores a peppered verifier. Item, attachment, and recovery formats are versioned in `packages/contracts` and cryptographic operations are centralized in `packages/crypto` plus the web crypto worker.

API routing lives in `apps/api/src/routes`, policy in request/session services, and persistence in repositories. Web features live under `apps/web/src/features`; the legacy root `src/` tree is migration-only and is not part of the production build.

## Release boundary

The repository can be deployed as a controlled production beta after environment-specific TLS, domains, managed secrets, backups, monitoring, and store configuration are supplied. Public GA additionally requires the independent cryptographic design review and penetration test defined in `SECURITY.md`.
