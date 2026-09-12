create table public.world_discovery_templates(
  id bigint generated always as identity primary key,
  slug text not null unique,
  category text not null check(category in('wonder','mystery','danger','resource','rumor')),
  title_th text not null,
  description_th text not null,
  rarity text not null check(rarity in('common','uncommon','rare')),
  weight integer not null check(weight between 1 and 100),
  active boolean not null default true
);
create table public.character_world_discoveries(
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id)on delete cascade,
  user_id uuid not null references auth.users(id)on delete cascade,
  location_id bigint not null references public.world_locations(id),
  template_id bigint not null references public.world_discovery_templates(id),
  discovered_at timestamptz not null default now(),
  unique(character_id,location_id)
);
alter table public.world_discovery_templates enable row level security;
alter table public.character_world_discoveries enable row level security;
create policy "Players can read discovery pool"on public.world_discovery_templates for select to authenticated using(active);
create policy "Players can read their discoveries"on public.character_world_discoveries for select to authenticated using(user_id=auth.uid());

insert into public.world_discovery_templates(slug,category,title_th,description_th,rarity,weight)values
('singing-stones','wonder','ศิลาที่ร้องรับสายลม','ก้อนหินสามก้อนเปล่งเสียงประสานเมื่อยืนในตำแหน่งที่ถูกต้อง ราวกับกำลังบอกทางไปที่ใดสักแห่ง','uncommon',12),
('upside-down-rain','wonder','ฝนที่ตกย้อนขึ้นฟ้า','หยดน้ำลอยจากแอ่งขึ้นสู่เมฆ ทิ้งเกล็ดแสงเย็นไว้บนฝ่ามือ','rare',6),
('door-without-wall','mystery','ประตูซึ่งไม่มีกำแพง','บานประตูเก่าตั้งโดดเดี่ยวกลางทาง เมื่อเปิดจะได้ยินเสียงตลาดจากเมืองที่ไม่มีบนแผนที่','rare',5),
('tomorrow-footprints','mystery','รอยเท้าจากวันพรุ่งนี้','รอยเท้าของปาร์ตี้ปรากฏอยู่ก่อนหน้า ทั้งที่ยังไม่มีใครเดินผ่านตรงนั้น','uncommon',10),
('sleeping-colossus','danger','เนินเขาที่กำลังหายใจ','พื้นดินขยับช้า ๆ ใต้ฝ่าเท้า สิ่งที่ดูเหมือนภูเขาอาจเป็นสิ่งมีชีวิตขนาดมหึมา','rare',5),
('glass-wolves','danger','ฝูงหมาป่าแก้ว','เงารูปหมาป่าวิ่งขนานไปกับเส้นทาง ร่างโปร่งใสสะท้อนภาพของผู้เดินทางแทนทิวทัศน์','uncommon',9),
('star-moss','resource','มอสดูดซับแสงดาว','มอสสีครามเรืองแสงเมื่อสัมผัสเวทมนตร์ นักปรุงยาอาจใช้เป็นวัตถุดิบหายากได้','common',18),
('whisper-coins','resource','เหรียญกระซิบ','เหรียญโบราณจำนวนหนึ่งซ่อนใต้รากไม้ ทุกเหรียญกระซิบชื่อเจ้าของคนก่อน','common',16),
('wandering-inn','rumor','โรงเตี๊ยมที่ย้ายที่ทุกคืน','ป้ายไม้สดใหม่ปักไว้ริมทาง บอกว่าโรงเตี๊ยมไร้พิกัดจะเปิดเมื่อพระจันทร์ดับ','uncommon',11),
('faceless-cartographer','rumor','นักทำแผนที่ไร้ใบหน้า','คนเดินทางในผ้าคลุมทิ้งเศษแผนที่ซึ่งวาดเส้นทางใหม่เองทุกครั้งที่พับ','rare',6),
('tiny-kingdom','wonder','อาณาจักรใต้เห็ด','ใต้ดอกเห็ดยักษ์มีขบวนอัศวินตัวจิ๋วกำลังทำพิธีสาบานตนอย่างจริงจัง','uncommon',12),
('borrowed-shadow','mystery','เงาที่ไม่ใช่ของเรา','เมื่อดวงอาทิตย์คล้อยต่ำ เงาของคนหนึ่งในปาร์ตี้กลับถืออาวุธและสวมมงกุฎที่เจ้าตัวไม่มี','common',15)
on conflict(slug)do nothing;

create or replace function public.discover_world_location(target_character_id uuid,target_location_id bigint)
returns jsonb language plpgsql security definer set search_path=''as $$
declare hero public.characters%rowtype;position public.character_world_positions%rowtype;template public.world_discovery_templates%rowtype;entry public.character_world_discoveries%rowtype;
begin
  select*into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception'character not found';end if;
  select*into position from public.character_world_positions where character_id=hero.id;if position.location_id<>target_location_id then raise exception'location not reached';end if;
  if exists(select 1 from public.character_world_discoveries where character_id=hero.id and location_id=target_location_id)then return null;end if;
  select*into template from public.world_discovery_templates where active order by -ln(greatest(random(),0.000001))/weight limit 1;
  insert into public.character_world_discoveries(character_id,user_id,location_id,template_id)values(hero.id,auth.uid(),target_location_id,template.id)returning*into entry;
  return jsonb_build_object('id',entry.id,'location_id',target_location_id,'title_th',template.title_th,'description_th',template.description_th,'category',template.category,'rarity',template.rarity,'discovered_at',entry.discovered_at,'is_new',true);
end;$$;
revoke all on function public.discover_world_location(uuid,bigint)from public;
grant execute on function public.discover_world_location(uuid,bigint)to authenticated;
