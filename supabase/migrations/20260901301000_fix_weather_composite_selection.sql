create or replace function public.get_character_weather(target_character_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;position public.character_world_positions%rowtype;weather public.character_weather%rowtype;pattern public.weather_patterns%rowtype;period bigint;roll integer;total_weight integer;
begin
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception 'character not found';end if;
  select * into position from public.character_world_positions where character_id=target_character_id and user_id=auth.uid();if position.character_id is null then select * into position from public.ensure_character_world_position(target_character_id);end if;
  period:=floor((8+position.world_hours_elapsed)/6.0)::bigint;
  select * into weather from public.character_weather where character_id=target_character_id;
  if weather.character_id is null or weather.location_id<>position.location_id or weather.period_index<>period then
    select sum(weight) into total_weight from public.weather_patterns where active;
    roll:=mod((pg_catalog.hashtextextended(position.location_id::text||':'||period::text,0)::numeric+9223372036854775808),total_weight)::integer+1;
    select chosen.slug,chosen.name_th,chosen.description_th,chosen.symbol,chosen.weight,chosen.travel_note_th,chosen.active into pattern from(select p.*,sum(p.weight)over(order by p.slug)as cumulative from public.weather_patterns p where p.active)chosen where chosen.cumulative>=roll order by chosen.cumulative limit 1;
    insert into public.character_weather(character_id,user_id,location_id,weather_slug,intensity,period_index)values(target_character_id,auth.uid(),position.location_id,pattern.slug,1+mod(period+position.location_id,3),period)
    on conflict(character_id)do update set location_id=excluded.location_id,weather_slug=excluded.weather_slug,intensity=excluded.intensity,period_index=excluded.period_index,updated_at=now() returning * into weather;
  else select * into pattern from public.weather_patterns where slug=weather.weather_slug;end if;
  if pattern.slug is null then select * into pattern from public.weather_patterns where slug=weather.weather_slug;end if;
  return jsonb_build_object('slug',pattern.slug,'name_th',pattern.name_th,'description_th',pattern.description_th,'symbol',pattern.symbol,'travel_note_th',pattern.travel_note_th,'intensity',weather.intensity,'period_index',weather.period_index,'location_id',weather.location_id,'next_change_in_hours',6-mod(8+position.world_hours_elapsed,6));
end;$$;
