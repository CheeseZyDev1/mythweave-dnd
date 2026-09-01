create table public.weather_patterns(
  slug text primary key,
  name_th text not null,
  description_th text not null,
  symbol text not null,
  weight integer not null check(weight between 1 and 100),
  travel_note_th text not null,
  active boolean not null default true
);
create table public.character_weather(
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id bigint not null references public.world_locations(id),
  weather_slug text not null references public.weather_patterns(slug),
  intensity smallint not null check(intensity between 1 and 3),
  period_index bigint not null,
  updated_at timestamptz not null default now()
);
alter table public.weather_patterns enable row level security;
alter table public.character_weather enable row level security;
create policy "Players can read weather patterns" on public.weather_patterns for select to authenticated using(active);
create policy "Players can read their weather" on public.character_weather for select to authenticated using(user_id=auth.uid());
insert into public.weather_patterns(slug,name_th,description_th,symbol,weight,travel_note_th)values
('clear','ท้องฟ้าโปร่ง','แสงอาทิตย์อ่อนส่องผ่านเมฆบาง','☀',35,'ทัศนวิสัยดี เดินทางตามปกติ'),
('rain','ฝนโปรย','หยาดฝนเคลือบถนนและยอดไม้','☔',25,'ถนนลื่น ระวังรอยเท้าถูกชะล้าง'),
('fog','หมอกหนา','หมอกสีเทาปิดบังเส้นทางไกล','≋',15,'ทัศนวิสัยลดลง โอกาสหลงทางเพิ่ม'),
('wind','ลมแรง','กระแสลมพัดผ่านที่ราบและช่องเขา','≋',12,'กริฟฟินบินลำบาก ธนูเสียความแม่นยำ'),
('storm','พายุฟ้าคะนอง','ฟ้าร้องสั่นและสายฟ้าแลบผ่าความมืด','⚡',8,'เส้นทางอันตราย เหตุการณ์ระหว่างทางรุนแรงขึ้น'),
('heat','อากาศร้อน','ความร้อนระอุบิดภาพเหนือพื้นดิน','☼',5,'ใช้น้ำและเสบียงมากขึ้น');

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
revoke all on function public.get_character_weather(uuid) from public;
grant execute on function public.get_character_weather(uuid) to authenticated;
