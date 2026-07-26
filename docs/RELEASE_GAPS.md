# Production-beta release gaps

The repository implements the zero-knowledge key hierarchy, encrypted item/attachment contracts, synchronized web vault, account recovery, API sessions, database schema, extension autofill foundation, worker, containers, CI, and operational controls. The following features remain mandatory before a public password-manager launch:

- Complete cross-browser E2E automation for the implemented WebAuthn/passkey and TOTP enrollment, login-challenge, recovery-code, and step-up authentication flows. TOTP enforcement is exercised by the Compose smoke test; physical/virtual authenticator coverage remains a release gate.
- Complete extension browser automation and store packaging for the implemented PKCE pairing flow. The former plaintext memory bridge has been removed; refresh credentials are proof-of-possession-bound to a non-extractable ECDSA key and the vault key is RSA-wrapped for the device.
- Complete cross-browser attachment E2E coverage. The web app now encrypts, uploads, downloads, and deletes chunked attachments while keeping filenames and nonces inside encrypted item metadata.
- Complete cross-browser E2E coverage for TOTP display/copy, local CSV and JSON import, account deletion, recently-reauthenticated plaintext export, and opt-in k-anonymous compromised-password checks; these product flows are implemented.
- Complete offline install/upgrade E2E coverage. The production service worker now caches only the same-origin application shell and static assets; API traffic and encrypted vault records are excluded from Cache Storage.
- Add Playwright multi-device conflict, recovery, offline-upgrade, passkey, and extension browser automation. The Compose smoke test now covers registration, Mailpit verification, encrypted sync, S3 attachment round-trip, enforced TOTP login, and account deletion. Encrypted backup/isolated restore and plaintext-negative scripts are implemented; CI currently runs dependency audit, source secret checks, Trivy image scanning, Compose smoke, and the basic Playwright shell tests. CodeQL, SBOM, ZAP, and full browser scenario coverage remain release gates.
- Replace development extension origins and IDs, configure a production domain, provide final icons/store metadata, minimize requested host permissions, and complete Chromium/Firefox store review.
- Obtain the external cryptographic design review and penetration test required by `SECURITY.md`, then resolve every critical/high finding before general availability.

These are release gates, not optional polish. Until they are closed, label deployments as private development or controlled beta environments only.
