# Security policy

## Reporting a vulnerability

Do not open a public issue for suspected vulnerabilities. Send a minimal report to the private security contact configured by the deployment operator. Include affected versions, reproduction steps, impact, and any proof of concept. Do not include real user vault data.

Operators should acknowledge reports within two business days, triage within five, and coordinate disclosure after a fix is deployed. Good-faith research that avoids data access, persistence, denial of service, social engineering, and third-party systems is welcome.

## Release gate

CipherVault must not be presented as generally available until all of these are complete:

- Independent review of the key hierarchy, recovery flow, extension boundary, sync conflict handling, and cryptographic implementation.
- Authenticated and unauthenticated penetration testing of web, API, extension, containers, and deployment configuration.
- Verified restore drill from encrypted database and object-store backups.
- No open critical or high findings in dependencies, containers, SAST, DAST, or the external assessment.
- Incident-response tabletop exercise and operational owner sign-off.

The product must never claim formal certification, compliance, or independent audit before evidence exists.
