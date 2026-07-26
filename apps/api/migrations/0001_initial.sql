create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (length(email) <= 254),
  email_verified_at timestamptz,
  auth_verifier_hash text not null,
  kdf jsonb not null,
  kdf_salt text not null,
  wrapped_vault_key jsonb not null,
  recovery_wrapped_vault_key jsonb not null,
  quota_bytes bigint not null default 104857600,
  used_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  csrf_hash text not null,
  device_name text not null check (length(device_name) <= 100),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists sessions_user_active on sessions(user_id, expires_at) where revoked_at is null;

create table if not exists vault_items (
  user_id uuid not null references users(id) on delete cascade,
  id uuid not null,
  revision bigint not null check (revision > 0),
  crypto_version smallint not null,
  item_version uuid not null,
  nonce text not null,
  ciphertext text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  check (octet_length(ciphertext) <= 2000000)
);

create sequence if not exists sync_sequence;
create table if not exists sync_changes (
  sequence bigint primary key default nextval('sync_sequence'),
  user_id uuid not null references users(id) on delete cascade,
  item_id uuid not null,
  revision bigint not null,
  operation text not null check (operation in ('upsert', 'delete')),
  created_at timestamptz not null default now(),
  foreign key (user_id, item_id) references vault_items(user_id, id) on delete cascade
);
create index if not exists sync_changes_user_cursor on sync_changes(user_id, sequence);

create table if not exists attachments (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  item_id uuid not null,
  object_key text not null unique,
  size bigint not null check (size between 1 and 10485760),
  chunk_count integer not null check (chunk_count between 1 and 160),
  crypto_version smallint not null,
  ciphertext_sha256 text,
  chunk_hashes jsonb,
  status text not null default 'pending' check (status in ('pending', 'complete', 'deleted')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz,
  foreign key (user_id, item_id) references vault_items(user_id, id) on delete cascade
);

create table if not exists mfa_factors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('totp', 'webauthn')),
  label text not null,
  credential jsonb not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (user_id, id)
);

create table if not exists security_events (
  id bigserial primary key,
  user_id uuid references users(id) on delete set null,
  event text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists security_events_user_created on security_events(user_id, created_at desc);

create table if not exists extension_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  code_hash text not null unique,
  pkce_challenge text not null,
  device_public_key jsonb not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists recovery_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

revoke all on users, sessions, vault_items, sync_changes, attachments, mfa_factors,
  security_events, email_verification_tokens, extension_grants, recovery_requests from public;
