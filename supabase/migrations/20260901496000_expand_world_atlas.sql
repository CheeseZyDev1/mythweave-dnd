insert into public.world_locations(slug,location_type,name_th,name_en,description_th)
values
('aetherra','continent','เอเธอร์รา','Aetherra','ทวีปศูนย์กลางแห่งสายน้ำ ป่าโบราณ และรอยแยกเวทมนตร์'),
('nocthyr','continent','น็อกธีร์','Nocthyr','ทวีปรัตติกาลซึ่งนครหินดำตั้งอยู่ใต้แสงจันทร์สองดวง'),
('solkara','continent','โซลคารา','Solkara','ทวีปทะเลทรายเพลิง เมืองโอเอซิส และชายฝั่งแก้ว'),
('veylora','continent','เวย์ลอรา','Veylora','หมู่เกาะหมอกที่ป่าฝนและทะเลลึกซ่อนเส้นทางเปลี่ยนรูป'),
('frostheim','continent','ฟรอสต์ไฮม์','Frostheim','ดินแดนน้ำแข็ง ฟยอร์ด และนครช่างเหล็กใต้แสงออโรรา'),
('celestara','continent','เซเลสทารา','Celestara','ทวีปลอยฟ้าที่หอดูดาวและสะพานดาราเชื่อมเกาะเหนือเมฆ')
on conflict(slug)do update set name_th=excluded.name_th,name_en=excluded.name_en,description_th=excluded.description_th,active=true;

insert into public.world_locations(slug,parent_id,location_type,name_th,name_en,description_th)
select realm.slug,continent.id,'kingdom',realm.name_th,realm.name_en,realm.description_th
from(values
('aetherra','aurelion','อาณาจักรออเรเลียน','Aurelion','ราชอาณาจักรลุ่มน้ำแห่งอัศวินรุ่งอรุณ'),
('aetherra','thalmyr','อาณาจักรธาลเมียร์','Thalmyr','นครรัฐพ่อค้าและป่าคริสตัลทางตะวันตก'),
('aetherra','caelwyn','อาณาจักรเคลวิน','Caelwyn','ดินแดนจอมเวทเหนือทะเลสาบสีเงิน'),
('nocthyr','umbravale','อาณาจักรอัมบราวาล','Umbravale','หุบเขาเงาซึ่งคำสาบานมีพลังเหนือเหล็ก'),
('nocthyr','ravenspire','อาณาจักรเรเวนสไปร์','Ravenspire','นครยอดแหลมของนักพยากรณ์และฝูงอีกา'),
('nocthyr','duskmoor','อาณาจักรดัสก์มัวร์','Duskmoor','ที่ลุ่มสนธยาซึ่งผู้คนสร้างบ้านบนเสาหิน'),
('solkara','pyrehold','อาณาจักรไพร์โฮลด์','Pyrehold','ป้อมภูเขาไฟและโรงตีเหล็กมังกร'),
('solkara','sahari','อาณาจักรซาฮารี','Sahari','สมาพันธ์โอเอซิสและคาราวานทะเลทราย'),
('solkara','embercoast','อาณาจักรชายฝั่งเอมเบอร์','Embercoast','เมืองท่าบนหาดทรายแดงและทะเลอุ่น'),
('solkara','glassreach','อาณาจักรกลาสรีช','Glassreach','ทุ่งแก้วที่สะท้อนภาพอนาคตผิดเพี้ยน'),
('veylora','mistcourt','อาณาจักรมิสต์คอร์ต','Mistcourt','ราชสำนักหมอกและสวนลอยน้ำ'),
('veylora','sylvaren','อาณาจักรซิลวาเรน','Sylvaren','ป่าฝนมีชีวิตซึ่งหมู่บ้านเติบโตไปพร้อมต้นไม้'),
('frostheim','skaldgard','อาณาจักรสกัลด์การ์ด','Skaldgard','ดินแดนนักขับลำนำและนักเดินเรือฟยอร์ด'),
('frostheim','aurorheim','อาณาจักรออโรราไฮม์','Aurorheim','ราชอาณาจักรใต้ม่านแสงเหนือที่ไม่เคยมืดสนิท'),
('frostheim','ironfjord','อาณาจักรไอรอนฟยอร์ด','Ironfjord','นครเหมืองและอู่เรือหุ้มเกราะ'),
('celestara','starfall','อาณาจักรสตาร์ฟอลล์','Starfall','แผ่นดินซึ่งเศษดาวตกกลายเป็นแหล่งพลัง'),
('celestara','moonveil','อาณาจักรมูนเวล','Moonveil','อาณาจักรนักบวชจันทราและประตูความฝัน'),
('celestara','dawnreach','อาณาจักรดอว์นรีช','Dawnreach','เกาะลอยแห่งนักบินกริฟฟินและนักสำรวจ'),
('celestara','astral-crown','อาณาจักรมงกุฎดารา','Astral Crown','ราชสำนักหอดูดาวเหนือทะเลเมฆ')
)realm(continent_slug,slug,name_th,name_en,description_th)
join public.world_locations continent on continent.slug=realm.continent_slug
on conflict(slug)do update set parent_id=excluded.parent_id,name_th=excluded.name_th,name_en=excluded.name_en,description_th=excluded.description_th,active=true;

