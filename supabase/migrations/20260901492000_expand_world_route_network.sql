with kingdom as(select id from public.world_locations where slug='aurelion')
insert into public.world_locations(slug,parent_id,location_type,name_th,name_en,description_th,map_x,map_y,scene_asset,danger_level,fast_travel)
select point.slug,kingdom.id,'wilderness',point.name_th,point.name_en,point.description,point.x,point.y,point.asset,point.danger,false
from kingdom cross join(values
('coast-trail','ทางเลียบฝั่งหมอก','Mistcoast Trail','แนวผาหินและถนนเก่าริมสมุทร เสียงระฆังประภาคารดังตามลม',24,70,'/assets/riverrest.png',2),
('old-oak-crossing','แยกโอ๊กโบราณ','Old Oak Crossing','ทางสามแพร่งใต้ต้นโอ๊กใหญ่ รอยเกวียนแยกเข้าสู่ป่าหลายสาย',29,49,'/assets/elderwood.png',2),
('moon-road','ถนนจันทร์เสี้ยว','Crescent Road','ถนนหินขาวที่มองเห็นชัดที่สุดเมื่อแสงจันทร์ขึ้น',39,57,'/assets/elderwood.png',3),
('pilgrim-stones','ศิลาผู้จาริก','Pilgrim Stones','หลักหินเรียงรายนำผู้เดินทางผ่านทุ่งตอนกลาง',51,67,'/assets/riverrest.png',2),
('dusk-ford','ท่าข้ามสนธยา','Dusk Ford','จุดข้ามแม่น้ำตื้นซึ่งระดับน้ำเปลี่ยนอย่างรวดเร็ว',63,58,'/assets/riverrest.png',3),
('ember-gate','ประตูเถ้าถ่าน','Ember Gate','ซุ้มหินไหม้ดำบนเส้นทางสู่แดนภูเขาไฟ',73,68,'/assets/nightcrown.png',5),
('crystal-trail','ทางผลึกฟ้า','Crystal Trail','ทางชันซึ่งผลึกน้ำแข็งส่องแสงบอกทิศในหมอก',69,42,'/assets/azuredeep.png',5),
('raven-watch','หอเฝ้าอีกา','Raven Watch','ซากหอคอยบนเนินสูง มองเห็นทั้งสุสานและนครมืด',52,37,'/assets/nightcrown.png',4),
('broken-crown','สันเขามงกุฎแตก','Broken Crown Ridge','สันเขาแตกหักที่มีทางลับลงสู่หุบเขาทางเหนือ',57,25,'/assets/nightcrown.png',6)
)point(slug,name_th,name_en,description,x,y,asset,danger)
on conflict(slug)do update set map_x=excluded.map_x,map_y=excluded.map_y,description_th=excluded.description_th,danger_level=excluded.danger_level,active=true;

with links(origin_slug,destination_slug,hours,food)as(values
('sunharbor','coast-trail',3,0),('coast-trail','greenhollow',5,1),('greenhollow','old-oak-crossing',3,0),('old-oak-crossing','verdant-reach',4,1),
('old-oak-crossing','moon-road',3,0),('moon-road','whispervault',5,1),('moon-road','pilgrim-stones',4,0),('moon-road','riverrest',4,0),
('dawnspire','pilgrim-stones',3,0),('pilgrim-stones','dusk-ford',4,0),('riverrest','dusk-ford',3,0),('dusk-ford','saltmere',5,1),
('dusk-ford','crystal-trail',5,1),('crystal-trail','stonepass',4,1),('whispervault','raven-watch',5,1),('raven-watch','broken-crown',6,1),
('broken-crown','stonepass',6,1),('saltmere','ember-gate',3,0),('ember-gate','ashen-barrens',4,1),('dusk-ford','ashen-barrens',7,1),
('old-oak-crossing','dawnspire',6,1),('raven-watch','stonepass',7,1)
)
insert into public.world_routes(from_location_id,to_location_id,travel_mode,duration_hours,cost_copper,food_cost)
select origin.id,destination.id,'foot',links.hours,0,links.food from links join public.world_locations origin on origin.slug=links.origin_slug join public.world_locations destination on destination.slug=links.destination_slug
on conflict(from_location_id,to_location_id,travel_mode)do update set duration_hours=excluded.duration_hours,food_cost=excluded.food_cost,active=true;

alter table public.character_journeys drop constraint if exists character_journeys_travel_mode_check;
alter table public.character_journeys add constraint character_journeys_travel_mode_check check(travel_mode in('fast_travel','foot','carriage','griffin'));

