# CipherVault Deployment Roadmap

Status: private beta deployment ready after backend hosting is selected. Public password-manager launch remains blocked by the release gates in `docs/RELEASE_GAPS.md`.

## Current Readiness

- Web app: Vite/React PWA in `apps/web`, deployable as static assets.
- API: Fastify service in `apps/api`, required for registration, login, sync, MFA, recovery, attachments, and sessions.
- Worker: background maintenance/email/object cleanup service in `apps/worker`.
- Data services: PostgreSQL, Valkey/Redis, S3-compatible object storage, SMTP.
- Containers: API, worker, and local Compose stack exist under `infra/`.
- Netlify static deploy config exists in `netlify.toml`.

Verified locally on 2026-07-27:

```bash
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
```

`npm audit --audit-level=high` passes. It currently reports one low-severity `esbuild` development-server advisory under `tsup`; clean this with a dependency update before public release.

## Deployment Architecture

Use Netlify only for the browser application:

- Build command: `npm run build -w @ciphervault/web`
- Publish directory: `apps/web/dist`
- Node version: `22`

Host the API and worker separately on a Node/container platform such as Fly.io, Render, Railway, DigitalOcean App Platform, AWS ECS/App Runner, or a VPS running the existing Docker Compose stack.

Recommended private-beta architecture:

- `https://app.example.com` -> Netlify web app.
- `https://api.example.com` -> Fastify API.
- Managed PostgreSQL with daily encrypted backups and point-in-time recovery.
- Managed Redis/Valkey if `EMAIL_DELIVERY=queue`; omit worker queueing only for a very small private beta.
- S3-compatible bucket for encrypted attachment chunks.
- Real SMTP provider for verification and recovery emails.
- Worker deployed as a separate process/container using the same database, Redis, SMTP, and storage credentials.

## Required Production Configuration

API environment:

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=<provider port>
PUBLIC_ORIGIN=https://app.example.com
COOKIE_SECURE=true
DATABASE_URL=<postgres connection string>
AUTH_PEPPER=<random secret, 32+ chars>
PRELOGIN_SECRET=<random secret, 32+ chars>
MFA_ENCRYPTION_KEY=<32 random bytes encoded base64url>
SMTP_HOST=<smtp host>
SMTP_PORT=<smtp port>
SMTP_FROM=<verified sender>
SMTP_USER=<smtp user, if required>
SMTP_PASSWORD=<smtp password, if required>
EMAIL_DELIVERY=queue
REDIS_URL=<redis/valkey url>
S3_ENDPOINT=<private/service endpoint>
S3_PUBLIC_ENDPOINT=<browser-reachable endpoint for presigned attachment urls>
S3_REGION=<region>
S3_BUCKET=<bucket>
S3_ACCESS_KEY=<least-privilege access key>
S3_SECRET_KEY=<least-privilege secret key>
```

Web build environment:

```text
VITE_API_URL=https://api.example.com
```

After the API domain is final, update `netlify.toml` `Content-Security-Policy` so `connect-src` includes that API origin. Without this, browser API calls will be blocked by CSP.

## Roadmap

### Phase 1: Repository and Secret Hygiene

- Keep `infra/secrets/*.txt`, `.env`, `.data/`, `dist/`, `test-results/`, and backups out of Git.
- Rotate any local secret files that were ever copied outside the machine.
- Add deployment environment variables only through the hosting provider secret manager.
- Commit only source/config/docs, not generated `dist` artifacts or local service data.

Exit criteria:

- `git status` contains no accidental secret or generated artifact changes.
- GitHub secret scanning and CI are green.

### Phase 2: Backend Hosting

- Choose the backend host.
- Provision PostgreSQL, Redis/Valkey, S3-compatible storage, and SMTP.
- Deploy API with `npm run build -w @ciphervault/api` and `npm run start -w @ciphervault/api`, or use `infra/docker/api.Dockerfile`.
- Run migrations before opening traffic:

```bash
npm run db:migrate -w @ciphervault/api
```

- Deploy worker with `infra/docker/worker.Dockerfile` or `npm run start -w @ciphervault/worker` after build.
- Verify API health:

```text
GET /health/ready
```

Exit criteria:

- API readiness passes on the public API domain.
- Registration, email verification, login, sync, MFA, recovery, and attachment routes can reach their dependencies.

### Phase 3: Netlify Web Deployment

- In Netlify, import the GitHub repo.
- Use `netlify.toml` for build settings.
- Set `VITE_API_URL` to the production API origin.
- Update `netlify.toml` CSP `connect-src` to include the same API origin.
- Deploy a preview first, then promote to production.

Exit criteria:

- Netlify deploy succeeds from GitHub.
- Browser console has no CSP, service worker, worker script, or API CORS errors.
- API receives requests with `Origin: https://app.example.com`.

### Phase 4: Verification Before Private Beta

Run:

```bash
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
npm run test:compose
npm run backup:compose -- backups/private-beta-drill
npm run restore:drill -- backups/private-beta-drill
npm run verify:plaintext-negative
npm run test:e2e
```

Then manually verify:

- Account registration and email verification.
- Login, logout, session revocation.
- MFA enrollment and MFA challenge.
- Recovery flow.
- Vault item create/edit/delete/sync.
- CSV/JSON import and export with reauthentication.
- Attachment upload/download/delete.
- Offline reload and service-worker update.
- Browser extension pairing if included in the beta.

Exit criteria:

- No critical/high audit, container, secret-scan, or ZAP findings.
- Restore drill is documented with RTO/RPO notes.
- Logs contain no plaintext vault fields, auth keys, recovery keys, cookies, or tokens.

### Phase 5: Production Launch Gates

Do not market this as a public password manager until all release gates are closed:

- External cryptographic design review.
- Independent penetration test.
- Full cross-browser Playwright coverage for MFA, passkeys, recovery, attachments, offline upgrade, imports/exports, and extension flows.
- Browser extension store review and final production extension IDs.
- Final incident response, monitoring, alerting, backup, and key-rotation drills.

## Current Deployment Blockers

- API hosting target is not selected.
- Production domains are not final.
- Netlify CSP must be updated with the final API origin.
- Production secrets are not provisioned in a provider secret manager.
- Public launch is blocked by `docs/RELEASE_GAPS.md`.

## Suggested Immediate Path

1. Deploy API and worker to a container-friendly host using managed PostgreSQL, Redis, object storage, and SMTP.
2. Confirm `/health/ready` passes at the API domain.
3. Update `netlify.toml` CSP `connect-src` with the API domain.
4. Set Netlify `VITE_API_URL` to the API domain.
5. Deploy Netlify from GitHub.
6. Run private-beta smoke checks against the real domains.