update public.world_locations village set parent_id=city.id
from public.world_locations city
where village.slug in('greenhollow','riverrest')and city.slug='dawnspire';
update public.world_locations village set parent_id=city.id
from public.world_locations city
where village.slug='saltmere'and city.slug='sunharbor';

do $$
declare realm record;city record;realm_index integer:=0;city_index integer;city_count integer;city_target integer;village_index integer;village_count integer;village_target integer;new_city_id bigint;new_village_id bigint;
city_titles_th text[]:=array['นครหลวง','นครการค้า','เมืองท่า','เมืองชายแดน','นครศักดิ์สิทธิ์'];
city_titles_en text[]:=array['Crown City','Guildhaven','Tidegate','Farwatch','Sanctum'];
village_titles_th text[]:=array['หมู่บ้านสวนลม','ชุมชนสะพานเก่า','บ้านบ่อน้ำดาว','หมู่บ้านเนินระฆัง','ชุมชนชายป่า','บ้านทุ่งแสง'];
village_titles_en text[]:=array['Windgarden','Oldbridge','Starwell','Bellhill','Woodedge','Lightfield'];
city_x numeric[]:=array[20,40,61,78,50];city_y numeric[]:=array[25,68,31,62,48];
village_dx numeric[]:=array[-7,6,-9,8,-4,10];village_dy numeric[]:=array[8,9,-7,-6,13,2];
assets text[]:=array['/assets/riverrest.png','/assets/elderwood.png','/assets/azuredeep.png','/assets/nightcrown.png'];
begin
 for realm in
  select kingdom.id,kingdom.slug,kingdom.name_th,kingdom.name_en
  from public.world_locations kingdom join public.world_locations continent on continent.id=kingdom.parent_id
  where kingdom.location_type='kingdom'and continent.slug in('aetherra','nocthyr','solkara','veylora','frostheim','celestara')order by continent.id,kingdom.id
 loop
  realm_index:=realm_index+1;city_target:=3+mod(abs(hashtext(realm.slug)::bigint),3)::integer;
  select count(*)into city_count from public.world_locations where parent_id=realm.id and location_type='major_city';
  if city_count<city_target then
   for city_index in city_count+1..city_target loop
    insert into public.world_locations(slug,parent_id,location_type,name_th,name_en,description_th,map_x,map_y,scene_asset,danger_level,fast_travel)
    values(realm.slug||'-city-'||city_index,realm.id,'major_city',city_titles_th[city_index]||realm.name_th,realm.name_en||' '||city_titles_en[city_index],'ศูนย์กลางผู้คน ตลาด กิลด์ และข่าวการผจญภัยของ'||realm.name_th,city_x[city_index],city_y[city_index],assets[1+mod(realm_index+city_index,4)],least(6,1+mod(realm_index+city_index,5)),true)
    on conflict(slug)do update set parent_id=excluded.parent_id,map_x=excluded.map_x,map_y=excluded.map_y,active=true returning id into new_city_id;
   end loop;
  end if;
 end loop;

 for city in
  select location.id,location.slug,location.name_th,location.name_en,location.map_x,location.map_y,location.scene_asset,location.danger_level
  from public.world_locations location join public.world_locations kingdom on kingdom.id=location.parent_id join public.world_locations continent on continent.id=kingdom.parent_id
  where location.location_type='major_city'and continent.slug in('aetherra','nocthyr','solkara','veylora','frostheim','celestara')order by location.id
 loop
  village_target:=3+mod(abs(hashtext(city.slug)::bigint),4)::integer;
  select count(*)into village_count from public.world_locations where parent_id=city.id and location_type='small_town';
  if village_count<village_target then
   for village_index in village_count+1..village_target loop
    insert into public.world_locations(slug,parent_id,location_type,name_th,name_en,description_th,map_x,map_y,scene_asset,danger_level,fast_travel)
    values(city.slug||'-village-'||village_index,city.id,'small_town',village_titles_th[village_index]||'แห่ง'||city.name_th,city.name_en||' '||village_titles_en[village_index],'ชุมชนเล็กที่มีผู้คน ข่าวลือ ร้านค้า และเหตุการณ์ประจำวันไม่ซ้ำกัน',greatest(5,least(95,city.map_x+village_dx[village_index])),greatest(5,least(95,city.map_y+village_dy[village_index])),city.scene_asset,least(7,city.danger_level+1),false)
    on conflict(slug)do update set parent_id=excluded.parent_id,map_x=excluded.map_x,map_y=excluded.map_y,active=true returning id into new_village_id;
   end loop;
  end if;
 end loop;
