create table public.world_locations(
  id bigint generated always as identity primary key,
  slug text not null unique,
  parent_id bigint references public.world_locations(id),
  location_type text not null check(location_type in('continent','kingdom','major_city','small_town','dungeon','wilderness')),
  name_th text not null,
  name_en text not null,
  description_th text not null,
  map_x numeric(5,2) check(map_x between 0 and 100),
  map_y numeric(5,2) check(map_y between 0 and 100),
  scene_asset text,
  danger_level smallint not null default 0 check(danger_level between 0 and 10),
  fast_travel boolean not null default false,
  active boolean not null default true
);
create table public.character_world_positions(
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id bigint not null references public.world_locations(id),
  arrived_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.world_locations enable row level security;
alter table public.character_world_positions enable row level security;
create policy "Players can read world locations" on public.world_locations for select to authenticated using(active);
create policy "Players can read their world positions" on public.character_world_positions for select to authenticated using(user_id=auth.uid());

insert into public.world_locations(slug,location_type,name_th,name_en,description_th)values
('aetherra','continent','เอเธอร์รา','Aetherra','ทวีปซึ่งสี่ภูมิภาคบรรจบกันรอบรอยแยกโบราณ');
insert into public.world_locations(slug,parent_id,location_type,name_th,name_en,description_th)
select 'aurelion',id,'kingdom','อาณาจักรออเรเลียน','Kingdom of Aurelion','แผ่นดินลุ่มแม่น้ำทางใต้ เมืองและหมู่บ้านเชื่อมกันด้วยเส้นทางการค้าเก่า' from public.world_locations where slug='aetherra';
with kingdom as(select id from public.world_locations where slug='aurelion')
insert into public.world_locations(slug,parent_id,location_type,name_th,name_en,description_th,map_x,map_y,scene_asset,danger_level,fast_travel)
select location.slug,kingdom.id,location.kind,location.name_th,location.name_en,location.description,location.x,location.y,location.asset,location.danger,location.fast
from kingdom cross join(values
('dawnspire','major_city','นครรุ่งอรุณ','Dawnspire','เมืองหลวงริมแม่น้ำ ที่ตั้งของราชสำนัก ตลาด และกิลด์ทั้งสี่',49,74,'/assets/riverrest.png',0,true),
('greenhollow','small_town','กรีนฮอลโลว์','Greenhollow','หมู่บ้านชายป่าที่ผู้เฒ่าเอลรินดูแลต้นไม้ศักดิ์สิทธิ์',31,60,'/assets/elderwood.png',1,false),
('riverrest','small_town','ริเวอร์เรสต์','Riverrest','เมืองพักทางริมสะพาน จุดรวมรถม้าและข่าวจากชายแดน',59,66,'/assets/riverrest.png',1,false),
('saltmere','small_town','ซอลต์เมียร์','Saltmere','ชุมชนชาวประมงใกล้พื้นที่แห้งแล้งและเหมืองเกลือดำ',72,75,'/assets/riverrest.png',2,false),
('whispervault','dungeon','สุสานเสียงกระซิบ','Whispervault','อุโมงค์ใต้รอยแยกที่เสียงของผู้ตายยังนำทางคนเป็น',46,49,'/assets/nightcrown.png',6,false),
('verdant-reach','wilderness','พงไพรเวอร์แดนต์','Verdant Reach','ผืนป่ามรกตซึ่งเส้นทางเปลี่ยนตำแหน่งทุกคืน',23,39,'/assets/elderwood.png',3,false),
('stonepass','wilderness','ช่องเขาสโตนพาส','Stonepass','ทางแคบผ่านเทือกเขาและปากถ้ำคริสตัล',62,37,'/assets/azuredeep.png',5,false),
('ashen-barrens','wilderness','ทุ่งเถ้า','Ashen Barrens','แดนแตกระแหงรอบภูเขาเพลิงที่ยังไม่ดับสนิท',78,61,'/assets/nightcrown.png',5,false)
)location(slug,kind,name_th,name_en,description,x,y,asset,danger,fast);

create or replace function public.ensure_character_world_position(target_character_id uuid)
returns public.character_world_positions language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;start_location public.world_locations%rowtype;result public.character_world_positions%rowtype;
begin
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception 'character not found';end if;
  select * into start_location from public.world_locations where slug='dawnspire';
  insert into public.character_world_positions(character_id,user_id,location_id)values(target_character_id,auth.uid(),start_location.id)
  on conflict on constraint character_world_positions_pkey do update set character_id=excluded.character_id returning * into result;return result;
end;$$;
revoke all on function public.ensure_character_world_position(uuid) from public;
grant execute on function public.ensure_character_world_position(uuid) to authenticated;