create or replace function public.travel_character_route(target_character_id uuid,target_location_id bigint,target_mode text)
returns jsonb language plpgsql security definer set search_path=''as $$
declare hero public.characters%rowtype;position public.character_world_positions%rowtype;origin public.world_locations%rowtype;destination public.world_locations%rowtype;route public.world_routes%rowtype;wallet public.character_wallets%rowtype;ration public.content_items%rowtype;food_stack public.character_item_stacks%rowtype;trip public.character_travel_history%rowtype;journey public.character_journeys%rowtype;encounter public.travel_encounter_templates%rowtype;food_remaining integer:=0;land_trip_number integer:=0;interrupt_trip boolean:=false;partial_hours integer:=0;
begin
  if target_mode not in('fast_travel','foot','carriage','griffin')then raise exception'invalid travel mode';end if;
  select*into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception'character not found';end if;
  if exists(select 1 from public.character_journeys where character_id=target_character_id and status in('travelling','encounter'))then raise exception'journey active';end if;
  select*into position from public.character_world_positions where character_id=target_character_id and user_id=auth.uid()for update;
  if position.character_id is null then perform public.ensure_character_world_position(target_character_id);select*into position from public.character_world_positions where character_id=target_character_id for update;end if;
  select*into origin from public.world_locations where id=position.location_id;select*into destination from public.world_locations where id=target_location_id and active;
  if destination.id is null then raise exception'destination not found';end if;if origin.id=destination.id then raise exception'already there';end if;
  select*into route from public.world_routes where active and travel_mode=target_mode and((from_location_id=origin.id and to_location_id=destination.id)or(from_location_id=destination.id and to_location_id=origin.id));
  if route.id is null then raise exception'route unavailable';end if;
  if target_mode='fast_travel'and(origin.location_type<>'major_city'or destination.location_type<>'major_city'or not origin.fast_travel or not destination.fast_travel)then raise exception'fast travel unavailable';end if;
  if route.cost_copper>0 then select*into wallet from public.character_wallets where character_id=target_character_id and user_id=auth.uid()for update;if wallet.balance_copper<route.cost_copper then raise exception'insufficient funds';end if;end if;
  if route.food_cost>0 then select*into ration from public.content_items where slug='common-19';select*into food_stack from public.character_item_stacks where character_id=target_character_id and user_id=auth.uid()and content_item_id=ration.id for update;if food_stack.id is null or food_stack.quantity<route.food_cost then raise exception'insufficient food';end if;food_remaining:=food_stack.quantity-route.food_cost;if food_remaining=0 then delete from public.character_item_stacks where id=food_stack.id;else update public.character_item_stacks set quantity=food_remaining,updated_at=now()where id=food_stack.id;end if;end if;
  if route.cost_copper>0 then update public.character_wallets set balance_copper=balance_copper-route.cost_copper,updated_at=now()where character_id=target_character_id returning*into wallet;insert into public.wallet_transactions(character_id,user_id,delta_copper,balance_after,reason)values(target_character_id,auth.uid(),-route.cost_copper,wallet.balance_copper,'ค่าเดินทางไป '||destination.name_th);end if;
  if target_mode<>'fast_travel'then select count(*)+1 into land_trip_number from public.character_journeys where character_id=target_character_id and travel_mode<>'fast_travel';interrupt_trip:=mod(land_trip_number,4)=0;end if;
  if interrupt_trip then select*into encounter from public.travel_encounter_templates where active order by -ln(greatest(random(),0.000001))/weight limit 1;partial_hours:=greatest(1,floor(route.duration_hours/2.0)::integer);insert into public.character_journeys(character_id,user_id,route_id,from_location_id,to_location_id,travel_mode,status,duration_hours,elapsed_hours,encounter_id)values(target_character_id,auth.uid(),route.id,origin.id,destination.id,target_mode,'encounter',route.duration_hours,partial_hours,encounter.id)returning*into journey;update public.character_world_positions set world_hours_elapsed=world_hours_elapsed+partial_hours,updated_at=now()where character_id=target_character_id returning*into position;return jsonb_build_object('journey_id',journey.id,'interrupted',true,'location_id',origin.id,'location_name',origin.name_th,'destination_id',destination.id,'destination_name',destination.name_th,'travel_mode',target_mode,'duration_hours',route.duration_hours,'elapsed_hours',partial_hours,'cost_copper',route.cost_copper,'food_cost',route.food_cost,'food_remaining',food_remaining,'wallet_balance',wallet.balance_copper,'world_hours_elapsed',position.world_hours_elapsed,'encounter',jsonb_build_object('id',encounter.id,'name_th',encounter.name_th,'description_th',encounter.description_th));end if;
  update public.character_world_positions set location_id=destination.id,world_hours_elapsed=world_hours_elapsed+route.duration_hours,arrived_at=now(),updated_at=now()where character_id=target_character_id returning*into position;
  insert into public.character_travel_history(character_id,user_id,from_location_id,to_location_id,travel_mode,duration_hours,cost_copper)values(target_character_id,auth.uid(),origin.id,destination.id,target_mode,route.duration_hours,route.cost_copper)returning*into trip;
  insert into public.character_journeys(character_id,user_id,route_id,from_location_id,to_location_id,travel_mode,status,duration_hours,elapsed_hours,resolved_at)values(target_character_id,auth.uid(),route.id,origin.id,destination.id,target_mode,'arrived',route.duration_hours,route.duration_hours,now())returning*into journey;
  return jsonb_build_object('journey_id',journey.id,'trip_id',trip.id,'interrupted',false,'location_id',destination.id,'location_name',destination.name_th,'travel_mode',target_mode,'duration_hours',route.duration_hours,'elapsed_hours',route.duration_hours,'cost_copper',route.cost_copper,'food_cost',route.food_cost,'food_remaining',food_remaining,'wallet_balance',case when route.cost_copper>0 then wallet.balance_copper else null end,'world_hours_elapsed',position.world_hours_elapsed,'arrived_at',position.arrived_at);
end;$$;
