create table public.item_generation_components(
  id bigint generated always as identity primary key,
  component_type text not null check(component_type in('base','prefix','suffix')),
  category text not null check(category in('any','weapon','armor','consumable')),
  name_th text not null,
  min_rarity_rank smallint not null default 1 check(min_rarity_rank between 1 and 5),
  properties jsonb not null default '{}',
  weight integer not null default 10 check(weight between 1 and 1000),
  active boolean not null default true
);
create table public.generated_items(
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name_th text not null,
  rarity text not null check(rarity in('common','uncommon','rare','epic','legendary')),
  category text not null check(category in('weapon','armor','consumable')),
  power_rating smallint not null check(power_rating between 1 and 100),
  properties jsonb not null default '{}',
  source text not null default 'procedural_forge',
  seed uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.item_generation_components enable row level security;
alter table public.generated_items enable row level security;
create policy "Players can read generation components" on public.item_generation_components for select to authenticated using(active);
create policy "Players can read their generated items" on public.generated_items for select to authenticated using(user_id=auth.uid());

insert into public.item_generation_components(component_type,category,name_th,min_rarity_rank,properties,weight)values
('base','weapon','ดาบ',1,'{"damage_die":"d8","damage_type":"slashing"}',12),('base','weapon','ขวาน',1,'{"damage_die":"d10","damage_type":"slashing"}',9),('base','weapon','ธนู',1,'{"damage_die":"d8","damage_type":"piercing","range":80}',10),
('base','armor','เกราะหนัง',1,'{"armor_class":12}',12),('base','armor','เกราะโซ่',1,'{"armor_class":14}',9),('base','armor','โล่',1,'{"armor_bonus":2}',10),
('base','consumable','น้ำยา',1,'{"uses":1}',12),('base','consumable','ผงเวท',1,'{"uses":1}',9),('base','consumable','ศิลาแตกหัก',1,'{"uses":1}',7),
('prefix','any','เหล็กกล้า',1,'{"durability":5}',12),('prefix','any','นักล่า',2,'{"accuracy":1}',9),('prefix','any','เพลิง',2,'{"fire_damage":2}',8),('prefix','any','จันทรา',3,'{"magic_power":2}',6),('prefix','any','ราชัน',4,'{"all_checks":1}',3),('prefix','any','เทวะ',5,'{"all_checks":2}',1),
('suffix','any','แห่งหมอก',1,'{"stealth":1}',12),('suffix','any','แห่งพละกำลัง',2,'{"strength":1}',9),('suffix','any','แห่งปัญญา',2,'{"intelligence":1}',9),('suffix','any','แห่งพายุ',3,'{"lightning_damage":3}',5),('suffix','any','แห่งชะตา',4,'{"critical_range":1}',3),('suffix','any','แห่งดวงดาว',5,'{"spell_save_dc":2}',1);

create or replace function public.generate_procedural_item(target_character_id uuid,target_category text default 'any')
returns public.generated_items language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;base_part public.item_generation_components%rowtype;prefix_part public.item_generation_components%rowtype;suffix_part public.item_generation_components%rowtype;result public.generated_items%rowtype;chosen_category text;rarity_name text;rarity_rank integer;rarity_roll integer;power integer;
begin
  if target_category not in('any','weapon','armor','consumable')then raise exception 'invalid category';end if;
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception 'character not found';end if;
  if exists(select 1 from public.generated_items where character_id=target_character_id and created_at>now()-interval '15 seconds')then raise exception 'generation cooldown';end if;
  chosen_category:=case when target_category='any' then (array['weapon','armor','consumable'])[floor(random()*3)::integer+1] else target_category end;
  rarity_roll:=floor(random()*100)::integer+1+least(hero.level,10);
  if rarity_roll>=108 then rarity_name:='legendary';rarity_rank:=5;elsif rarity_roll>=98 then rarity_name:='epic';rarity_rank:=4;elsif rarity_roll>=85 then rarity_name:='rare';rarity_rank:=3;elsif rarity_roll>=60 then rarity_name:='uncommon';rarity_rank:=2;else rarity_name:='common';rarity_rank:=1;end if;
  select * into base_part from public.item_generation_components where component_type='base' and category=chosen_category and active order by -ln(greatest(random(),0.000001))/weight limit 1;
  select * into prefix_part from public.item_generation_components where component_type='prefix' and category='any' and min_rarity_rank<=rarity_rank and active order by -ln(greatest(random(),0.000001))/weight limit 1;
  select * into suffix_part from public.item_generation_components where component_type='suffix' and category='any' and min_rarity_rank<=rarity_rank and active order by -ln(greatest(random(),0.000001))/weight limit 1;
  power:=least(100,greatest(1,hero.level+floor(random()*6)::integer+1+(rarity_rank-1)*5));
  insert into public.generated_items(character_id,user_id,name_th,rarity,category,power_rating,properties)
  values(target_character_id,auth.uid(),prefix_part.name_th||base_part.name_th||suffix_part.name_th,rarity_name,chosen_category,power,base_part.properties||prefix_part.properties||suffix_part.properties||jsonb_build_object('rarity_rank',rarity_rank))
  returning * into result;return result;
end;$$;
revoke all on function public.generate_procedural_item(uuid,text) from public;
grant execute on function public.generate_procedural_item(uuid,text) to authenticated;
