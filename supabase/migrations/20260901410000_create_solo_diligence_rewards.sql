insert into public.content_items(slug,name_th,name_en,rarity,category,base_value,weight,tags,properties,active)
values('wilderness-vigil-sigil','ตราผู้เฝ้าพงไพร','Wilderness Vigil Sigil','soulbound','treasure',0,1,array['solo','diligence','soulbound'],'{"tradeable":false,"milestone_days":3}',true);

create table public.solo_diligence_days(
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  solo_adventure_id uuid not null references public.solo_adventures(id) on delete cascade,
  activity_date date not null,
  created_at timestamptz not null default now(),
  unique(character_id,activity_date)
);
create table public.solo_diligence_rewards(
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null unique references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content_item_id bigint not null references public.content_items(id),
  milestone_days integer not null default 3 check(milestone_days=3),
  awarded_at timestamptz not null default now()
);
alter table public.solo_diligence_days enable row level security;
alter table public.solo_diligence_rewards enable row level security;
create policy "Players can read their solo diligence days" on public.solo_diligence_days for select to authenticated using(user_id=auth.uid());
create policy "Players can read their solo diligence rewards" on public.solo_diligence_rewards for select to authenticated using(user_id=auth.uid());

create or replace function public.mark_solo_diligence(target_character_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;session public.solo_adventures%rowtype;life public.solo_life_states%rowtype;position public.character_world_positions%rowtype;location public.world_locations%rowtype;reward_item public.content_items%rowtype;reward public.solo_diligence_rewards%rowtype;today_th date;days_marked integer;awarded_now boolean:=false;
begin
  today_th:=(clock_timestamp() at time zone 'Asia/Bangkok')::date;
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid() for update;
  if hero.id is null then raise exception 'character not found';end if;
  select * into session from public.solo_adventures where character_id=hero.id and user_id=auth.uid() and status='active' for update;
  if session.id is null then raise exception 'solo not active';end if;
  select * into life from public.solo_life_states where character_id=hero.id and user_id=auth.uid();
  if life.status='dead' then raise exception 'character dead';end if;
  select * into position from public.character_world_positions where character_id=hero.id;
  select * into location from public.world_locations where id=position.location_id;
  if location.location_type<>'wilderness' then raise exception 'wilderness required';end if;
  if exists(select 1 from public.solo_diligence_days where character_id=hero.id and activity_date=today_th) then raise exception 'already marked today';end if;
  insert into public.solo_diligence_days(character_id,user_id,solo_adventure_id,activity_date) values(hero.id,auth.uid(),session.id,today_th);
  select count(*) into days_marked from public.solo_diligence_days where character_id=hero.id;
  if days_marked>=3 and not exists(select 1 from public.solo_diligence_rewards where character_id=hero.id) then
    select * into reward_item from public.content_items where slug='wilderness-vigil-sigil';
    insert into public.solo_diligence_rewards(character_id,user_id,content_item_id) values(hero.id,auth.uid(),reward_item.id) returning * into reward;
    insert into public.character_item_stacks(character_id,user_id,content_item_id,quantity,acquired_unit_value)
    values(hero.id,auth.uid(),reward_item.id,1,0)
    on conflict(character_id,content_item_id) do nothing;
    awarded_now:=true;
  end if;
  return jsonb_build_object('activity_date',today_th,'days_marked',days_marked,'milestone_days',3,'days_remaining',greatest(0,3-days_marked),'reward_awarded',awarded_now,'reward_owned',exists(select 1 from public.solo_diligence_rewards where character_id=hero.id),'reward_name',case when days_marked>=3 then 'ตราผู้เฝ้าพงไพร' else null end);
end;$$;
revoke all on function public.mark_solo_diligence(uuid) from public;
grant execute on function public.mark_solo_diligence(uuid) to authenticated;

create or replace function public.buy_shop_item(target_character_id uuid,target_item_id bigint,target_quantity integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare wallet public.character_wallets%rowtype;item public.content_items%rowtype;deal public.shop_haggles%rowtype;total integer;unit_price integer;discount integer:=0;stack public.character_item_stacks%rowtype;
begin
  if target_quantity<1 or target_quantity>99 then raise exception 'invalid quantity';end if;
  select * into wallet from public.character_wallets where character_id=target_character_id and user_id=auth.uid() for update;if wallet.character_id is null then raise exception 'wallet not found';end if;
  select * into item from public.content_items where id=target_item_id and active;if item.id is null then raise exception 'item not found';end if;
  if item.rarity='soulbound' or coalesce((item.properties->>'tradeable')::boolean,true)=false then raise exception 'soulbound item';end if;
  select * into deal from public.shop_haggles where character_id=target_character_id and user_id=auth.uid() and content_item_id=target_item_id and discount_percent>0 and consumed_at is null and expires_at>now() order by created_at desc limit 1 for update;
  if deal.id is not null then discount:=deal.discount_percent;end if;
  unit_price:=greatest(1,floor(item.base_value*(100-discount)/100)::integer);total:=unit_price*target_quantity;
  if wallet.balance_copper<total then raise exception 'insufficient funds';end if;
  update public.character_wallets set balance_copper=balance_copper-total,updated_at=now() where character_id=target_character_id returning * into wallet;
  if deal.id is not null then update public.shop_haggles set consumed_at=now() where id=deal.id;end if;
  insert into public.wallet_transactions(character_id,user_id,delta_copper,balance_after,reason) values(target_character_id,auth.uid(),-total,wallet.balance_copper,'ซื้อ '||item.name_th||' x'||target_quantity||case when discount>0 then ' (ต่อรอง -'||discount||'%)' else '' end);
  insert into public.character_item_stacks(character_id,user_id,content_item_id,quantity,acquired_unit_value) values(target_character_id,auth.uid(),target_item_id,target_quantity,unit_price) on conflict on constraint character_item_stacks_character_id_content_item_id_key do update set quantity=public.character_item_stacks.quantity+excluded.quantity,updated_at=now() returning * into stack;
  return jsonb_build_object('balance_copper',wallet.balance_copper,'stack_id',stack.id,'quantity',stack.quantity,'item_id',item.id,'item_name',item.name_th,'total',total,'unit_price',unit_price,'discount_percent',discount);
end;$$;

create or replace function public.sell_shop_item(target_character_id uuid,target_item_id bigint,target_quantity integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare wallet public.character_wallets%rowtype;item public.content_items%rowtype;stack public.character_item_stacks%rowtype;total integer;sell_unit integer;remaining integer;
begin
  if target_quantity<1 or target_quantity>99 then raise exception 'invalid quantity';end if;
  select * into wallet from public.character_wallets where character_id=target_character_id and user_id=auth.uid() for update;if wallet.character_id is null then raise exception 'wallet not found';end if;
  select * into item from public.content_items where id=target_item_id;if item.id is null then raise exception 'item not found';end if;
  if item.rarity='soulbound' or coalesce((item.properties->>'tradeable')::boolean,true)=false then raise exception 'soulbound item';end if;
  select * into stack from public.character_item_stacks where character_id=target_character_id and user_id=auth.uid() and content_item_id=target_item_id for update;
  if stack.id is null or stack.quantity<target_quantity then raise exception 'insufficient items';end if;
  sell_unit:=greatest(1,floor(item.base_value*0.5)::integer);total:=sell_unit*target_quantity;remaining:=stack.quantity-target_quantity;
  if remaining=0 then delete from public.character_item_stacks where id=stack.id;else update public.character_item_stacks set quantity=remaining,updated_at=now() where id=stack.id;end if;
  update public.character_wallets set balance_copper=balance_copper+total,updated_at=now() where character_id=target_character_id returning * into wallet;
  insert into public.wallet_transactions(character_id,user_id,delta_copper,balance_after,reason) values(target_character_id,auth.uid(),total,wallet.balance_copper,'ขาย '||item.name_th||' x'||target_quantity);
  return jsonb_build_object('balance_copper',wallet.balance_copper,'quantity',remaining,'item_id',item.id,'item_name',item.name_th,'total',total);
end;$$;

revoke all on function public.buy_shop_item(uuid,bigint,integer) from public;
revoke all on function public.sell_shop_item(uuid,bigint,integer) from public;
grant execute on function public.buy_shop_item(uuid,bigint,integer) to authenticated;
grant execute on function public.sell_shop_item(uuid,bigint,integer) to authenticated;
