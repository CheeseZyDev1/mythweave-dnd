create or replace function public.get_party_awareness(target_table_id uuid,viewer_character_id uuid)
returns table(user_id uuid,display_name text,role text,character_id uuid,character_name text,location_id bigint,location_name text,awareness_tier text) language plpgsql stable security definer set search_path='' as $$
declare viewer public.characters%rowtype;viewer_position public.character_world_positions%rowtype;viewer_location public.world_locations%rowtype;
begin
  if not public.is_dice_table_member(target_table_id) then raise exception 'not a member';end if;
  select hero.* into viewer from public.characters hero where hero.id=viewer_character_id and hero.user_id=auth.uid();if viewer.id is null then raise exception 'character not found';end if;
  if not exists(select 1 from public.dice_table_members linked where linked.table_id=target_table_id and linked.user_id=auth.uid() and linked.character_id=viewer.id) then raise exception 'character not linked';end if;
  select position.* into viewer_position from public.character_world_positions position where position.character_id=viewer.id;
  select location.* into viewer_location from public.world_locations location where location.id=viewer_position.location_id;
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
