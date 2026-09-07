create table public.god_mode_chaos_pool(
  id bigint generated always as identity primary key,
  slug text not null unique,
  title_th text not null,
  description_th text not null,
  effect_code text not null,
  weight integer not null check(weight between 1 and 100),
  default_duration_hours integer not null check(default_duration_hours between 1 and 72),
  active boolean not null default true
);
create table public.world_control_events(
  id uuid primary key default gen_random_uuid(),
  action_type text not null check(action_type in('weather','spawn','chaos')),
  title_th text not null,
  description_th text not null,
  location_id bigint references public.world_locations(id),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check(expires_at>created_at)
);
create index world_control_events_active_idx on public.world_control_events(expires_at desc,action_type);
alter table public.god_mode_chaos_pool enable row level security;
alter table public.world_control_events enable row level security;
create policy "Admins can read chaos pool"on public.god_mode_chaos_pool for select to authenticated using(public.is_site_admin());
create policy "Players can read active world control events"on public.world_control_events for select to authenticated using(expires_at>now()or public.is_site_admin());
insert into public.god_mode_chaos_pool(slug,title_th,description_th,effect_code,weight,default_duration_hours)values
('golden-rain','ฝนเหรียญแห่งโชค','เมฆสีทองโปรยเหรียญลวงและเหรียญจริงไปทั่วเอเธอร์รา','bonus_currency',20,6),
('wild-magic','คลื่นเวทปั่นป่วน','เวทมนตร์ทุกแขนงสั่นไหว ผลลัพธ์ที่คุ้นเคยอาจพลิกผัน','wild_magic',18,4),
('monster-march','ขบวนอสูร','ฝูงอสูรเคลื่อนผ่านเส้นทางหลักและทำให้การเดินทางอันตรายขึ้น','danger_surge',16,8),
('healing-moon','จันทร์เยียวยา','แสงจันทร์สีมรกตฟื้นพลังของสิ่งมีชีวิตทั่วทวีป','healing_surge',14,6),
('time-rift','รอยแยกกาลเวลา','เวลาโลกกระตุกเป็นช่วงสั้น เหตุการณ์เก่าอาจสะท้อนกลับมา','time_distortion',10,3),
('silent-hour','ชั่วโมงไร้เสียง','เสียงทั้งหมดเลือนหายและคาถาที่ต้องร่ายเผชิญแรงต้าน','silence',8,2);

create or replace function public.trigger_world_control(target_action text,target_payload jsonb default '{}'::jsonb)
returns public.world_control_events language plpgsql security definer set search_path=''as $$
declare event public.world_control_events%rowtype;pattern public.weather_patterns%rowtype;chaos public.god_mode_chaos_pool%rowtype;target_location bigint;duration_hours integer;intensity integer;title_value text;description_value text;total_weight integer;roll integer;
begin
  if not public.is_site_admin()then raise exception'admin required';end if;
  if target_action not in('weather','spawn','chaos')then raise exception'invalid action';end if;
  begin target_location:=nullif(target_payload->>'location_id','')::bigint;exception when others then raise exception'invalid location';end;
  if target_location is not null and not exists(select 1 from public.world_locations where id=target_location)then raise exception'location not found';end if;
  begin duration_hours:=coalesce((target_payload->>'duration_hours')::integer,6);exception when others then raise exception'invalid duration';end;
  if duration_hours not between 1 and 72 then raise exception'invalid duration';end if;
  if target_action='weather'then
    select*into pattern from public.weather_patterns where slug=target_payload->>'weather_slug'and active;if pattern.slug is null then raise exception'weather not found';end if;
    begin intensity:=coalesce((target_payload->>'intensity')::integer,2);exception when others then raise exception'invalid intensity';end;
    if intensity not between 1 and 3 then raise exception'invalid intensity';end if;
    title_value:='สภาพอากาศ: '||pattern.name_th;description_value:=pattern.description_th;
    target_payload:=target_payload||jsonb_build_object('weather_slug',pattern.slug,'intensity',intensity,'symbol',pattern.symbol,'travel_note_th',pattern.travel_note_th);
  elsif target_action='spawn'then
    title_value:=regexp_replace(trim(coalesce(target_payload->>'title_th','')),'\s+',' ','g');description_value:=regexp_replace(trim(coalesce(target_payload->>'description_th','')),'\s+',' ','g');
    if char_length(title_value)not between 3 and 80 or char_length(description_value)not between 5 and 300 then raise exception'invalid content';end if;
  else
    select sum(weight)into total_weight from public.god_mode_chaos_pool where active;roll:=floor(random()*total_weight)::integer+1;
    select chosen.id,chosen.slug,chosen.title_th,chosen.description_th,chosen.effect_code,chosen.weight,chosen.default_duration_hours,chosen.active into chaos from(select pool.*,sum(pool.weight)over(order by pool.slug)as cumulative from public.god_mode_chaos_pool pool where pool.active)chosen where chosen.cumulative>=roll order by chosen.cumulative limit 1;
    title_value:=chaos.title_th;description_value:=chaos.description_th;if not(target_payload?'duration_hours')then duration_hours:=chaos.default_duration_hours;end if;
    target_payload:=target_payload||jsonb_build_object('chaos_slug',chaos.slug,'effect_code',chaos.effect_code);
  end if;
  insert into public.world_control_events(action_type,title_th,description_th,location_id,payload,created_by,expires_at)values(target_action,title_value,description_value,target_location,target_payload,auth.uid(),now()+make_interval(hours=>duration_hours))returning*into event;
  return event;
