# Local Docker secrets

Generate the following untracked files before starting Compose:

```bash
npm run secrets:setup
```

The initializer uses independent cryptographically random values, repairs missing
or empty files, verifies that the PostgreSQL password and connection URL agree,
and never overwrites a non-empty secret.

```text
postgres_password.txt
database_url.txt
auth_pepper.txt
prelogin_secret.txt
mfa_encryption_key.txt
backup_key.txt
minio_password.txt
```

`database_url.txt` contains `postgres://ciphervault:<password>@postgres:5432/ciphervault` with the password URL-encoded. Never commit these files.
