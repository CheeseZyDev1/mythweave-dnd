create or replace function public.link_dice_member_character(target_table_id uuid,target_character_id uuid)
returns public.dice_table_members language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;member public.dice_table_members%rowtype;
begin
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception 'character not found';end if;
  select * into member from public.dice_table_members where table_id=target_table_id and user_id=auth.uid();if member.user_id is null then raise exception 'not a member';end if;
  if exists(select 1 from public.solo_adventures solo where solo.user_id=auth.uid() and solo.status='active' and solo.character_id<>hero.id) then raise exception 'active solo character required';end if;
  if not exists(select 1 from public.character_world_positions position where position.character_id=hero.id) then perform public.ensure_character_world_position(hero.id);end if;
  update public.dice_table_members set character_id=hero.id where table_id=target_table_id and user_id=auth.uid() returning * into member;
  return member;
end;$$;
