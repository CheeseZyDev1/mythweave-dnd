create or replace function public.create_dimension_dice_table(member_name text,target_character_id uuid)
returns table(table_id uuid,table_code text)
language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;new_id uuid;new_code text;clean_name text;
begin
  if auth.uid()is null then raise exception'authentication required';end if;
  clean_name:=left(trim(member_name),40);if char_length(clean_name)<1 then raise exception'display name required';end if;
  select*into hero from public.characters where id=target_character_id and user_id=auth.uid();
  if hero.id is null then raise exception'character not found';end if;
  if exists(select 1 from public.solo_adventures where user_id=auth.uid()and status='active')then raise exception'solo mode forbids rooms';end if;
  if not exists(select 1 from public.character_life_profiles where character_id=hero.id and status='alive')then raise exception'character unavailable';end if;
  loop
    new_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,4)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,4)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,4));
    begin insert into public.dice_tables(code,created_by,dimension_id)values(new_code,auth.uid(),hero.dimension_id)returning id into new_id;exit;exception when unique_violation then end;
  end loop;
  insert into public.dice_table_members(table_id,user_id,display_name,role,character_id)values(new_id,auth.uid(),clean_name,'dm',hero.id);
  if not exists(select 1 from public.character_world_positions where character_id=hero.id)then perform public.ensure_character_world_position(hero.id);end if;
  return query select new_id,new_code;
end;$$;
revoke all on function public.create_dimension_dice_table(text,uuid)from public;
grant execute on function public.create_dimension_dice_table(text,uuid)to authenticated;
