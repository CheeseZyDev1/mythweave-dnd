create table public.monster_generation_components(
  id bigint generated always as identity primary key,
  component_type text not null check(component_type in('species','adjective','trait')),
  biome text not null check(biome in('any','forest','cave','swamp','ruins')),
  name_th text not null,
  min_tier smallint not null default 1 check(min_tier between 1 and 4),
  modifiers jsonb not null default '{}',
  weight integer not null default 10 check(weight between 1 and 1000),
  active boolean not null default true
);
create table public.generated_monsters(
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.dice_tables(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name_th text not null,
  challenge_tier text not null check(challenge_tier in('minion','standard','elite','boss')),
  biome text not null check(biome in('forest','cave','swamp','ruins')),
  hp_max integer not null check(hp_max between 1 and 9999),
  armor_class smallint not null check(armor_class between 1 and 40),
  attack_bonus smallint not null check(attack_bonus between -10 and 30),
  damage_dice text not null,
  traits jsonb not null default '[]',
  seed uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.monster_generation_components enable row level security;
alter table public.generated_monsters enable row level security;
create policy "Players can read monster components" on public.monster_generation_components for select to authenticated using(active);
create policy "Room members can read generated monsters" on public.generated_monsters for select to authenticated using(public.is_dice_table_member(table_id));
insert into public.monster_generation_components(component_type,biome,name_th,min_tier,modifiers,weight)values
('species','forest','หมาป่า',1,'{"speed":40}',12),('species','forest','เถาวัลย์กินคน',1,'{"reach":10}',8),('species','cave','ค้างคาวหิน',1,'{"flying":true}',11),('species','cave','โทรลถ้ำ',2,'{"regeneration":2}',7),('species','swamp','จระเข้โคลน',1,'{"swim":30}',10),('species','swamp','อสูรหนอง',2,'{"poison":2}',7),('species','ruins','โครงกระดูก',1,'{"undead":true}',12),('species','ruins','ผู้พิทักษ์ศิลา',2,'{"construct":true}',7),
('adjective','any','คลุ้มคลั่ง',1,'{"attack_bonus":1}',10),('adjective','any','เกราะหนา',1,'{"armor_class":1}',10),('adjective','any','ต้องสาป',2,'{"magic_damage":2}',7),('adjective','any','เลือดอสูร',3,'{"hp_multiplier":1.25}',4),('adjective','any','บรรพกาล',4,'{"legendary_action":1}',2),
('trait','any','จู่โจมจากเงา',1,'{"ambush":true}',10),('trait','any','เสียงคำรามสั่นขวัญ',1,'{"fear_dc":12}',9),('trait','forest','พรางตัวในพงไพร',1,'{"stealth":3}',10),('trait','cave','สะท้อนเสียงหาเหยื่อ',1,'{"blindsight":30}',10),('trait','swamp','ไอพิษรอบตัว',2,'{"poison_aura":5}',7),('trait','ruins','ต้านเวทโบราณ',2,'{"magic_resistance":true}',7),('trait','any','ฟื้นคืนหนึ่งครั้ง',4,'{"second_phase":true}',2);

create or replace function public.generate_room_monster(target_table_id uuid,target_challenge text,target_biome text)
returns public.generated_monsters language plpgsql security definer set search_path='' as $$
declare member public.dice_table_members%rowtype;species public.monster_generation_components%rowtype;adjective public.monster_generation_components%rowtype;trait public.monster_generation_components%rowtype;result public.generated_monsters%rowtype;tier integer;base_hp integer;hp integer;ac integer;attack integer;damage text;merged jsonb;
begin
  if target_challenge not in('minion','standard','elite','boss')or target_biome not in('forest','cave','swamp','ruins')then raise exception 'invalid generation';end if;
  select * into member from public.dice_table_members where table_id=target_table_id and user_id=auth.uid() and role='dm';if member.user_id is null then raise exception 'dm required';end if;
  if exists(select 1 from public.generated_monsters where table_id=target_table_id and created_at>now()-interval '10 seconds')then raise exception 'generation cooldown';end if;
  tier:=case target_challenge when 'minion' then 1 when 'standard' then 2 when 'elite' then 3 else 4 end;
  select * into species from public.monster_generation_components where component_type='species' and biome=target_biome and min_tier<=tier and active order by -ln(greatest(random(),0.000001))/weight limit 1;
  select * into adjective from public.monster_generation_components where component_type='adjective' and biome='any' and min_tier<=tier and active order by -ln(greatest(random(),0.000001))/weight limit 1;
  select * into trait from public.monster_generation_components where component_type='trait' and biome in('any',target_biome) and min_tier<=tier and active order by -ln(greatest(random(),0.000001))/weight limit 1;
  base_hp:=case tier when 1 then 6 when 2 then 18 when 3 then 42 else 95 end;hp:=base_hp+floor(random()*(base_hp/2+1))::integer;ac:=10+tier+floor(random()*3)::integer;attack:=tier+1+floor(random()*3)::integer;damage:=case tier when 1 then '1d4+1' when 2 then '1d8+2' when 3 then '2d8+3' else '3d10+5' end;
  if adjective.modifiers?'hp_multiplier'then hp:=floor(hp*(adjective.modifiers->>'hp_multiplier')::numeric)::integer;end if;
  ac:=ac+coalesce((adjective.modifiers->>'armor_class')::integer,0);attack:=attack+coalesce((adjective.modifiers->>'attack_bonus')::integer,0);merged:=species.modifiers||adjective.modifiers||trait.modifiers;
  insert into public.generated_monsters(table_id,created_by,name_th,challenge_tier,biome,hp_max,armor_class,attack_bonus,damage_dice,traits)
  values(target_table_id,auth.uid(),adjective.name_th||species.name_th,target_challenge,target_biome,hp,ac,attack,damage,jsonb_build_object('signature',trait.name_th,'modifiers',merged))returning * into result;return result;
end;$$;
revoke all on function public.generate_room_monster(uuid,text,text) from public;
grant execute on function public.generate_room_monster(uuid,text,text) to authenticated;
alter publication supabase_realtime add table public.generated_monsters;
