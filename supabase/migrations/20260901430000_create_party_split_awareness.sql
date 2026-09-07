alter table public.dice_table_members add column character_id uuid references public.characters(id) on delete set null;
create index dice_table_members_character_idx on public.dice_table_members(character_id) where character_id is not null;

create policy "Party members can view linked world positions" on public.character_world_positions for select to authenticated using(
  exists(
    select 1 from public.dice_table_members viewer
    join public.dice_table_members subject on subject.table_id=viewer.table_id
    where viewer.user_id=auth.uid() and subject.character_id=character_world_positions.character_id and public.is_dice_table_member(viewer.table_id)
  )
);

create or replace function public.link_dice_member_character(target_table_id uuid,target_character_id uuid)
returns public.dice_table_members language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;member public.dice_table_members%rowtype;
begin
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception 'character not found';end if;
  select * into member from public.dice_table_members where table_id=target_table_id and user_id=auth.uid();if member.user_id is null then raise exception 'not a member';end if;
  if exists(select 1 from public.solo_adventures solo where solo.user_id=auth.uid() and solo.status='active' and solo.character_id<>hero.id) then raise exception 'active solo character required';end if;
  perform public.ensure_character_world_position(hero.id);
  update public.dice_table_members set character_id=hero.id where table_id=target_table_id and user_id=auth.uid() returning * into member;
  return member;
end;$$;

create or replace function public.get_party_awareness(target_table_id uuid,viewer_character_id uuid)
returns table(user_id uuid,display_name text,role text,character_id uuid,character_name text,location_id bigint,location_name text,awareness_tier text) language plpgsql stable security definer set search_path='' as $$
declare viewer public.characters%rowtype;viewer_position public.character_world_positions%rowtype;viewer_location public.world_locations%rowtype;
begin
  if not public.is_dice_table_member(target_table_id) then raise exception 'not a member';end if;
  select * into viewer from public.characters where id=viewer_character_id and user_id=auth.uid();if viewer.id is null then raise exception 'character not found';end if;
  if not exists(select 1 from public.dice_table_members where table_id=target_table_id and user_id=auth.uid() and character_id=viewer.id) then raise exception 'character not linked';end if;
  select * into viewer_position from public.character_world_positions where character_id=viewer.id;
  select * into viewer_location from public.world_locations where id=viewer_position.location_id;
  return query
  select member.user_id,member.display_name,member.role,member.character_id,hero.name,position.location_id,location.name_th,
    case
      when position.location_id is null or viewer_position.location_id is null then 'unknown'
      when position.location_id=viewer_position.location_id then 'same_location'
      when coalesce(location.parent_id,location.id)=coalesce(viewer_location.parent_id,viewer_location.id) then 'same_city'
      else 'far_city'
    end
  from public.dice_table_members member
  left join public.characters hero on hero.id=member.character_id
  left join public.character_world_positions position on position.character_id=member.character_id
  left join public.world_locations location on location.id=position.location_id
  where member.table_id=target_table_id order by member.joined_at;
end;$$;

revoke all on function public.link_dice_member_character(uuid,uuid) from public;
revoke all on function public.get_party_awareness(uuid,uuid) from public;
grant execute on function public.link_dice_member_character(uuid,uuid) to authenticated;
grant execute on function public.get_party_awareness(uuid,uuid) to authenticated;
alter publication supabase_realtime add table public.character_world_positions;
