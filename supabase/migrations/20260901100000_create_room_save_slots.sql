create table public.room_saves (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.dice_tables(id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  save_name text not null check (char_length(save_name) between 1 and 60),
  state jsonb not null,
  entry_count smallint not null default 0,
  round_number integer not null default 1,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (table_id, slot)
);

alter table public.room_saves enable row level security;
create policy "Room members can view save slots"
  on public.room_saves for select to authenticated
  using (public.is_dice_table_member(table_id));

create or replace function public.is_room_dm(target_table_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.dice_table_members
    where table_id = target_table_id and user_id = auth.uid() and role = 'dm'
  );
$$;

create or replace function public.save_room_snapshot(target_table_id uuid, target_slot smallint, target_name text)
returns public.room_saves
language plpgsql security definer set search_path = '' as $$
declare
  entries jsonb;
  tracker jsonb;
  saved public.room_saves%rowtype;
  clean_name text;
  saved_round integer;
begin
  if not public.is_room_dm(target_table_id) then raise exception 'dm required'; end if;
  if target_slot < 1 or target_slot > 3 then raise exception 'invalid slot'; end if;
  clean_name := left(trim(target_name), 60);
  if char_length(clean_name) < 1 then clean_name := 'Save Slot ' || target_slot; end if;
  perform 1 from public.dice_tables where id = target_table_id for update;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', entry.id, 'name', entry.name, 'initiative', entry.initiative, 'created_at', entry.created_at
  ) order by entry.initiative desc, entry.created_at), '[]'::jsonb)
  into entries from public.initiative_entries as entry where entry.table_id = target_table_id;

  select jsonb_build_object('current_entry_id', current_entry_id, 'round_number', round_number, 'active', active)
  into tracker from public.initiative_trackers where table_id = target_table_id;
  tracker := coalesce(tracker, jsonb_build_object('current_entry_id', null, 'round_number', 1, 'active', false));
  saved_round := coalesce((tracker->>'round_number')::integer, 1);

  insert into public.room_saves (table_id, slot, save_name, state, entry_count, round_number, created_by)
  values (target_table_id, target_slot, clean_name, jsonb_build_object('initiative_entries', entries, 'initiative_tracker', tracker), jsonb_array_length(entries), saved_round, auth.uid())
  on conflict on constraint room_saves_table_id_slot_key do update
  set save_name = excluded.save_name, state = excluded.state, entry_count = excluded.entry_count,
      round_number = excluded.round_number, created_by = excluded.created_by, updated_at = now()
  returning * into saved;
  return saved;
end;
$$;

create or replace function public.load_room_snapshot(target_table_id uuid, target_slot smallint)
returns public.room_saves
language plpgsql security definer set search_path = '' as $$
declare
  saved public.room_saves%rowtype;
  item jsonb;
  tracker jsonb;
  restored_current uuid;
begin
  if not public.is_room_dm(target_table_id) then raise exception 'dm required'; end if;
  perform 1 from public.dice_tables where id = target_table_id for update;
  select * into saved from public.room_saves where table_id = target_table_id and slot = target_slot;
  if saved.id is null then raise exception 'save not found'; end if;

  delete from public.initiative_entries where table_id = target_table_id;
  for item in select * from jsonb_array_elements(coalesce(saved.state->'initiative_entries', '[]'::jsonb)) loop
    insert into public.initiative_entries (id, table_id, created_by, name, initiative, created_at)
    values ((item->>'id')::uuid, target_table_id, auth.uid(), left(item->>'name', 40), (item->>'initiative')::smallint, (item->>'created_at')::timestamptz);
  end loop;

  tracker := coalesce(saved.state->'initiative_tracker', '{}'::jsonb);
  restored_current := nullif(tracker->>'current_entry_id', '')::uuid;
  if restored_current is not null and not exists (select 1 from public.initiative_entries where id = restored_current and table_id = target_table_id) then restored_current := null; end if;
  insert into public.initiative_trackers (table_id, current_entry_id, round_number, active, updated_at)
  values (target_table_id, restored_current, greatest(1, coalesce((tracker->>'round_number')::integer, 1)), coalesce((tracker->>'active')::boolean, false), now())
  on conflict on constraint initiative_trackers_pkey do update
  set current_entry_id = excluded.current_entry_id, round_number = excluded.round_number, active = excluded.active, updated_at = now();
  return saved;
end;
$$;

revoke all on function public.is_room_dm(uuid) from public;
revoke all on function public.save_room_snapshot(uuid, smallint, text) from public;
revoke all on function public.load_room_snapshot(uuid, smallint) from public;
grant execute on function public.is_room_dm(uuid) to authenticated;
grant execute on function public.save_room_snapshot(uuid, smallint, text) to authenticated;
grant execute on function public.load_room_snapshot(uuid, smallint) to authenticated;
