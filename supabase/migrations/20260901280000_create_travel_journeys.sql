create table public.travel_encounter_templates(
  id bigint generated always as identity primary key,
  slug text not null unique,
  name_th text not null,
  description_th text not null,
  weight integer not null default 10 check(weight between 1 and 100),
  active boolean not null default true
);
create table public.character_journeys(
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  route_id bigint not null references public.world_routes(id),
  from_location_id bigint not null references public.world_locations(id),
  to_location_id bigint not null references public.world_locations(id),
  travel_mode text not null check(travel_mode in('fast_travel','carriage','griffin')),
  status text not null check(status in('travelling','encounter','arrived')),
  duration_hours integer not null check(duration_hours>=0),
  elapsed_hours integer not null default 0 check(elapsed_hours>=0),
  encounter_id bigint references public.travel_encounter_templates(id),
  started_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index one_active_journey_per_character on public.character_journeys(character_id) where status in('travelling','encounter');
alter table public.travel_encounter_templates enable row level security;
alter table public.character_journeys enable row level security;
create policy "Players can read travel encounters" on public.travel_encounter_templates for select to authenticated using(active);
create policy "Players can read their journeys" on public.character_journeys for select to authenticated using(user_id=auth.uid());

insert into public.travel_encounter_templates(slug,name_th,description_th,weight)values
('fallen-tree','ต้นไม้ล้มขวางทาง','เสียงไม้แตกดังจากแนวป่า เงาบางอย่างเคลื่อนไหวหลังลำต้นที่ขวางถนน',35),
('roadside-bandits','โจรดักทาง','กลุ่มคนสวมผ้าคลุมก้าวออกมาล้อมพาหนะ พร้อมเรียกค่าผ่านทาง',25),
('lost-spirit','วิญญาณผู้หลงทาง','แสงสีฟ้าลอยวนเหนือทางเก่าและเรียกชื่อคนในปาร์ตี้อย่างแผ่วเบา',20),
('merchant-in-distress','พ่อค้าขอความช่วยเหลือ','เกวียนสินค้าเสียหลักอยู่ริมทาง เจ้าของส่งสัญญาณขอความช่วยเหลือ',20);

create or replace function public.travel_character_route(target_character_id uuid,target_location_id bigint,target_mode text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;position public.character_world_positions%rowtype;origin public.world_locations%rowtype;destination public.world_locations%rowtype;route public.world_routes%rowtype;wallet public.character_wallets%rowtype;ration public.content_items%rowtype;food_stack public.character_item_stacks%rowtype;trip public.character_travel_history%rowtype;journey public.character_journeys%rowtype;encounter public.travel_encounter_templates%rowtype;food_remaining integer:=0;vehicle_trip_number integer:=0;interrupt_trip boolean:=false;partial_hours integer:=0;
begin
  if target_mode not in('fast_travel','carriage','griffin')then raise exception 'invalid travel mode';end if;
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception 'character not found';end if;
  if exists(select 1 from public.character_journeys where character_id=target_character_id and status in('travelling','encounter'))then raise exception 'journey active';end if;
  select * into position from public.character_world_positions where character_id=target_character_id and user_id=auth.uid() for update;
  if position.character_id is null then perform public.ensure_character_world_position(target_character_id);select * into position from public.character_world_positions where character_id=target_character_id for update;end if;
  select * into origin from public.world_locations where id=position.location_id;select * into destination from public.world_locations where id=target_location_id and active;
  if destination.id is null then raise exception 'destination not found';end if;if origin.id=destination.id then raise exception 'already there';end if;
  select * into route from public.world_routes where active and travel_mode=target_mode and((from_location_id=origin.id and to_location_id=destination.id)or(from_location_id=destination.id and to_location_id=origin.id));
  if route.id is null then raise exception 'route unavailable';end if;
  if target_mode='fast_travel'and(origin.location_type<>'major_city'or destination.location_type<>'major_city'or not origin.fast_travel or not destination.fast_travel)then raise exception 'fast travel unavailable';end if;
  if route.cost_copper>0 then select * into wallet from public.character_wallets where character_id=target_character_id and user_id=auth.uid() for update;if wallet.balance_copper<route.cost_copper then raise exception 'insufficient funds';end if;end if;
  if route.food_cost>0 then
    select * into ration from public.content_items where slug='common-19';select * into food_stack from public.character_item_stacks where character_id=target_character_id and user_id=auth.uid() and content_item_id=ration.id for update;
    if food_stack.id is null or food_stack.quantity<route.food_cost then raise exception 'insufficient food';end if;food_remaining:=food_stack.quantity-route.food_cost;
    if food_remaining=0 then delete from public.character_item_stacks where id=food_stack.id;else update public.character_item_stacks set quantity=food_remaining,updated_at=now() where id=food_stack.id;end if;
  end if;
  if route.cost_copper>0 then
    update public.character_wallets set balance_copper=balance_copper-route.cost_copper,updated_at=now() where character_id=target_character_id returning * into wallet;
    insert into public.wallet_transactions(character_id,user_id,delta_copper,balance_after,reason)values(target_character_id,auth.uid(),-route.cost_copper,wallet.balance_copper,'ค่าเดินทาง '||case target_mode when 'carriage' then 'รถม้า' else 'กริฟฟิน' end||' ไป '||destination.name_th);
  end if;
  if target_mode<>'fast_travel' then
    select count(*)+1 into vehicle_trip_number from public.character_journeys where character_id=target_character_id and travel_mode in('carriage','griffin');
    interrupt_trip:=mod(vehicle_trip_number,3)=0;
  end if;
  if interrupt_trip then
    select * into encounter from public.travel_encounter_templates where active order by -ln(greatest(random(),0.000001))/weight limit 1;
    partial_hours:=greatest(1,floor(route.duration_hours/2.0)::integer);
    insert into public.character_journeys(character_id,user_id,route_id,from_location_id,to_location_id,travel_mode,status,duration_hours,elapsed_hours,encounter_id)
    values(target_character_id,auth.uid(),route.id,origin.id,destination.id,target_mode,'encounter',route.duration_hours,partial_hours,encounter.id)returning * into journey;
    update public.character_world_positions set world_hours_elapsed=world_hours_elapsed+partial_hours,updated_at=now() where character_id=target_character_id returning * into position;
    return jsonb_build_object('journey_id',journey.id,'interrupted',true,'location_id',origin.id,'location_name',origin.name_th,'destination_id',destination.id,'destination_name',destination.name_th,'travel_mode',target_mode,'duration_hours',route.duration_hours,'elapsed_hours',partial_hours,'cost_copper',route.cost_copper,'food_cost',route.food_cost,'food_remaining',food_remaining,'wallet_balance',wallet.balance_copper,'world_hours_elapsed',position.world_hours_elapsed,'encounter',jsonb_build_object('id',encounter.id,'name_th',encounter.name_th,'description_th',encounter.description_th));
  end if;
  update public.character_world_positions set location_id=destination.id,world_hours_elapsed=world_hours_elapsed+route.duration_hours,arrived_at=now(),updated_at=now() where character_id=target_character_id returning * into position;
  insert into public.character_travel_history(character_id,user_id,from_location_id,to_location_id,travel_mode,duration_hours,cost_copper)values(target_character_id,auth.uid(),origin.id,destination.id,target_mode,route.duration_hours,route.cost_copper)returning * into trip;
  insert into public.character_journeys(character_id,user_id,route_id,from_location_id,to_location_id,travel_mode,status,duration_hours,elapsed_hours,resolved_at)values(target_character_id,auth.uid(),route.id,origin.id,destination.id,target_mode,'arrived',route.duration_hours,route.duration_hours,now())returning * into journey;
  return jsonb_build_object('journey_id',journey.id,'trip_id',trip.id,'interrupted',false,'location_id',destination.id,'location_name',destination.name_th,'travel_mode',target_mode,'duration_hours',route.duration_hours,'elapsed_hours',route.duration_hours,'cost_copper',route.cost_copper,'food_cost',route.food_cost,'food_remaining',food_remaining,'wallet_balance',case when route.cost_copper>0 then wallet.balance_copper else null end,'world_hours_elapsed',position.world_hours_elapsed,'arrived_at',position.arrived_at);
end;$$;

create or replace function public.resolve_travel_encounter(target_character_id uuid,target_journey_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare journey public.character_journeys%rowtype;position public.character_world_positions%rowtype;destination public.world_locations%rowtype;trip public.character_travel_history%rowtype;remaining_hours integer;
begin
  select * into journey from public.character_journeys where id=target_journey_id and character_id=target_character_id and user_id=auth.uid() and status='encounter' for update;
  if journey.id is null then raise exception 'active encounter not found';end if;
  remaining_hours:=greatest(0,journey.duration_hours-journey.elapsed_hours);select * into destination from public.world_locations where id=journey.to_location_id;
  update public.character_world_positions set location_id=journey.to_location_id,world_hours_elapsed=world_hours_elapsed+remaining_hours,arrived_at=now(),updated_at=now() where character_id=target_character_id and user_id=auth.uid() returning * into position;
  insert into public.character_travel_history(character_id,user_id,from_location_id,to_location_id,travel_mode,duration_hours,cost_copper)
  select journey.character_id,journey.user_id,journey.from_location_id,journey.to_location_id,journey.travel_mode,journey.duration_hours,route.cost_copper from public.world_routes route where route.id=journey.route_id returning * into trip;
  update public.character_journeys set status='arrived',elapsed_hours=duration_hours,resolved_at=now() where id=journey.id;
  return jsonb_build_object('journey_id',journey.id,'trip_id',trip.id,'interrupted',false,'location_id',destination.id,'location_name',destination.name_th,'travel_mode',journey.travel_mode,'duration_hours',journey.duration_hours,'elapsed_hours',journey.duration_hours,'world_hours_elapsed',position.world_hours_elapsed,'arrived_at',position.arrived_at);
end;$$;
revoke all on function public.resolve_travel_encounter(uuid,uuid) from public;
grant execute on function public.resolve_travel_encounter(uuid,uuid) to authenticated;
