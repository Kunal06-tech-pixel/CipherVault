# Operations runbook

## Production deployment

- Use dedicated managed PostgreSQL, Valkey, and S3-compatible storage or harden the Compose equivalents.
- Terminate TLS with Caddy or the cloud load balancer; redirect HTTP and enable HSTS only after the production domain is final.
- Mount independent `AUTH_PEPPER`, `PRELOGIN_SECRET`, `MFA_ENCRYPTION_KEY`, backup, database, SMTP, and storage credentials through secret files. Never put production values in images, source control, Compose YAML, or CI logs.
- Use a least-privilege database role after migrations. Restrict database, cache, SMTP, and object storage to the private network.
- Set `PUBLIC_ORIGIN` exactly and build the web CSP/extension allowlist for that origin.
- Run API and worker as non-root read-only containers with resource limits, seccomp/AppArmor, and controlled egress.

## Monitoring

Alert on readiness failures, queue depth/age, repeated login/recovery failures, session creation spikes, database saturation, sync conflict rates, quota failures, backup failures, and unexpected outbound traffic. Logs must redact cookies, authorization headers, authentication keys, ciphertext, tokens, email bodies, and request bodies on sensitive endpoints.

## Backups and retention

- Take encrypted PostgreSQL backups at least daily with 35-day retention and point-in-time recovery where available.
- Version encrypted object storage with matching retention. Keep backup encryption keys outside the workload account.
- Configure an object-store lifecycle rule to remove incomplete uploads and objects belonging to abandoned pending attachment reservations after 48 hours. Database maintenance releases their quota after 24 hours.
- Quarterly, restore both stores into an isolated environment, run migrations, verify row/object counts, scan for forbidden plaintext markers, and document recovery time and recovery point.
- Sync changes and tombstones are retained until per-device cursor acknowledgements and an explicit stale-cursor full-resync protocol are available. Revoked/expired sessions and short-lived tokens are purged after seven and one days respectively.
- Account deletion revokes access immediately. The worker removes every encrypted attachment object before hard-deleting the account after the seven-day purge window; failed object cleanup leaves the database record queued for retry.
- Migrations are ordered and checksum-verified in `schema_migrations`; never edit an applied migration. Add a new numbered migration instead.
- Run `npm run backup:compose -- backups/<timestamp>` for an AES-256-GCM encrypted PostgreSQL/object-store backup. Store `backup_key.txt` outside the workload account. Validate with `npm run restore:drill -- backups/<timestamp>` in an isolated environment.
- Run `CV_FORBIDDEN_MARKER=<never-sent-test-marker> npm run verify:plaintext-negative` after restore drills. The check scans redacted API/worker logs, PostgreSQL dump output, and object-store data for accidental plaintext.

Local encrypted backup and isolated restore verification:

```bash
npm run backup:compose -- backups/drill
npm run restore:drill -- backups/drill
```

`backup_key.txt` must be escrowed separately from backup media. A restore drill starts an isolated temporary PostgreSQL container, validates the authenticated backup envelope and object archive, restores the dump without original ownership, verifies the table count, and removes the temporary container.

The Compose release smoke test is `npm run test:compose`. A plaintext-negative check can be run with a unique test marker that was deliberately never submitted to the API:

```bash
CV_FORBIDDEN_MARKER='unique-test-only-marker' npm run verify:plaintext-negative
```

## Secret rotation

- Rotating session infrastructure or suspected session compromise: revoke all sessions and require login.
- Rotating the authentication pepper requires a dual-pepper verification window and rehash on successful login; never replace it without this migration.
- Prelogin-secret rotation changes only fake salts for nonexistent accounts and may occur directly.
- SMTP/storage/database credentials use provider rotation and rolling service restart.
- MFA encryption-key rotation requires decrypt-and-re-encrypt of every TOTP envelope in one transaction or a versioned dual-key window; never replace it directly.
- Client crypto algorithms and KDF parameters are versioned; migration decrypts and re-encrypts client-side after successful unlock.
- MFA encryption and backup keys are independent secrets. Rotate MFA encryption only with a planned re-encryption migration; rotate backup keys by retaining the old key for the backup retention window.

## Incident response

1. Preserve relevant redacted logs and deployment metadata without copying vault ciphertext unnecessarily.
2. Contain affected components, revoke sessions/device grants, rotate operational credentials, and stop vulnerable releases.
3. Determine whether the web/extension build was modified; server compromise alone should not expose plaintext but may enable malicious future delivery.
4. Notify affected users with concrete scope and actions. Never claim vault plaintext was safe without build-integrity and traffic evidence.
5. Patch, independently validate, restore service, monitor, and publish a post-incident review.
