insert into public.content_items(slug,name_th,name_en,rarity,category,base_value,weight,tags,properties) values
('brewed-vitality-tonic','ยาชูกำลังเข้มข้น','Brewed Vitality Tonic','rare','consumable',95,4,array['potion','brewed','healing'],jsonb_build_object('healing','2d4+2')),
('brewed-antivenom','เซรุ่มต้านพิษ','Brewed Antivenom','rare','consumable',110,3,array['potion','brewed','antidote'],jsonb_build_object('cures','poisoned')),
('brewed-haste-elixir','น้ำยาเร่งกาล','Haste Elixir','rare','consumable',180,2,array['potion','brewed','buff'],jsonb_build_object('effect','haste')),
('brewed-fireward-tincture','ทิงเจอร์เกราะเพลิง','Fireward Tincture','rare','consumable',165,3,array['potion','brewed','buff'],jsonb_build_object('effect','fire-ward'));

create table public.brewing_recipes(
  id bigint generated always as identity primary key,
  slug text not null unique,
  name_th text not null,
  description_th text not null,
  difficulty_class smallint not null check(difficulty_class between 1 and 30),
  output_item_id bigint not null references public.content_items(id),
  active boolean not null default true
);
create table public.brewing_recipe_ingredients(
  recipe_id bigint not null references public.brewing_recipes(id) on delete cascade,
  content_item_id bigint not null references public.content_items(id),
  quantity smallint not null check(quantity between 1 and 20),
  primary key(recipe_id,content_item_id)
);
create table public.brewing_history(
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id bigint not null references public.brewing_recipes(id),
  dice_roll smallint not null check(dice_roll between 1 and 20),
  intelligence_modifier smallint not null,
  difficulty_class smallint not null,
  quality text not null check(quality in('failed','standard','potent','masterwork')),
  output_quantity smallint not null check(output_quantity between 0 and 3),
  created_at timestamptz not null default now()
);
alter table public.brewing_recipes enable row level security;
alter table public.brewing_recipe_ingredients enable row level security;
alter table public.brewing_history enable row level security;
create policy "Players can read brewing recipes" on public.brewing_recipes for select to authenticated using(active);
create policy "Players can read brewing ingredients" on public.brewing_recipe_ingredients for select to authenticated using(exists(select 1 from public.brewing_recipes recipe where recipe.id=recipe_id and recipe.active));
create policy "Players can read their brewing history" on public.brewing_history for select to authenticated using(user_id=auth.uid());

with recipes(slug,name_th,description_th,dc,output_slug) as(values
('vitality-tonic','ยาชูกำลังเข้มข้น','สูตรพื้นฐานสำหรับฝึกควบคุมอุณหภูมิหม้อต้ม',1,'brewed-vitality-tonic'),
('antivenom','เซรุ่มต้านพิษ','สกัดสารต้านพิษจากสมุนไพรและเกลือดำ',12,'brewed-antivenom'),
('haste-elixir','น้ำยาเร่งกาล','น้ำยาไวต่อเวลา ต้องกวนตามจังหวะแม่นยำ',16,'brewed-haste-elixir'),
('fireward-tincture','ทิงเจอร์เกราะเพลิง','สารเคลือบเวทสำหรับต้านเปลวไฟ',15,'brewed-fireward-tincture'))
insert into public.brewing_recipes(slug,name_th,description_th,difficulty_class,output_item_id)
select recipe.slug,recipe.name_th,recipe.description_th,recipe.dc,item.id from recipes recipe join public.content_items item on item.slug=recipe.output_slug;

insert into public.brewing_recipe_ingredients(recipe_id,content_item_id,quantity)
select recipe.id,item.id,ingredient.quantity from(values
('vitality-tonic','common-31',1),('vitality-tonic','common-32',1),
('antivenom','common-31',2),('antivenom','common-36',1),
('haste-elixir','common-32',2),('haste-elixir','common-35',1),
('fireward-tincture','common-31',1),('fireward-tincture','common-36',2)
)ingredient(recipe_slug,item_slug,quantity)
join public.brewing_recipes recipe on recipe.slug=ingredient.recipe_slug join public.content_items item on item.slug=ingredient.item_slug;

create or replace function public.brew_potion(target_character_id uuid,target_recipe_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;recipe public.brewing_recipes%rowtype;ingredient record;stack public.character_item_stacks%rowtype;output public.content_items%rowtype;history public.brewing_history%rowtype;rolled integer;modifier integer;total integer;quality text;produced integer;
begin
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception 'character not found';end if;
  select * into recipe from public.brewing_recipes where id=target_recipe_id and active;if recipe.id is null then raise exception 'recipe not found';end if;
  for ingredient in select * from public.brewing_recipe_ingredients where recipe_id=recipe.id loop
    select * into stack from public.character_item_stacks where character_id=target_character_id and user_id=auth.uid() and content_item_id=ingredient.content_item_id for update;
    if stack.id is null or stack.quantity<ingredient.quantity then raise exception 'missing ingredients';end if;
  end loop;
  for ingredient in select * from public.brewing_recipe_ingredients where recipe_id=recipe.id loop
    delete from public.character_item_stacks where character_id=target_character_id and user_id=auth.uid() and content_item_id=ingredient.content_item_id and quantity=ingredient.quantity;
    update public.character_item_stacks set quantity=quantity-ingredient.quantity,updated_at=now() where character_id=target_character_id and user_id=auth.uid() and content_item_id=ingredient.content_item_id and quantity>ingredient.quantity;
  end loop;
  rolled:=floor(random()*20)::integer+1;modifier:=floor((hero.intelligence-10)::numeric/2)::integer;total:=rolled+modifier;
  quality:=case when total<recipe.difficulty_class then 'failed' when total>=recipe.difficulty_class+8 then 'masterwork' when total>=recipe.difficulty_class+4 then 'potent' else 'standard' end;
  produced:=case quality when 'masterwork' then 3 when 'potent' then 2 when 'standard' then 1 else 0 end;
  select * into output from public.content_items where id=recipe.output_item_id;
  if produced>0 then insert into public.character_item_stacks(character_id,user_id,content_item_id,quantity,acquired_unit_value)
    values(target_character_id,auth.uid(),output.id,produced,output.base_value)
    on conflict on constraint character_item_stacks_character_id_content_item_id_key do update set quantity=public.character_item_stacks.quantity+excluded.quantity,updated_at=now();end if;
  insert into public.brewing_history(character_id,user_id,recipe_id,dice_roll,intelligence_modifier,difficulty_class,quality,output_quantity)
  values(target_character_id,auth.uid(),recipe.id,rolled,modifier,recipe.difficulty_class,quality,produced) returning * into history;
  return jsonb_build_object('history_id',history.id,'recipe_id',recipe.id,'recipe_name',recipe.name_th,'dice_roll',rolled,'intelligence_modifier',modifier,'total',total,'difficulty_class',recipe.difficulty_class,'quality',quality,'success',produced>0,'output_item_id',case when produced>0 then output.id else null end,'output_name',case when produced>0 then output.name_th else null end,'output_quantity',produced);
end;$$;
revoke all on function public.brew_potion(uuid,bigint) from public;
grant execute on function public.brew_potion(uuid,bigint) to authenticated;
