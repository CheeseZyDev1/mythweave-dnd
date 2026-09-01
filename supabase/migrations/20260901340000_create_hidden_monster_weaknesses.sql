create table public.monster_weakness_templates(
  id bigint generated always as identity primary key,
  slug text not null unique,
  biome text not null check(biome in('any','forest','cave','swamp','ruins')),
  damage_type text not null check(damage_type in('fire','cold','lightning','radiant','bludgeoning','piercing','slashing','poison','psychic')),
  name_th text not null,
  clue_th text not null,
  multiplier numeric(3,2) not null check(multiplier between 1.25 and 3.00),
  weight integer not null default 10 check(weight between 1 and 100),
  active boolean not null default true
);
create table public.generated_monster_weaknesses(
  monster_id uuid primary key references public.generated_monsters(id) on delete cascade,
  template_id bigint not null references public.monster_weakness_templates(id),
  assigned_at timestamptz not null default now()
);
alter table public.monster_weakness_templates enable row level security;
alter table public.generated_monster_weaknesses enable row level security;
-- Intentionally no SELECT policies: weaknesses are resolved only by the secured function below.

insert into public.monster_weakness_templates(slug,biome,damage_type,name_th,clue_th,multiplier,weight)values
('dry-bark','forest','fire','เนื้อไม้แห้ง','ผิวของมันแตกร่วนและถอยหนีจากเปลวไฟ',1.75,15),
('frozen-sap','forest','cold','ยางไม้แข็งตัว','ของเหลวใต้ผิวเคลื่อนไหวช้าลงเมื่ออากาศเย็นจัด',1.50,10),
('hollow-bone','cave','bludgeoning','โครงสร้างกลวง','เสียงสะท้อนจากร่างบอกว่าภายในเปราะและว่างเปล่า',1.75,15),
('sun-starved','cave','radiant','หวาดแสง','ดวงตาซีดหรี่ลงแม้พบแสงเพียงเล็กน้อย',2.00,10),
('conductive-hide','swamp','lightning','ผิวชุ่มน้ำ','เมือกบนผิวเชื่อมกระแสไฟไปทั่วทั้งร่าง',1.75,15),
('purging-flame','swamp','fire','เกลียดความร้อน','ไอพิษรอบตัวสลายเมื่อถูกความร้อนรุนแรง',1.50,10),
('cracked-rune','ruins','bludgeoning','รูนแตกร้าว','รอยสลักโบราณสั่นผิดจังหวะเมื่อถูกแรงกระแทก',1.75,15),
('unquiet-soul','ruins','radiant','วิญญาณไม่สงบ','เงาในเบ้าตาหดตัวเมื่อสัญลักษณ์ศักดิ์สิทธิ์เข้าใกล้',2.00,15),
('exposed-joint','any','piercing','ข้อต่อเปิด','เกราะซ้อนกันไม่สนิทตรงข้อต่อด้านหลัง',1.50,10),
('torn-membrane','any','slashing','เยื่อป้องกันบาง','แผ่นป้องกันด้านข้างฉีกขาดง่ายตามแนวเส้นใย',1.50,10),
('fragile-mind','any','psychic','จิตไม่มั่นคง','การเคลื่อนไหวสะดุดเมื่อได้ยินเสียงกระซิบที่ไม่มีต้นทาง',1.50,8),
('cold-core','any','cold','แก่นร้อนผิดปกติ','ไอร้อนรั่วออกจากรอยต่อทุกครั้งที่มันออกแรง',1.50,8);

create or replace function public.assign_generated_monster_weakness()
returns trigger language plpgsql security definer set search_path='' as $$
declare chosen public.monster_weakness_templates%rowtype;
begin
  select * into chosen from public.monster_weakness_templates where biome in('any',new.biome)and active order by -ln(greatest(random(),0.000001))/weight limit 1;
  if chosen.id is null then raise exception 'monster weakness pool missing';end if;
  insert into public.generated_monster_weaknesses(monster_id,template_id)values(new.id,chosen.id);return new;
end;$$;
create trigger generated_monsters_assign_weakness after insert on public.generated_monsters for each row execute function public.assign_generated_monster_weakness();
insert into public.generated_monster_weaknesses(monster_id,template_id)
select monster.id,chosen.id from public.generated_monsters monster join lateral(select template.id from public.monster_weakness_templates template where template.biome in('any',monster.biome)and template.active order by md5(monster.id::text||template.slug)limit 1)chosen on true on conflict(monster_id)do nothing;

create or replace function public.resolve_monster_weakness_hit(target_monster_id uuid,target_damage_type text,target_base_damage integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare monster public.generated_monsters%rowtype;member public.dice_table_members%rowtype;weakness public.monster_weakness_templates%rowtype;matched boolean;applied integer;
begin
  if target_damage_type not in('fire','cold','lightning','radiant','bludgeoning','piercing','slashing','poison','psychic')or target_base_damage not between 1 and 999 then raise exception 'invalid damage';end if;
  select * into monster from public.generated_monsters where id=target_monster_id;if monster.id is null then raise exception 'monster not found';end if;
  select * into member from public.dice_table_members where table_id=monster.table_id and user_id=auth.uid()and role='dm';if member.user_id is null then raise exception 'dm required';end if;
  select template.* into weakness from public.generated_monster_weaknesses assigned join public.monster_weakness_templates template on template.id=assigned.template_id where assigned.monster_id=monster.id;
  matched:=weakness.damage_type=target_damage_type;applied:=case when matched then floor(target_base_damage*weakness.multiplier)::integer else target_base_damage end;
  return jsonb_build_object('monster_id',monster.id,'damage_type',target_damage_type,'base_damage',target_base_damage,'applied_damage',applied,'effective',matched,'multiplier',case when matched then weakness.multiplier else 1 end);
end;$$;
revoke all on function public.resolve_monster_weakness_hit(uuid,text,integer) from public;
grant execute on function public.resolve_monster_weakness_hit(uuid,text,integer) to authenticated;
