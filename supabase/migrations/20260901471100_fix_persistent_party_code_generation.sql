create or replace function public.create_persistent_party(target_character_id uuid,target_name text)returns jsonb language plpgsql security definer set search_path=''as $$
declare hero public.characters%rowtype;party public.persistent_parties%rowtype;clean_name text;new_code text;
begin
  select*into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception'character not found';end if;
  if exists(select 1 from public.character_life_profiles where character_id=hero.id and status<>'alive')then raise exception'character unavailable';end if;
  if exists(select 1 from public.persistent_party_members where character_id=hero.id)then raise exception'already in party';end if;
  clean_name:=left(trim(coalesce(target_name,'')),40);if char_length(clean_name)<2 then raise exception'invalid party name';end if;
  loop new_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,4)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,4));exit when not exists(select 1 from public.persistent_parties where invite_code=new_code);end loop;
  insert into public.persistent_parties(name,invite_code,dimension_id,owner_user_id)values(clean_name,new_code,hero.dimension_id,auth.uid())returning*into party;
  insert into public.persistent_party_members(party_id,user_id,character_id,role)values(party.id,auth.uid(),hero.id,'leader');
  return public.persistent_party_summary(hero.id);
end;$$;
