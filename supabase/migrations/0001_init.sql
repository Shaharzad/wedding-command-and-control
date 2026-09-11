-- ===========================================================================
-- Wedding planner — shared workspace schema.
--
-- One wedding is a workspace. People are members of it with a role. All 18
-- client collections live in one `records` table keyed by (wedding, collection,
-- id), because every figure in this app is computed client-side from the whole
-- dataset — there is nothing for the database to aggregate, and a generic table
-- means a new planner feature never needs a migration.
--
-- Record ids are minted by the client (task_m3x9…) and used verbatim as the
-- primary key, so a record has a stable identity before it is ever written.
-- ===========================================================================

create extension if not exists citext;
create extension if not exists pgcrypto;

-- ------------------------------------------------------------- weddings ----

create table if not exists public.weddings (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Our wedding',
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------------- members ----
-- A row with user_id null and invited_email set is a pending invitation. It
-- becomes a membership when that person signs in and calls accept_invite().

create table if not exists public.members (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  user_id       uuid references auth.users (id) on delete cascade,
  invited_email citext,
  role          text not null default 'editor'
                check (role in ('owner', 'editor', 'viewer')),
  display_name  text,
  invited_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  constraint members_identify check (user_id is not null or invited_email is not null)
);

create unique index if not exists members_user_uniq
  on public.members (wedding_id, user_id) where user_id is not null;
create unique index if not exists members_email_uniq
  on public.members (wedding_id, invited_email) where user_id is null;
create index if not exists members_by_user on public.members (user_id);

-- -------------------------------------------------------------- records ----

create table if not exists public.records (
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  collection text not null,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  -- Deletes are soft so that Undo can restore one record without disturbing
  -- anything a collaborator has changed since.
  deleted_at timestamptz,
  primary key (wedding_id, collection, id)
);

create index if not exists records_by_wedding on public.records (wedding_id, collection);
create index if not exists records_changed on public.records (wedding_id, updated_at desc);

-- ------------------------------------------------------------- comments ----

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  collection text not null,
  record_id  text not null,
  author_id  uuid references auth.users (id) on delete set null,
  body       text not null check (length(btrim(body)) > 0 and length(body) <= 4000),
  created_at timestamptz not null default now()
);

create index if not exists comments_on_record
  on public.comments (wedding_id, collection, record_id, created_at);

-- ------------------------------------------------------------- activity ----

create table if not exists public.activity (
  id         bigserial primary key,
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  actor      uuid references auth.users (id) on delete set null,
  collection text not null,
  record_id  text not null,
  op         text not null,
  summary    text,
  at         timestamptz not null default now()
);

create index if not exists activity_feed on public.activity (wedding_id, at desc);

-- =========================================================== membership ====
-- These are SECURITY DEFINER so they can read `members` without triggering the
-- policies on `members` — otherwise every policy that asks "is this person a
-- member?" would recurse into itself.

