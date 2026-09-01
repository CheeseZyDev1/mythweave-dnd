create table public.initiative_entries (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.dice_tables(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  initiative smallint not null check (initiative between -10 and 99),
  created_at timestamptz not null default now()
);

create table public.initiative_trackers (
  table_id uuid primary key references public.dice_tables(id) on delete cascade,
  current_entry_id uuid references public.initiative_entries(id) on delete set null,
  round_number integer not null default 1 check (round_number between 1 and 9999),
  active boolean not null default false,
  updated_at timestamptz not null default now()
);

create index initiative_entries_order_idx on public.initiative_entries(table_id, initiative desc, created_at);
alter table public.initiative_entries enable row level security;
alter table public.initiative_trackers enable row level security;

create policy "Members can view initiative entries"
  on public.initiative_entries for select to authenticated
  using (public.is_dice_table_member(table_id));
create policy "Members can add initiative entries"
  on public.initiative_entries for insert to authenticated
  with check ((select auth.uid()) = created_by and public.is_dice_table_member(table_id));
create policy "Members can remove initiative entries"
  on public.initiative_entries for delete to authenticated
  using (public.is_dice_table_member(table_id));
create policy "Members can view initiative tracker"
  on public.initiative_trackers for select to authenticated
  using (public.is_dice_table_member(table_id));

create or replace function public.advance_initiative(target_table_id uuid)
returns table (current_entry uuid, new_round integer, is_active boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ordered_ids uuid[];
  tracker public.initiative_trackers%rowtype;
  current_position integer;
begin
  if auth.uid() is null or not public.is_dice_table_member(target_table_id) then
    raise exception 'not a member';
  end if;

  insert into public.initiative_trackers (table_id)
  values (target_table_id)
  on conflict on constraint initiative_trackers_pkey do nothing;

  select * into tracker from public.initiative_trackers
  where table_id = target_table_id for update;
  select array_agg(entry.id order by entry.initiative desc, entry.created_at, entry.id)
  into ordered_ids from public.initiative_entries as entry
  where entry.table_id = target_table_id;

  if ordered_ids is null or array_length(ordered_ids, 1) is null then
    update public.initiative_trackers set current_entry_id = null, active = false, round_number = 1, updated_at = now()
    where table_id = target_table_id;
    return query select null::uuid, 1, false;
    return;
  end if;

  current_position := array_position(ordered_ids, tracker.current_entry_id);
  if not tracker.active or current_position is null then
    tracker.current_entry_id := ordered_ids[1];
    tracker.round_number := 1;
  elsif current_position >= array_length(ordered_ids, 1) then
    tracker.current_entry_id := ordered_ids[1];
    tracker.round_number := least(tracker.round_number + 1, 9999);
  else
    tracker.current_entry_id := ordered_ids[current_position + 1];
  end if;

  update public.initiative_trackers set current_entry_id = tracker.current_entry_id, round_number = tracker.round_number, active = true, updated_at = now()
  where table_id = target_table_id;
  return query select tracker.current_entry_id, tracker.round_number, true;
end;
$$;

create or replace function public.reset_initiative(target_table_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_dice_table_member(target_table_id) then
    raise exception 'not a member';
  end if;
  delete from public.initiative_entries where table_id = target_table_id;
  insert into public.initiative_trackers (table_id, current_entry_id, round_number, active, updated_at)
  values (target_table_id, null, 1, false, now())
  on conflict on constraint initiative_trackers_pkey
  do update set current_entry_id = null, round_number = 1, active = false, updated_at = now();
end;
$$;

revoke all on function public.advance_initiative(uuid) from public;
revoke all on function public.reset_initiative(uuid) from public;
grant execute on function public.advance_initiative(uuid) to authenticated;
grant execute on function public.reset_initiative(uuid) to authenticated;

alter publication supabase_realtime add table public.initiative_entries;
alter publication supabase_realtime add table public.initiative_trackers;