end;$$;

insert into public.world_routes(from_location_id,to_location_id,travel_mode,duration_hours,cost_copper,food_cost)
select least(city.id,village.id),greatest(city.id,village.id),'foot',2+mod(village.id,5)::integer,0,case when mod(village.id,3)=0 then 1 else 0 end
from public.world_locations village join public.world_locations city on city.id=village.parent_id
where village.location_type='small_town'and city.location_type='major_city'
on conflict(from_location_id,to_location_id,travel_mode)do update set active=true;

with ordered as(
 select city.id,lag(city.id)over(partition by city.parent_id order by city.id)previous_id
 from public.world_locations city where city.location_type='major_city'
)
insert into public.world_routes(from_location_id,to_location_id,travel_mode,duration_hours,cost_copper,food_cost)
select least(id,previous_id),greatest(id,previous_id),'fast_travel',0,0,0 from ordered where previous_id is not null
on conflict(from_location_id,to_location_id,travel_mode)do update set active=true;

with anchors as(
 select continent.id continent_id,min(city.id)anchor_id
 from public.world_locations continent join public.world_locations kingdom on kingdom.parent_id=continent.id and kingdom.location_type='kingdom'join public.world_locations city on city.parent_id=kingdom.id and city.location_type='major_city'
 where continent.slug in('aetherra','nocthyr','solkara','veylora','frostheim','celestara')group by continent.id
),ordered as(select anchor_id,lag(anchor_id)over(order by continent_id)previous_id from anchors)
insert into public.world_routes(from_location_id,to_location_id,travel_mode,duration_hours,cost_copper,food_cost)
select least(anchor_id,previous_id),greatest(anchor_id,previous_id),'fast_travel',0,0,0 from ordered where previous_id is not null
on conflict(from_location_id,to_location_id,travel_mode)do update set active=true;
