-- QueueSmart Assignment 4 core database tables for Supabase/Postgres.
-- This matches the lowercase table and column names used by the current Supabase project.

create table if not exists usercredentials (
  id text primary key check (char_length(id) between 1 and 64),
  email text not null unique check (
    char_length(email) <= 254
    and email = lower(email)
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  passwordhash text not null check (char_length(passwordhash) between 1 and 255 and passwordhash like 'scrypt:%'),
  role text not null default 'user' check (role in ('user', 'admin')),
  createdat timestamptz not null default now()
);

create table if not exists userprofile (
  id text primary key check (char_length(id) between 1 and 64),
  userid text not null unique references usercredentials(id) on delete cascade check (char_length(userid) between 1 and 64),
  name text not null check (char_length(name) between 2 and 100),
  contactinfo text check (contactinfo is null or char_length(contactinfo) <= 100),
  createdat timestamptz not null default now()
);

create table if not exists service (
  id text primary key check (char_length(id) between 1 and 64),
  name text not null check (char_length(name) between 2 and 100),
  description text not null check (char_length(description) between 2 and 500),
  expectedduration integer not null check (expectedduration between 1 and 480),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  isopen boolean not null default true,
  createdat timestamptz not null default now()
);

alter table service add column if not exists isopen boolean not null default true;

create table if not exists queue (
  id text primary key check (char_length(id) between 1 and 64),
  serviceid text not null references service(id) on delete cascade check (char_length(serviceid) between 1 and 64),
  status text not null default 'open' check (status in ('open', 'closed')),
  createdat timestamptz not null default now()
);

create table if not exists queueentry (
  id text primary key check (char_length(id) between 1 and 64),
  queueid text not null references queue(id) on delete cascade check (char_length(queueid) between 1 and 64),
  userid text not null references usercredentials(id) on delete cascade check (char_length(userid) between 1 and 64),
  position integer not null check (position > 0),
  jointime timestamptz not null default now(),
  status text not null default 'waiting' check (status in ('waiting', 'served', 'canceled'))
);

create table if not exists history (
  id text primary key check (char_length(id) between 1 and 64),
  userid text not null references usercredentials(id) on delete cascade check (char_length(userid) between 1 and 64),
  message text not null check (char_length(message) between 1 and 1000),
  createdat timestamptz not null default now(),
  status text not null default 'viewed' check (status in ('sent', 'viewed')),
  outcome text check (outcome in ('served', 'left')),
  wait_minutes integer not null default 0 check (wait_minutes >= 0)
);

alter table history alter column outcome drop not null;
alter table history add column if not exists wait_minutes integer not null default 0;
update history set outcome = status where outcome is null and status in ('served', 'left');
update history set status = 'viewed' where status in ('served', 'left');
alter table history drop constraint if exists history_status_check;
alter table history drop constraint if exists history_status_check1;
alter table history drop constraint if exists history_status_check2;
alter table history add constraint history_status_check check (status in ('sent', 'viewed'));
alter table history drop constraint if exists history_outcome_check;
alter table history drop constraint if exists history_outcome_check1;
alter table history add constraint history_outcome_check check (outcome is null or outcome in ('served', 'left'));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'usercredentials_id_length_check') then
    alter table usercredentials add constraint usercredentials_id_length_check check (char_length(id) between 1 and 64);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'usercredentials_email_format_check') then
    alter table usercredentials add constraint usercredentials_email_format_check check (
      char_length(email) <= 254
      and email = lower(email)
      and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'usercredentials_passwordhash_check') then
    alter table usercredentials add constraint usercredentials_passwordhash_check check (
      char_length(passwordhash) between 1 and 255
      and passwordhash like 'scrypt:%'
    );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'userprofile_id_length_check') then
    alter table userprofile add constraint userprofile_id_length_check check (char_length(id) between 1 and 64);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'userprofile_userid_length_check') then
    alter table userprofile add constraint userprofile_userid_length_check check (char_length(userid) between 1 and 64);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'userprofile_contactinfo_length_check') then
    alter table userprofile add constraint userprofile_contactinfo_length_check check (
      contactinfo is null or char_length(contactinfo) <= 100
    );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'service_id_length_check') then
    alter table service add constraint service_id_length_check check (char_length(id) between 1 and 64);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'service_expectedduration_range_check') then
    alter table service add constraint service_expectedduration_range_check check (expectedduration between 1 and 480);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'queue_id_length_check') then
    alter table queue add constraint queue_id_length_check check (char_length(id) between 1 and 64);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'queue_serviceid_length_check') then
    alter table queue add constraint queue_serviceid_length_check check (char_length(serviceid) between 1 and 64);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'queueentry_id_length_check') then
    alter table queueentry add constraint queueentry_id_length_check check (char_length(id) between 1 and 64);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'queueentry_queueid_length_check') then
    alter table queueentry add constraint queueentry_queueid_length_check check (char_length(queueid) between 1 and 64);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'queueentry_userid_length_check') then
    alter table queueentry add constraint queueentry_userid_length_check check (char_length(userid) between 1 and 64);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'history_id_length_check') then
    alter table history add constraint history_id_length_check check (char_length(id) between 1 and 64);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'history_userid_length_check') then
    alter table history add constraint history_userid_length_check check (char_length(userid) between 1 and 64);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'history_wait_minutes_check') then
    alter table history add constraint history_wait_minutes_check check (wait_minutes >= 0);
  end if;
end $$;

update queueentry set status = 'waiting' where status = 'almost_ready';
alter table queueentry drop constraint if exists queueentry_status_check;
alter table queueentry add constraint queueentry_status_check check (status in ('waiting', 'served', 'canceled'));
drop index if exists idx_queue_entry_active_user;

create index if not exists idx_usercredentials_email on usercredentials(email);
create unique index if not exists idx_usercredentials_email_lower on usercredentials(lower(email));
create index if not exists idx_userprofile_userid on userprofile(userid);
create index if not exists idx_service_priority on service(priority);
create unique index if not exists idx_queue_open_service on queue(serviceid) where status = 'open';
create index if not exists idx_queueentry_queue_position on queueentry(queueid, position);
create index if not exists idx_queueentry_user_status on queueentry(userid, status);
create unique index if not exists idx_queueentry_waiting_user on queueentry(queueid, userid) where status = 'waiting';
create index if not exists idx_history_user_created on history(userid, createdat desc);
create index if not exists idx_history_notification_user_created on history(userid, createdat desc) where outcome is null;

select pg_notify('pgrst', 'reload schema');