create or replace function public.member_role(w uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
    from public.members m
   where m.wedding_id = w
     and m.user_id = auth.uid()
     and m.accepted_at is not null
   limit 1;
$$;

create or replace function public.is_member(w uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.member_role(w) is not null;
$$;

create or replace function public.can_write(w uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.member_role(w) in ('owner', 'editor'), false);
$$;

create or replace function public.is_owner(w uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.member_role(w) = 'owner', false);
$$;

-- ---------------------------------------------------- create and join -----
-- Creating a wedding and becoming its owner has to happen together, or the
-- new row would be invisible to its own creator.

create or replace function public.create_wedding(wedding_name text, owner_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  insert into public.weddings (name, created_by)
       values (coalesce(nullif(btrim(wedding_name), ''), 'Our wedding'), auth.uid())
    returning id into new_id;

  insert into public.members (wedding_id, user_id, role, display_name, accepted_at)
       values (new_id, auth.uid(), 'owner', owner_name, now());

  return new_id;
end;
$$;

-- Claims any pending invitation addressed to the signed-in person's email.
-- Returns how many were claimed.
-- Sets your own display name, and nothing else, on a wedding you belong to.
-- Deliberately narrow: members_update stays owner-only so nobody can quietly
-- promote themselves by writing to their own row.
create or replace function public.set_my_name(wedding uuid, new_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare cleaned text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  cleaned := nullif(btrim(new_name), '');
  if cleaned is null then
    raise exception 'a name is required';
  end if;

  update public.members
     set display_name = left(cleaned, 60)
   where wedding_id = wedding
     and user_id = auth.uid()
     and accepted_at is not null;

  if not found then
    raise exception 'you are not a member of that wedding';
  end if;

  return left(cleaned, 60);
end;
$$;

revoke all on function public.set_my_name(uuid, text) from public;
grant execute on function public.set_my_name(uuid, text) to authenticated;

create or replace function public.accept_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare claimed integer;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  with taken as (
    update public.members m
       set user_id = auth.uid(),
           accepted_at = now()
     where m.user_id is null
       and m.invited_email = (auth.jwt() ->> 'email')::citext
       -- never clobber an existing membership for the same wedding
       and not exists (
         select 1 from public.members x
          where x.wedding_id = m.wedding_id and x.user_id = auth.uid()
       )
    returning 1
  )
  select count(*) into claimed from taken;

  return claimed;
end;
$$;

-- ================================================================ RLS ======

alter table public.weddings enable row level security;
alter table public.members  enable row level security;
alter table public.records  enable row level security;
alter table public.comments enable row level security;
alter table public.activity enable row level security;

-- weddings -----------------------------------------------------------------
drop policy if exists weddings_read on public.weddings;
create policy weddings_read on public.weddings
  for select using (public.is_member(id));
drop policy if exists weddings_update on public.weddings;
create policy weddings_update on public.weddings
  for update using (public.is_owner(id)) with check (public.is_owner(id));
drop policy if exists weddings_delete on public.weddings;
create policy weddings_delete on public.weddings
  for delete using (public.is_owner(id));
-- inserts go through create_wedding() only

-- members ------------------------------------------------------------------
-- You can see the member list of a wedding you belong to, and you can always
-- see an invitation addressed to your own email address.
drop policy if exists members_read on public.members;
create policy members_read on public.members
  for select using (
    public.is_member(wedding_id)
    or user_id = auth.uid()
    or invited_email = (auth.jwt() ->> 'email')::citext
  );
drop policy if exists members_insert on public.members;
create policy members_insert on public.members
  for insert with check (public.is_owner(wedding_id));
drop policy if exists members_update on public.members;
create policy members_update on public.members
  for update using (public.is_owner(wedding_id)) with check (public.is_owner(wedding_id));
drop policy if exists members_delete on public.members;
create policy members_delete on public.members
  for delete using (public.is_owner(wedding_id));

-- records ------------------------------------------------------------------
drop policy if exists records_read on public.records;
create policy records_read on public.records
  for select using (public.is_member(wedding_id));
drop policy if exists records_insert on public.records;
create policy records_insert on public.records
  for insert with check (public.can_write(wedding_id));
drop policy if exists records_update on public.records;
create policy records_update on public.records
  for update using (public.can_write(wedding_id)) with check (public.can_write(wedding_id));
-- Rows are normally retired with deleted_at rather than removed, so that Undo
-- has something to restore. Outright deletion exists only for the wedding-wide
-- destructive actions (reset, import over the top), so it is owner-only.
drop policy if exists records_delete on public.records;
create policy records_delete on public.records
  for delete using (public.is_owner(wedding_id));

-- comments -----------------------------------------------------------------
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments
  for select using (public.is_member(wedding_id));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert with check (public.can_write(wedding_id) and author_id = auth.uid());
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
  for delete using (author_id = auth.uid() or public.is_owner(wedding_id));

-- activity -----------------------------------------------------------------
drop policy if exists activity_read on public.activity;
create policy activity_read on public.activity
  for select using (public.is_member(wedding_id));
-- written by trigger only

-- ========================================================= bookkeeping =====

create or replace function public.touch_record()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

drop trigger if exists records_touch on public.records;
create trigger records_touch
  before insert or update on public.records
  for each row execute function public.touch_record();

-- A readable label for the activity feed, pulled from whichever field that
-- collection happens to name its records by.
create or replace function public.record_label(d jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    d ->> 'title', d ->> 'name', d ->> 'item', d ->> 'outfit',
    d ->> 'description', d ->> 'person', d ->> 'from', d ->> 'category', ''
  );
$$;

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare op_name text;
begin
  -- Daily snapshots and internal singletons change on their own; logging them
  -- would bury everything a person actually did.
  if new.collection in ('history', 'singleton') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    op_name := 'create';
  elsif new.deleted_at is not null and old.deleted_at is null then
    op_name := 'delete';
  elsif new.deleted_at is null and old.deleted_at is not null then
    op_name := 'restore';
  elsif new.data is distinct from old.data then
    op_name := 'update';
  else
    return new;
  end if;

  insert into public.activity (wedding_id, actor, collection, record_id, op, summary)
       values (new.wedding_id, auth.uid(), new.collection, new.id, op_name,
               public.record_label(new.data));
  return new;
end;
$$;

drop trigger if exists records_activity on public.records;
create trigger records_activity
  after insert or update on public.records
  for each row execute function public.log_activity();

-- Two people paying the same vendor at once must not lose one payment, so the
-- amount is added by the database rather than read, added and written back.
create or replace function public.bump_amount(
  w uuid, coll text, rec text, field text, delta numeric, patch jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare updated jsonb;
begin
  if not public.can_write(w) then
    raise exception 'not allowed';
  end if;

  -- patch carries the fields that travel with the payment (date, status).
  -- They are last-writer-wins; only the amount has to be exact.
  update public.records r
     set data = jsonb_set(
           r.data || coalesce(patch, '{}'::jsonb),
           array[field],
           to_jsonb(greatest(0, coalesce((r.data ->> field)::numeric, 0) + delta))
         )
   where r.wedding_id = w and r.collection = coll and r.id = rec
  returning r.data into updated;

  return updated;
end;
$$;

-- ========================================================== realtime =======

/* Realtime delivery for the tables people watch. Adding a table twice is
   an error, so ask first. */
do $pub$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'records'
  ) then
    alter publication supabase_realtime add table public.records;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'activity'
  ) then
    alter publication supabase_realtime add table public.activity;
  end if;
end
$pub$;
