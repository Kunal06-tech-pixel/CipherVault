# CipherVault Production Beta

CipherVault is a zero-knowledge, multi-user password manager. Vault data is encrypted on the client before it reaches the API; PostgreSQL, Valkey, object storage, logs, and backups never receive plaintext vault fields or user vault keys.

> Production beta means the architecture and deployment controls are production-shaped, but public general availability is blocked on an independent cryptographic design review and penetration test. See [SECURITY.md](SECURITY.md).

The implemented core and remaining store/public-launch work are tracked in [docs/RELEASE_GAPS.md](docs/RELEASE_GAPS.md). Do not deploy this repository as a public password service until those gates are closed.

## Workspace

| Package | Responsibility |
| --- | --- |
| `apps/web` | React/TypeScript PWA, static offline shell, encrypted IndexedDB cache, worker-held keys, sync and recovery UI |
| `apps/api` | Fastify REST API, opaque sessions, account authentication, sync and recovery |
| `apps/worker` | Retried SMTP delivery and retention jobs |
| `apps/extension` | Manifest V3 browser extension, matching, autofill, save detection and generation |
| `packages/contracts` | Versioned Zod API and encrypted-record contracts |
| `packages/crypto` | Argon2id, HKDF, AES-256-GCM, vault/item/recovery key hierarchy |

The original single-browser prototype remains under `src/` only as a migration source and visual-style foundation. New development runs from `apps/web`.

## Local development

Requirements: Node.js 22+ and npm 10+. Docker with Compose is optional for the
production-like infrastructure stack.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the app. This automatically starts a persistent embedded
   PostgreSQL-compatible development database and applies migrations before the
   API and web app launch:

   ```bash
   npm run dev
   ```

   Web: `http://127.0.0.1:5173` - API: `http://localhost:3001`

   Local database files are stored in `.data/pglite` and excluded from Git. To
   use externally managed PostgreSQL instead, set `DATABASE_URL`, run
   `npm run db:migrate`, then run `npm run dev:external-db`.

3. Optional: create the files described in `infra/secrets/README.md` and start
   the production-like PostgreSQL, Valkey, SMTP, and object-storage services:

   ```bash
   npm run infra:up
   ```

   Mailpit: `http://localhost:8025`
   MinIO API: `http://localhost:9000` - console: `http://localhost:9001`

4. Build the browser extension, then load `apps/extension/dist` as an unpacked extension:

   ```bash
   npm run build -w @ciphervault/extension
   ```

Set `VITE_EXTENSION_ID` when building the web app to enable the externally-connectable memory bridge. Replace the example production domain in the extension manifest before store submission.

## Verification

```bash
npm test
npm run typecheck
npm run build
npm run audit:security
```

## Cryptographic model

- Argon2id derives a root from the master password with a per-user salt (64 MiB, three iterations, parallelism one by default).
- HKDF domain separation creates independent authentication and vault-key-wrapping material.
- The randomly generated 256-bit vault key is AES-256-GCM wrapped; changing the master password does not re-encrypt every item.
- Each item gets a domain-separated key and unique authenticated encryption metadata. The server only sees opaque IDs, revisions, nonces, ciphertext, timestamps, sizes, and tombstones.
- The master password and vault key never leave the client. Authentication uses a separate high-entropy derived key which the server hashes again with Argon2id and an operational pepper.
- The recovery kit contains a checksum-protected random key that independently wraps the vault key. Email alone cannot recover vault contents.
- Decrypted keys live in a dedicated worker and are cleared on lock. Persistent browser storage contains encrypted items only.

See [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) for security boundaries and [docs/OPERATIONS.md](docs/OPERATIONS.md) for deployment, backups, monitoring, and rotation.

Completed hardening increments and their tradeoffs are recorded in [docs/HARDENING_PHASE_1.md](docs/HARDENING_PHASE_1.md).

