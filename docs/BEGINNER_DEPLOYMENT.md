# Beginner Deployment: Netlify + Supabase + Render

This guide deploys Keywall as a private beta:

- Netlify hosts the browser app.
- Supabase hosts PostgreSQL only.
- Render hosts the existing Fastify API.

Supabase is not replacing the API in this repo. The frontend still talks to the Render API, and the Render API talks to Supabase Postgres.

This free-only setup intentionally disables email verification, account recovery emails, encrypted attachments, Redis, and background workers. Those features need SMTP, object storage, or always-on/background infrastructure that can create costs or hit free-tier limits.

## 1. Push the Project to GitHub

1. Create a GitHub account.
2. Create a new private repository.
3. Push this project to that repository.

Do not commit `.env`, `infra/secrets/*.txt`, `.data`, `dist`, `test-results`, or `backups`.

## 2. Create Deployment Secrets

Run this locally:

```bash
npm run secrets:deployment
```

Copy the three generated values somewhere temporary while you configure Render:

```text
AUTH_PEPPER=...
PRELOGIN_SECRET=...
MFA_ENCRYPTION_KEY=...
```

Do not commit these values to GitHub.

## 3. Create Supabase Project

1. Go to Supabase and create a new project.
2. Open **Project Settings > Database > Connection string**.
3. Copy a Postgres connection string.
4. If Render cannot connect to the direct connection string, use Supabase's pooler session-mode connection string instead.

Use the Supabase string as Render's `DATABASE_URL`.

## 4. Deploy the API on Render

This repo now includes `render.yaml`, so use Render Blueprints if you want the easiest path.

1. Create a Render account.
2. Choose **Blueprints**.
3. Connect your GitHub repository.
4. Select this repo's `render.yaml`.
5. Render will ask for secret values marked `sync: false`.

Paste these values:

```text
PUBLIC_ORIGIN=https://<your-netlify-site>.netlify.app
DATABASE_URL=<Supabase Postgres connection string>
AUTH_PEPPER=<value from npm run secrets:deployment>
PRELOGIN_SECRET=<value from npm run secrets:deployment>
MFA_ENCRYPTION_KEY=<value from npm run secrets:deployment>
```

The free Render Blueprint already sets:

```text
ALLOW_UNVERIFIED_LOGIN=true
EMAIL_DELIVERY=disabled
ENABLE_ATTACHMENTS=false
```

The Render API service uses:

```bash
npm ci && npm run build -w @keywall/api
npm run db:migrate -w @keywall/api
npm run start -w @keywall/api
```

After deployment, open:

```text
https://<your-render-api>.onrender.com/health/ready
```

The API must be healthy before the Netlify app can work.

## 5. Deploy the Frontend on Netlify

1. Create a Netlify account.
2. Choose **Add new site > Import an existing project**.
3. Connect the same GitHub repository.
4. Netlify will use `netlify.toml`.
5. Add this environment variable:

```text
VITE_API_URL=https://<your-render-api>.onrender.com
```

Netlify will run:

```bash
node scripts/prepare-netlify-config.mjs && npm run build -w @keywall/web
```

That command inserts the Render API origin into the Content Security Policy during the Netlify build.

Do not set `VITE_ENABLE_ATTACHMENTS=true` on the free deployment.

## 6. Update the Final URLs

After Netlify gives you the final frontend URL:

1. Go back to Render.
2. Set `PUBLIC_ORIGIN` to the exact Netlify URL.
3. Redeploy the Render API.
4. Make sure Netlify `VITE_API_URL` still points to the Render API URL.
5. Redeploy Netlify.

## 7. Smoke Test

After both sites are deployed:

1. Open the Netlify URL.
2. Register a new account.
3. Log in and log out.
4. Create, edit, and delete a vault item.
5. Refresh the page and confirm the item is still there.
6. Check the browser console for CORS or CSP errors.
7. Check Render logs for API errors.

Before inviting anyone else, run:

```bash
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
```

Do not treat this as a public password manager launch until the security review and release gaps documented in this repo are complete.

## Free-Tier Limits

This setup avoids optional paid services, but free platforms still have limits:

- Supabase Free has database size and project inactivity limits.
- Render Free web services spin down after inactivity and can cold-start slowly.
- Render Free web services should not be used for production traffic.
- Netlify Free has monthly usage credits/limits.

Keep billing auto-recharge disabled where the platform offers that control.
