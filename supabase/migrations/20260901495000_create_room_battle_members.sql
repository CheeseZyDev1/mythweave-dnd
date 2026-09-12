create or replace function public.get_room_battle_members(target_table_id uuid)
returns table(
  user_id uuid,
  display_name text,
  role text,
  character_id uuid,
  character_name text,
  race text,
  character_class text,
  appearance jsonb,
  hp_current integer,
  hp_max integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    member.user_id,
    member.display_name,
    member.role,
    member.character_id,
    hero.name,
    hero.race,
    hero.character_class,
    hero.appearance,
    hero.hp_current,
    hero.hp_max
  from public.dice_table_members member
  left join public.characters hero on hero.id = member.character_id
  where member.table_id = target_table_id
    and exists (
      select 1
      from public.dice_table_members viewer
      where viewer.table_id = target_table_id
        and viewer.user_id = (select auth.uid())
    )
  order by member.joined_at;
$$;

revoke all on function public.get_room_battle_members(uuid) from public;
grant execute on function public.get_room_battle_members(uuid) to authenticated;
