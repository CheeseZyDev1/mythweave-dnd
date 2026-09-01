create or replace function public.travel_character_route(target_character_id uuid,target_location_id bigint,target_mode text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;position public.character_world_positions%rowtype;origin public.world_locations%rowtype;destination public.world_locations%rowtype;route public.world_routes%rowtype;wallet public.character_wallets%rowtype;ration public.content_items%rowtype;food_stack public.character_item_stacks%rowtype;trip public.character_travel_history%rowtype;food_remaining integer:=0;
begin
  if target_mode not in('fast_travel','carriage','griffin')then raise exception 'invalid travel mode';end if;
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception 'character not found';end if;
  select * into position from public.character_world_positions where character_id=target_character_id and user_id=auth.uid() for update;
  if position.character_id is null then perform public.ensure_character_world_position(target_character_id);select * into position from public.character_world_positions where character_id=target_character_id for update;end if;
  select * into origin from public.world_locations where id=position.location_id;select * into destination from public.world_locations where id=target_location_id and active;
  if destination.id is null then raise exception 'destination not found';end if;if origin.id=destination.id then raise exception 'already there';end if;
  select * into route from public.world_routes where active and travel_mode=target_mode and((from_location_id=origin.id and to_location_id=destination.id)or(from_location_id=destination.id and to_location_id=origin.id));
  if route.id is null then raise exception 'route unavailable';end if;
  if target_mode='fast_travel'and(origin.location_type<>'major_city'or destination.location_type<>'major_city'or not origin.fast_travel or not destination.fast_travel)then raise exception 'fast travel unavailable';end if;
  if route.cost_copper>0 then
    select * into wallet from public.character_wallets where character_id=target_character_id and user_id=auth.uid() for update;
    if wallet.balance_copper<route.cost_copper then raise exception 'insufficient funds';end if;
  end if;
  if route.food_cost>0 then
    select * into ration from public.content_items where slug='common-19';
    select * into food_stack from public.character_item_stacks where character_id=target_character_id and user_id=auth.uid() and content_item_id=ration.id for update;
    if food_stack.id is null or food_stack.quantity<route.food_cost then raise exception 'insufficient food';end if;
    food_remaining:=food_stack.quantity-route.food_cost;
    if food_remaining=0 then delete from public.character_item_stacks where id=food_stack.id;else update public.character_item_stacks set quantity=food_remaining,updated_at=now() where id=food_stack.id;end if;
  end if;
  if route.cost_copper>0 then
    update public.character_wallets set balance_copper=balance_copper-route.cost_copper,updated_at=now() where character_id=target_character_id returning * into wallet;
    insert into public.wallet_transactions(character_id,user_id,delta_copper,balance_after,reason)
    values(target_character_id,auth.uid(),-route.cost_copper,wallet.balance_copper,'ค่าเดินทาง '||case target_mode when 'carriage' then 'รถม้า' else 'กริฟฟิน' end||' ไป '||destination.name_th);
  end if;
  update public.character_world_positions set location_id=destination.id,world_hours_elapsed=world_hours_elapsed+route.duration_hours,arrived_at=now(),updated_at=now() where character_id=target_character_id returning * into position;
  insert into public.character_travel_history(character_id,user_id,from_location_id,to_location_id,travel_mode,duration_hours,cost_copper)
  values(target_character_id,auth.uid(),origin.id,destination.id,target_mode,route.duration_hours,route.cost_copper)returning * into trip;
  return jsonb_build_object('trip_id',trip.id,'location_id',destination.id,'location_name',destination.name_th,'travel_mode',target_mode,'duration_hours',route.duration_hours,'cost_copper',route.cost_copper,'food_cost',route.food_cost,'food_remaining',food_remaining,'wallet_balance',case when route.cost_copper>0 then wallet.balance_copper else null end,'world_hours_elapsed',position.world_hours_elapsed,'arrived_at',position.arrived_at);
end;$$;
