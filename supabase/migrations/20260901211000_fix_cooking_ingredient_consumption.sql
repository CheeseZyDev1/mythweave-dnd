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
    delete from public.character_item_stacks where character_id=target_character_id and user_id=auth.uid() and content_item_id=ingredient.content_item_id and quantity=ingredient.quantity;
    update public.character_item_stacks set quantity=quantity-ingredient.quantity,updated_at=now() where character_id=target_character_id and user_id=auth.uid() and content_item_id=ingredient.content_item_id and quantity>ingredient.quantity;
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
