-- Operational and integrity hardening for existing beta databases.

-- Reconcile quota accounting before enforcing the invariant. Pending uploads
-- remain reserved; deleted uploads do not consume quota.
update users u
set used_bytes = coalesce((
  select sum(a.size)
  from attachments a
  where a.user_id = u.id and a.status in ('pending', 'complete')
), 0);

alter table users drop constraint if exists users_quota_bounds;
alter table users add constraint users_quota_bounds
  check (quota_bytes between 0 and 1099511627776 and used_bytes between 0 and quota_bytes);

alter table sessions add column if not exists reauthenticated_at timestamptz;
update sessions set reauthenticated_at = created_at where reauthenticated_at is null;

-- Keep only the newest outstanding recovery request before adding a concurrency
-- guard. This also makes recovery-start retries deterministic.
with ranked as (
  select id, row_number() over (partition by user_id order by created_at desc, id desc) as position
  from recovery_requests
  where completed_at is null
)
delete from recovery_requests r using ranked
where r.id = ranked.id and ranked.position > 1;

create unique index if not exists recovery_requests_one_active_per_user
  on recovery_requests(user_id) where completed_at is null;
create index if not exists recovery_requests_expiry
  on recovery_requests(expires_at) where completed_at is null;
create index if not exists verification_tokens_expiry
  on email_verification_tokens(expires_at) where used_at is null;
create index if not exists sessions_expiry
  on sessions(expires_at) where revoked_at is null;
create index if not exists vault_items_tombstones
  on vault_items(user_id, deleted_at) where deleted_at is not null;
create index if not exists attachments_item_status
  on attachments(user_id, item_id, status);
create index if not exists attachments_pending_expiry
  on attachments(created_at) where status = 'pending';

comment on column users.used_bytes is
  'Reserved plus completed encrypted attachment bytes; maintained transactionally.';