end;$$;
revoke all on function public.trigger_world_control(text,jsonb)from public;grant execute on function public.trigger_world_control(text,jsonb)to authenticated;
alter publication supabase_realtime add table public.world_control_events;

create or replace function public.get_character_weather(target_character_id uuid)
returns jsonb language plpgsql security definer set search_path=''as $$
declare hero public.characters%rowtype;position public.character_world_positions%rowtype;weather public.character_weather%rowtype;pattern public.weather_patterns%rowtype;control public.world_control_events%rowtype;period bigint;roll integer;total_weight integer;
begin
  select*into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception'character not found';end if;
  select*into position from public.character_world_positions where character_id=target_character_id and user_id=auth.uid();if position.character_id is null then select*into position from public.ensure_character_world_position(target_character_id);end if;
  select*into control from public.world_control_events where action_type='weather'and expires_at>now()and(location_id is null or location_id=position.location_id)order by(location_id is not null)desc,created_at desc limit 1;
  if control.id is not null then select*into pattern from public.weather_patterns where slug=control.payload->>'weather_slug';return jsonb_build_object('slug',pattern.slug,'name_th',pattern.name_th,'description_th',pattern.description_th,'symbol',pattern.symbol,'travel_note_th',pattern.travel_note_th,'intensity',(control.payload->>'intensity')::integer,'period_index',-1,'location_id',position.location_id,'next_change_in_hours',greatest(1,ceil(extract(epoch from(control.expires_at-now()))/3600.0)::integer),'god_mode',true,'control_event_id',control.id);end if;
  period:=floor((8+position.world_hours_elapsed)/6.0)::bigint;select*into weather from public.character_weather where character_id=target_character_id;
  if weather.character_id is null or weather.location_id<>position.location_id or weather.period_index<>period then select sum(weight)into total_weight from public.weather_patterns where active;roll:=mod((pg_catalog.hashtextextended(position.location_id::text||':'||period::text,0)::numeric+9223372036854775808),total_weight)::integer+1;select chosen.slug,chosen.name_th,chosen.description_th,chosen.symbol,chosen.weight,chosen.travel_note_th,chosen.active into pattern from(select p.*,sum(p.weight)over(order by p.slug)as cumulative from public.weather_patterns p where p.active)chosen where chosen.cumulative>=roll order by chosen.cumulative limit 1;insert into public.character_weather(character_id,user_id,location_id,weather_slug,intensity,period_index)values(target_character_id,auth.uid(),position.location_id,pattern.slug,1+mod(period+position.location_id,3),period)on conflict(character_id)do update set location_id=excluded.location_id,weather_slug=excluded.weather_slug,intensity=excluded.intensity,period_index=excluded.period_index,updated_at=now()returning*into weather;
  else select*into pattern from public.weather_patterns where slug=weather.weather_slug;end if;
  if pattern.slug is null then select*into pattern from public.weather_patterns where slug=weather.weather_slug;end if;
  return jsonb_build_object('slug',pattern.slug,'name_th',pattern.name_th,'description_th',pattern.description_th,'symbol',pattern.symbol,'travel_note_th',pattern.travel_note_th,'intensity',weather.intensity,'period_index',weather.period_index,'location_id',weather.location_id,'next_change_in_hours',6-mod(8+position.world_hours_elapsed,6),'god_mode',false);
end;$$;
