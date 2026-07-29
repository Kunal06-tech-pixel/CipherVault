# Keywall threat model

## Protected assets

Vault plaintext, master passwords, vault/recovery keys, authentication material, sessions, encrypted backups, email identities, and operational secrets.

## Trust boundaries

- **Trusted while unlocked:** the user's browser/extension process, locally packaged application code, and dedicated cryptographic worker.
- **Not trusted with plaintext:** API, workers, PostgreSQL, Valkey, SMTP, object storage, reverse proxy, logs, metrics, administrators, and backups.
- **External:** email delivery, browser/extension stores, compromised-password range service, DNS, certificate authorities, and the user's device/platform authenticator.

## Primary threats and controls

| Threat | Controls | Residual risk |
| --- | --- | --- |
| Database or backup theft | Per-item client encryption; wrapped vault keys; server-hashed authentication keys | Offline guessing remains possible against weak master passwords |
| Malicious/compromised server | Server never receives plaintext vault keys or items | A malicious web build can steal future unlock material; signed/reproducible builds and review are required |
| XSS/supply-chain compromise | Restrictive CSP, no remote scripts, dependency pinning/audits, no HTML injection, worker key isolation | Code executing in the origin can request decrypt operations while unlocked |
| Session theft | Opaque hashed tokens, HttpOnly Secure Strict cookies, rotation, CSRF/Origin checks, expiry and revocation | Active same-origin compromise can act through the browser session |
| Account enumeration | Generic prelogin salts, generic recovery response, rate limits and redacted events | Registration conflict can reveal that an email is already registered |
| Sync overwrite/race | Per-user authorization, monotonic cursor, base revisions, explicit conflict response | User intervention may be required to resolve concurrent secret edits |
| Lost master password | Offline recovery key plus verified email; old sessions revoked | Loss of both master password and recovery key is intentionally unrecoverable |
| Extension abuse | MV3 packaged code, optional host permissions, active-tab injection, inactivity lock | A compromised browser profile can access unlocked extension state |
| Insider access | Zero-knowledge payloads, least-privilege DB role, secret separation, audit events | Email and operational metadata remain visible |

## Explicit non-goals

Keywall cannot protect secrets displayed on a device already controlled by malware, keyloggers, hostile browser extensions, or a compromised operating system. It does not hide account email, ciphertext size, access time, device labels, or item counts from the service operator.
