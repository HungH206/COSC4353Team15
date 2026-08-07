-- QueueSmart Assignment 4 core database tables for Supabase/Postgres.
-- This matches the lowercase table and column names used by the current Supabase project.

create table if not exists usercredentials (
  id text primary key,
  email text not null unique,
  passwordhash text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  createdat timestamptz not null default now()
);

create table if not exists userprofile (
  id text primary key,
  userid text not null unique references usercredentials(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  contactinfo text,
  createdat timestamptz not null default now()
);

create table if not exists service (
  id text primary key,
  name text not null check (char_length(name) between 2 and 100),
  description text not null check (char_length(description) between 2 and 500),
  expectedduration integer not null check (expectedduration > 0),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  createdat timestamptz not null default now()
);

create table if not exists queue (
  id text primary key,
  serviceid text not null references service(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  createdat timestamptz not null default now()
);

create table if not exists queueentry (
  id text primary key,
  queueid text not null references queue(id) on delete cascade,
  userid text not null references usercredentials(id) on delete cascade,
  position integer not null check (position > 0),
  jointime timestamptz not null default now(),
  status text not null default 'waiting' check (status in ('waiting', 'served', 'canceled'))
);

create table if not exists history (
  id text primary key,
  userid text not null references usercredentials(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 1000),
  createdat timestamptz not null default now(),
  status text not null default 'viewed' check (status in ('sent', 'viewed')),
  outcome text check (outcome in ('served', 'left'))
);

update queueentry set status = 'waiting' where status = 'almost_ready';
alter table queueentry drop constraint if exists queueentry_status_check;
alter table queueentry add constraint queueentry_status_check check (status in ('waiting', 'served', 'canceled'));
drop index if exists idx_queue_entry_active_user;

create index if not exists idx_usercredentials_email on usercredentials(email);
create index if not exists idx_userprofile_userid on userprofile(userid);
create index if not exists idx_service_priority on service(priority);
create unique index if not exists idx_queue_open_service on queue(serviceid) where status = 'open';
create index if not exists idx_queueentry_queue_position on queueentry(queueid, position);
create index if not exists idx_queueentry_user_status on queueentry(userid, status);
create unique index if not exists idx_queueentry_waiting_user on queueentry(queueid, userid) where status = 'waiting';
create index if not exists idx_history_user_created on history(userid, createdat desc);
create index if not exists idx_history_notification_user_created on history(userid, createdat desc) where outcome is null;

select pg_notify('pgrst', 'reload schema');
