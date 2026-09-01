insert into public.world_locations(slug,parent_id,location_type,name_th,name_en,description_th,map_x,map_y,scene_asset,danger_level,fast_travel)
select 'sunharbor',id,'major_city','นครท่าตะวัน','Sunharbor','นครท่าบนเกาะหิน ประภาคารนำเรือและวงเวทเคลื่อนย้ายข้ามแผ่นดิน',18,77,'/assets/riverrest.png',0,true from public.world_locations where slug='aurelion';
create table public.world_routes(
  id bigint generated always as identity primary key,
  from_location_id bigint not null references public.world_locations(id),
  to_location_id bigint not null references public.world_locations(id),
  travel_mode text not null check(travel_mode in('fast_travel','foot','carriage','griffin')),
  duration_hours integer not null default 0 check(duration_hours between 0 and 999),
  cost_copper integer not null default 0 check(cost_copper between 0 and 999999),
  food_cost integer not null default 0 check(food_cost between 0 and 99),
  active boolean not null default true,
  unique(from_location_id,to_location_id,travel_mode),
  check(from_location_id<>to_location_id)
);
create table public.character_travel_history(
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_location_id bigint not null references public.world_locations(id),
  to_location_id bigint not null references public.world_locations(id),
  travel_mode text not null check(travel_mode in('fast_travel','foot','carriage','griffin')),
  duration_hours integer not null default 0,
  cost_copper integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.world_routes enable row level security;
alter table public.character_travel_history enable row level security;
create policy "Players can read active world routes" on public.world_routes for select to authenticated using(active);
create policy "Players can read their travel history" on public.character_travel_history for select to authenticated using(user_id=auth.uid());
insert into public.world_routes(from_location_id,to_location_id,travel_mode)
select origin.id,destination.id,'fast_travel' from public.world_locations origin cross join public.world_locations destination where origin.slug='dawnspire' and destination.slug='sunharbor';

create or replace function public.fast_travel_character(target_character_id uuid,target_location_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;position public.character_world_positions%rowtype;origin public.world_locations%rowtype;destination public.world_locations%rowtype;route public.world_routes%rowtype;trip public.character_travel_history%rowtype;
begin
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception 'character not found';end if;
  select * into position from public.character_world_positions where character_id=target_character_id and user_id=auth.uid() for update;
  if position.character_id is null then perform public.ensure_character_world_position(target_character_id);select * into position from public.character_world_positions where character_id=target_character_id for update;end if;
  select * into origin from public.world_locations where id=position.location_id;
  select * into destination from public.world_locations where id=target_location_id and active;
  if destination.id is null then raise exception 'destination not found';end if;
  if origin.id=destination.id then raise exception 'already there';end if;
  if origin.location_type<>'major_city' or destination.location_type<>'major_city' or not origin.fast_travel or not destination.fast_travel then raise exception 'fast travel unavailable';end if;
  select * into route from public.world_routes where active and travel_mode='fast_travel' and ((from_location_id=origin.id and to_location_id=destination.id)or(from_location_id=destination.id and to_location_id=origin.id));
  if route.id is null then raise exception 'route unavailable';end if;
  update public.character_world_positions set location_id=destination.id,arrived_at=now(),updated_at=now() where character_id=target_character_id returning * into position;
  insert into public.character_travel_history(character_id,user_id,from_location_id,to_location_id,travel_mode,duration_hours,cost_copper)
  values(target_character_id,auth.uid(),origin.id,destination.id,'fast_travel',0,0)returning * into trip;
  return jsonb_build_object('trip_id',trip.id,'location_id',destination.id,'location_name',destination.name_th,'travel_mode','fast_travel','duration_hours',0,'cost_copper',0,'arrived_at',position.arrived_at);
end;$$;
revoke all on function public.fast_travel_character(uuid,bigint) from public;
grant execute on function public.fast_travel_character(uuid,bigint) to authenticated;
