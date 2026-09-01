create table public.dice_tables (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.dice_table_members (
  table_id uuid not null references public.dice_tables(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  joined_at timestamptz not null default now(),
  primary key (table_id, user_id)
);

create table public.dice_rolls (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.dice_tables(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  roller_name text not null check (char_length(roller_name) between 1 and 40),
  dice_count smallint not null check (dice_count between 1 and 10),
  dice_sides smallint not null check (dice_sides in (4, 6, 8, 10, 12, 20, 100)),
  modifier smallint not null default 0 check (modifier between -100 and 100),
  rolls smallint[] not null,
  total integer not null,
  created_at timestamptz not null default now()
);

create index dice_table_members_user_id_idx on public.dice_table_members(user_id);
create index dice_rolls_table_created_idx on public.dice_rolls(table_id, created_at desc);

alter table public.dice_tables enable row level security;
alter table public.dice_table_members enable row level security;
alter table public.dice_rolls enable row level security;

create or replace function public.is_dice_table_member(target_table_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.dice_table_members
    where table_id = target_table_id and user_id = (select auth.uid())
  );
$$;

create policy "Members can view their dice tables"
  on public.dice_tables for select to authenticated
  using (public.is_dice_table_member(id));

create policy "Members can view dice table members"
  on public.dice_table_members for select to authenticated
  using (public.is_dice_table_member(table_id));

create policy "Members can view dice rolls"
  on public.dice_rolls for select to authenticated
  using (public.is_dice_table_member(table_id));

create policy "Members can create their own dice rolls"
  on public.dice_rolls for insert to authenticated
  with check ((select auth.uid()) = user_id and public.is_dice_table_member(table_id));

create or replace function public.create_dice_table(member_name text)
returns table (table_id uuid, table_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  new_code text;
  clean_name text;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  clean_name := left(trim(member_name), 40);
  if char_length(clean_name) < 1 then raise exception 'display name required'; end if;

  loop
    new_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 4) || '-' || substr(encode(gen_random_bytes(6), 'hex'), 5, 4) || '-' || substr(encode(gen_random_bytes(6), 'hex'), 9, 4));
    begin
      insert into public.dice_tables (code, created_by) values (new_code, (select auth.uid())) returning id into new_id;
      exit;
    exception when unique_violation then
    end;
  end loop;

  insert into public.dice_table_members (table_id, user_id, display_name)
  values (new_id, (select auth.uid()), clean_name);
  return query select new_id, new_code;
end;
$$;

create or replace function public.join_dice_table(invite_code text, member_name text)
returns table (table_id uuid, table_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_id uuid;
  found_code text;
  clean_name text;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  clean_name := left(trim(member_name), 40);
  if char_length(clean_name) < 1 then raise exception 'display name required'; end if;
  found_code := upper(trim(invite_code));
  select id into found_id from public.dice_tables where code = found_code;
  if found_id is null then raise exception 'table not found'; end if;

  insert into public.dice_table_members (table_id, user_id, display_name)
  values (found_id, (select auth.uid()), clean_name)
  on conflict (table_id, user_id) do update set display_name = excluded.display_name;
  return query select found_id, found_code;
end;
$$;

revoke all on function public.is_dice_table_member(uuid) from public;
revoke all on function public.create_dice_table(text) from public;
revoke all on function public.join_dice_table(text, text) from public;
grant execute on function public.is_dice_table_member(uuid) to authenticated;
grant execute on function public.create_dice_table(text) to authenticated;
grant execute on function public.join_dice_table(text, text) to authenticated;

alter publication supabase_realtime add table public.dice_rolls;

