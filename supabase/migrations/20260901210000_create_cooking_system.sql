insert into public.content_items(slug,name_th,name_en,rarity,category,base_value,weight,tags,properties) values
('crafted-trail-skewers','เนื้อเสียบไม้เดินทาง','Trail Skewers','rare','consumable',35,8,array['food','crafted'],jsonb_build_object('healing',2)),
('crafted-vigor-stew','สตูว์สมุนไพรฟื้นแรง','Vigor Herb Stew','rare','consumable',70,5,array['food','crafted','buff'],jsonb_build_object('healing',4)),
('crafted-glowcap-soup','ซุปเห็ดแสงจันทร์','Moonlit Glowcap Soup','rare','consumable',85,4,array['food','crafted','buff'],jsonb_build_object('healing',3)),
('crafted-black-salt-bread','ขนมปังเกลือดำ','Black Salt Bread','rare','consumable',55,6,array['food','crafted'],jsonb_build_object('healing',3));

insert into public.status_effect_templates(slug,name_th,effect_type,description_th,default_duration,max_stacks,modifiers)
values('well-fed','อิ่มเอม','buff','อาหารร้อนช่วยให้ฟื้นกำลังและต้านทานความเหนื่อยล้า',3,1,jsonb_build_object('temporary_hp',2));

create table public.cooking_recipes(
  id bigint generated always as identity primary key,
  slug text not null unique,
  name_th text not null,
  description_th text not null,
  difficulty_class smallint not null check(difficulty_class between 1 and 30),
  output_item_id bigint not null references public.content_items(id),
  output_quantity smallint not null default 1 check(output_quantity between 1 and 20),
  effect_template_id bigint references public.status_effect_templates(id),
  active boolean not null default true
);
create table public.cooking_recipe_ingredients(
  recipe_id bigint not null references public.cooking_recipes(id) on delete cascade,
  content_item_id bigint not null references public.content_items(id),
  quantity smallint not null check(quantity between 1 and 20),
  primary key(recipe_id,content_item_id)
);
create table public.cooking_history(
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id bigint not null references public.cooking_recipes(id),
  dice_roll smallint not null check(dice_roll between 1 and 20),
  wisdom_modifier smallint not null,
  difficulty_class smallint not null,
  success boolean not null,
  created_at timestamptz not null default now()
);
alter table public.cooking_recipes enable row level security;
alter table public.cooking_recipe_ingredients enable row level security;
alter table public.cooking_history enable row level security;
create policy "Players can read cooking recipes" on public.cooking_recipes for select to authenticated using(active);
create policy "Players can read cooking ingredients" on public.cooking_recipe_ingredients for select to authenticated using(exists(select 1 from public.cooking_recipes recipe where recipe.id=recipe_id and recipe.active));
create policy "Players can read their cooking history" on public.cooking_history for select to authenticated using(user_id=auth.uid());

with recipes(slug,name_th,description_th,dc,output_slug) as (values
('trail-skewers','เนื้อเสียบไม้เดินทาง','สูตรง่ายสำหรับนักผจญภัยมือใหม่',1,'crafted-trail-skewers'),
('vigor-stew','สตูว์สมุนไพรฟื้นแรง','สตูว์เข้มข้นช่วยคืนเรี่ยวแรง',12,'crafted-vigor-stew'),
('glowcap-soup','ซุปเห็ดแสงจันทร์','ซุปเรืองแสงที่อุ่นจากภายใน',14,'crafted-glowcap-soup'),
('black-salt-bread','ขนมปังเกลือดำ','ขนมปังพกพารสเข้มของชายแดน',10,'crafted-black-salt-bread'))
insert into public.cooking_recipes(slug,name_th,description_th,difficulty_class,output_item_id,output_quantity,effect_template_id)
select recipe.slug,recipe.name_th,recipe.description_th,recipe.dc,item.id,1,effect.id
from recipes recipe join public.content_items item on item.slug=recipe.output_slug
cross join public.status_effect_templates effect where effect.slug='well-fed';

