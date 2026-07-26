# Production beta release checklist

- [ ] Production domain, TLS, secure cookies, HSTS, CSP, and extension origin/ID are final.
- [ ] PostgreSQL, Valkey, SMTP, and S3 use private networking and least-privilege credentials.
- [ ] All secret files are independently generated, mounted, escrowed, and rotation-tested.
- [ ] `npm run typecheck`, `npm test`, `npm run build`, and `npm audit --audit-level=high` pass.
- [ ] Compose smoke, encrypted backup, isolated restore, and plaintext-negative checks pass.
- [ ] CodeQL, Gitleaks, Trivy, SBOM, and ZAP CI jobs pass with no critical/high findings.
- [ ] Playwright multi-device, recovery, offline, passkey, attachment, and extension suites pass on Chromium and Firefox.
- [ ] Alerts cover readiness, queue age/failure, backup failure, auth/recovery spikes, sync conflicts, and quota failures.
- [ ] Browser-extension permissions, icons, privacy copy, and Chromium/Firefox store packages are approved.
- [ ] External cryptographic design review and penetration test are complete; all critical/high findings are closed.
