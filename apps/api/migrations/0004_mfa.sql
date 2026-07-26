-- Multi-factor authentication challenges, factor verification, and recovery codes.

alter table mfa_factors add column if not exists verified_at timestamptz;
alter table mfa_factors add column if not exists disabled_at timestamptz;
alter table mfa_factors drop constraint if exists mfa_factors_label_length;
alter table mfa_factors add constraint mfa_factors_label_length check (length(label) between 1 and 100);

create unique index if not exists mfa_webauthn_credential_id
  on mfa_factors ((credential->>'id'))
  where kind = 'webauthn' and verified_at is not null and disabled_at is null;
create index if not exists mfa_factors_user_enabled
  on mfa_factors(user_id, kind)
  where verified_at is not null and disabled_at is null;

create table if not exists mfa_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  purpose text not null check (purpose in ('login', 'webauthn_registration')),
  challenge text,
  device_name text,
  factor_id uuid references mfa_factors(id) on delete cascade,
  label text,
  attempts smallint not null default 0 check (attempts between 0 and 10),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mfa_challenges_expiry
  on mfa_challenges(expires_at) where consumed_at is null;

create table if not exists mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  code_hash text not null unique,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mfa_recovery_codes_user_unused
  on mfa_recovery_codes(user_id) where used_at is null;

revoke all on mfa_challenges, mfa_recovery_codes from public;
