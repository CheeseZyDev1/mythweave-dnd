create or replace function public.mark_solo_diligence(target_character_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;session public.solo_adventures%rowtype;life public.solo_life_states%rowtype;position public.character_world_positions%rowtype;location public.world_locations%rowtype;reward_item public.content_items%rowtype;today_th date;days_marked integer;awarded_now boolean:=false;
begin
  today_th:=(clock_timestamp() at time zone 'Asia/Bangkok')::date;
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid() for update;
  if hero.id is null then raise exception 'character not found';end if;
  select * into session from public.solo_adventures where character_id=hero.id and user_id=auth.uid() and status='active' for update;
  if session.id is null then raise exception 'solo not active';end if;
  select * into life from public.solo_life_states where character_id=hero.id and user_id=auth.uid();
  if life.status='dead' then raise exception 'character dead';end if;
  select * into position from public.character_world_positions where character_id=hero.id;
  select * into location from public.world_locations where id=position.location_id;
  if location.location_type<>'wilderness' then raise exception 'wilderness required';end if;
  if exists(select 1 from public.solo_diligence_days where character_id=hero.id and activity_date=today_th) then raise exception 'already marked today';end if;
  insert into public.solo_diligence_days(character_id,user_id,solo_adventure_id,activity_date) values(hero.id,auth.uid(),session.id,today_th);
  select count(*) into days_marked from public.solo_diligence_days where character_id=hero.id;
  if days_marked>=3 and not exists(select 1 from public.solo_diligence_rewards where character_id=hero.id) then
    select * into reward_item from public.content_items where slug='wilderness-vigil-sigil';
    insert into public.solo_diligence_rewards(character_id,user_id,content_item_id) values(hero.id,auth.uid(),reward_item.id);
    insert into public.character_item_stacks(character_id,user_id,content_item_id,quantity,acquired_unit_value)
    values(hero.id,auth.uid(),reward_item.id,1,0)
    on conflict(character_id,content_item_id) do nothing;
    awarded_now:=true;
  end if;
  return jsonb_build_object('activity_date',today_th,'days_marked',days_marked,'milestone_days',3,'days_remaining',greatest(0,3-days_marked),'reward_awarded',awarded_now,'reward_owned',exists(select 1 from public.solo_diligence_rewards where character_id=hero.id),'reward_name',case when days_marked>=3 then 'ตราผู้เฝ้าพงไพร' else null end);
end;$$;