insert into public.cooking_recipe_ingredients(recipe_id,content_item_id,quantity)
select recipe.id,item.id,ingredient.quantity from (values
('trail-skewers','common-19',1),('trail-skewers','common-36',1),
('vigor-stew','common-19',1),('vigor-stew','common-31',2),('vigor-stew','common-36',1),
('glowcap-soup','common-32',2),('glowcap-soup','common-36',1),
('black-salt-bread','common-19',2),('black-salt-bread','common-36',1)
) ingredient(recipe_slug,item_slug,quantity)
join public.cooking_recipes recipe on recipe.slug=ingredient.recipe_slug
join public.content_items item on item.slug=ingredient.item_slug;

create or replace function public.cook_recipe(target_character_id uuid,target_recipe_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;recipe public.cooking_recipes%rowtype;ingredient record;stack public.character_item_stacks%rowtype;output public.content_items%rowtype;effect public.status_effect_templates%rowtype;rolled integer;modifier integer;passed boolean;history public.cooking_history%rowtype;
begin
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception 'character not found';end if;
  select * into recipe from public.cooking_recipes where id=target_recipe_id and active;if recipe.id is null then raise exception 'recipe not found';end if;
  for ingredient in select * from public.cooking_recipe_ingredients where recipe_id=recipe.id loop
    select * into stack from public.character_item_stacks where character_id=target_character_id and user_id=auth.uid() and content_item_id=ingredient.content_item_id for update;
    if stack.id is null or stack.quantity<ingredient.quantity then raise exception 'missing ingredients';end if;
  end loop;
  for ingredient in select * from public.cooking_recipe_ingredients where recipe_id=recipe.id loop
    update public.character_item_stacks set quantity=quantity-ingredient.quantity,updated_at=now() where character_id=target_character_id and content_item_id=ingredient.content_item_id;
    delete from public.character_item_stacks where character_id=target_character_id and content_item_id=ingredient.content_item_id and quantity=0;
  end loop;
  rolled:=floor(random()*20)::integer+1;modifier:=floor((hero.wisdom-10)::numeric/2)::integer;passed:=rolled<>1 and rolled+modifier>=recipe.difficulty_class;
  select * into output from public.content_items where id=recipe.output_item_id;
  if passed then
    insert into public.character_item_stacks(character_id,user_id,content_item_id,quantity,acquired_unit_value)
    values(target_character_id,auth.uid(),output.id,recipe.output_quantity,output.base_value)
    on conflict on constraint character_item_stacks_character_id_content_item_id_key do update set quantity=public.character_item_stacks.quantity+excluded.quantity,updated_at=now();
    if recipe.effect_template_id is not null then
      select * into effect from public.status_effect_templates where id=recipe.effect_template_id;
      insert into public.character_status_effects(character_id,user_id,template_id,name_th,effect_type,description_th,duration_remaining,stacks,modifiers,source)
      values(target_character_id,auth.uid(),effect.id,effect.name_th,effect.effect_type,effect.description_th,effect.default_duration,1,effect.modifiers,'อาหาร: '||recipe.name_th)
      on conflict on constraint character_status_effects_character_id_template_id_key do update set duration_remaining=effect.default_duration,source=excluded.source;
    end if;
  end if;
  insert into public.cooking_history(character_id,user_id,recipe_id,dice_roll,wisdom_modifier,difficulty_class,success)
  values(target_character_id,auth.uid(),recipe.id,rolled,modifier,recipe.difficulty_class,passed) returning * into history;
  return jsonb_build_object('history_id',history.id,'recipe_id',recipe.id,'recipe_name',recipe.name_th,'dice_roll',rolled,'wisdom_modifier',modifier,'total',rolled+modifier,'difficulty_class',recipe.difficulty_class,'success',passed,'output_item_id',case when passed then output.id else null end,'output_name',case when passed then output.name_th else null end,'output_quantity',case when passed then recipe.output_quantity else 0 end);
end;$$;
revoke all on function public.cook_recipe(uuid,bigint) from public;
grant execute on function public.cook_recipe(uuid,bigint) to authenticated;
