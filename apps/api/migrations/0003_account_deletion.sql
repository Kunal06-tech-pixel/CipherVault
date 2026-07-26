alter table users add column if not exists purge_after timestamptz;

alter table users drop constraint if exists users_deletion_schedule;
alter table users add constraint users_deletion_schedule check (
  (deleted_at is null and purge_after is null)
  or (deleted_at is not null and purge_after is not null and purge_after >= deleted_at)
);

create index if not exists users_pending_purge
  on users(purge_after) where deleted_at is not null;
