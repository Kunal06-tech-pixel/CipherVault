-- PKCE extension grants and device-bound opaque credentials.

alter table extension_grants add column if not exists wrapped_vault_key text;
alter table extension_grants add column if not exists authorized_at timestamptz;

create table if not exists extension_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  label text not null check (length(label) between 1 and 100),
  device_public_key jsonb not null,
  refresh_token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  last_proof_timestamp bigint not null default 0,
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists extension_devices_user_active
  on extension_devices(user_id, expires_at) where revoked_at is null;

create table if not exists extension_access_tokens (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references extension_devices(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists extension_access_tokens_expiry on extension_access_tokens(expires_at);

revoke all on extension_devices, extension_access_tokens from public;
