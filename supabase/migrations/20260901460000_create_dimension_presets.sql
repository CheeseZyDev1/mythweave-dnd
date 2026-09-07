create table public.dimension_presets(
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_th text not null,
  name_en text not null,
  difficulty_slug text not null check(difficulty_slug in('adventure','perilous','nightmare')),
  difficulty_label_th text not null,
  difficulty_rank smallint not null check(difficulty_rank between 1 and 5),
  theme_slug text not null,
  theme_name_th text not null,
  theme_description_th text not null,
  story_slug text not null,
  story_title_th text not null,
  story_premise_th text not null,
  rules_config jsonb not null default '{}'::jsonb,
  accent_color text not null check(accent_color~'^#[0-9A-Fa-f]{6}$'),
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
alter table public.dimension_presets enable row level security;
create policy "Players can read active dimensions"on public.dimension_presets for select to authenticated using(active or public.is_site_admin());
insert into public.dimension_presets(slug,name_th,name_en,difficulty_slug,difficulty_label_th,difficulty_rank,theme_slug,theme_name_th,theme_description_th,story_slug,story_title_th,story_premise_th,rules_config,accent_color,sort_order)values
('aetherra-prime','เอเธอร์ราปฐมบท','Aetherra Prime','adventure','นักผจญภัย',1,'verdant-realms','อาณาจักรเขียวขจี','โลกแฟนตาซีสมดุล เมืองและป่ายังเปิดรับผู้กล้าหน้าใหม่','crown-of-dawn','มงกุฎแห่งรุ่งอรุณ','สี่อาณาจักรต้องร่วมมือก่อนเงาโบราณกลืนแสงแรก',jsonb_build_object('enemy_scale',1.0,'stamina',false,'rng','protected'),'#DDBE72',1),
('umbra-veil','ม่านเงาอัมบรา','Umbra Veil','perilous','อันตราย',3,'eternal-dusk','สนธยานิรันดร์','เมืองร้างใต้ฟ้าสีม่วง ทรัพยากรน้อยและศัตรูแข็งแกร่ง','the-hollow-bell','ระฆังกลวง','ทุกคืนระฆังที่ไม่มีผู้ตีจะพรากความทรงจำหนึ่งอย่างจากโลก',jsonb_build_object('enemy_scale',1.45,'stamina',true,'rng','protected'),'#A16CC1',2),
('twin-star-abyss','ห้วงดาวคู่ขนาน','Twin-Star Abyss','nightmare','ฝันร้าย',5,'fractured-cosmos','จักรวาลแตกร้าว','เกาะลอยฟ้าและเส้นเวลาซ้อนทับ กฎธรรมชาติเปลี่ยนทุกวัน','two-suns-dying','ตะวันคู่ดับสูญ','ผู้กล้าต้องเลือกว่าโลกใดจะรอดเมื่อดวงตะวันสองดวงกำลังชนกัน',jsonb_build_object('enemy_scale',2.0,'stamina',true,'rng','pure'),'#D65F69',3);
