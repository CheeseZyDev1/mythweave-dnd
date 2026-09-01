create table public.character_item_stacks (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content_item_id bigint not null references public.content_items(id),
  quantity integer not null check (quantity between 1 and 9999),
  acquired_unit_value integer not null check (acquired_unit_value >= 0),
  updated_at timestamptz not null default now(),
  unique(character_id,content_item_id)
);

alter table public.character_item_stacks enable row level security;
create policy "Players can view purchased item stacks" on public.character_item_stacks for select to authenticated using(user_id=auth.uid());

create or replace function public.buy_shop_item(target_character_id uuid,target_item_id bigint,target_quantity integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare wallet public.character_wallets%rowtype; item public.content_items%rowtype; total integer; stack public.character_item_stacks%rowtype;
begin
  if target_quantity<1 or target_quantity>99 then raise exception 'invalid quantity'; end if;
  select * into wallet from public.character_wallets where character_id=target_character_id and user_id=auth.uid() for update;
  if wallet.character_id is null then raise exception 'wallet not found'; end if;
  select * into item from public.content_items where id=target_item_id and active;
  if item.id is null then raise exception 'item not found'; end if;
  total:=item.base_value*target_quantity;
  if wallet.balance_copper<total then raise exception 'insufficient funds'; end if;
  update public.character_wallets set balance_copper=balance_copper-total,updated_at=now() where character_id=target_character_id returning * into wallet;
  insert into public.wallet_transactions(character_id,user_id,delta_copper,balance_after,reason)
  values(target_character_id,auth.uid(),-total,wallet.balance_copper,'ซื้อ '||item.name_th||' x'||target_quantity);
  insert into public.character_item_stacks(character_id,user_id,content_item_id,quantity,acquired_unit_value)
  values(target_character_id,auth.uid(),target_item_id,target_quantity,item.base_value)
  on conflict on constraint character_item_stacks_character_id_content_item_id_key do update set quantity=public.character_item_stacks.quantity+excluded.quantity,updated_at=now()
  returning * into stack;
  return jsonb_build_object('balance_copper',wallet.balance_copper,'stack_id',stack.id,'quantity',stack.quantity,'item_id',item.id,'item_name',item.name_th,'total',total);
end;$$;

create or replace function public.sell_shop_item(target_character_id uuid,target_item_id bigint,target_quantity integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare wallet public.character_wallets%rowtype; item public.content_items%rowtype; stack public.character_item_stacks%rowtype; total integer; sell_unit integer; remaining integer;
begin
  if target_quantity<1 or target_quantity>99 then raise exception 'invalid quantity'; end if;
  select * into wallet from public.character_wallets where character_id=target_character_id and user_id=auth.uid() for update;
  if wallet.character_id is null then raise exception 'wallet not found'; end if;
  select * into item from public.content_items where id=target_item_id;
  select * into stack from public.character_item_stacks where character_id=target_character_id and user_id=auth.uid() and content_item_id=target_item_id for update;
  if stack.id is null or stack.quantity<target_quantity then raise exception 'insufficient items'; end if;
  sell_unit:=greatest(1,floor(item.base_value*0.5)::integer);total:=sell_unit*target_quantity;remaining:=stack.quantity-target_quantity;
  if remaining=0 then delete from public.character_item_stacks where id=stack.id;else update public.character_item_stacks set quantity=remaining,updated_at=now() where id=stack.id;end if;
  update public.character_wallets set balance_copper=balance_copper+total,updated_at=now() where character_id=target_character_id returning * into wallet;
  insert into public.wallet_transactions(character_id,user_id,delta_copper,balance_after,reason)
  values(target_character_id,auth.uid(),total,wallet.balance_copper,'ขาย '||item.name_th||' x'||target_quantity);
  return jsonb_build_object('balance_copper',wallet.balance_copper,'quantity',remaining,'item_id',item.id,'item_name',item.name_th,'total',total);
end;$$;

revoke all on function public.buy_shop_item(uuid,bigint,integer) from public;
revoke all on function public.sell_shop_item(uuid,bigint,integer) from public;
grant execute on function public.buy_shop_item(uuid,bigint,integer) to authenticated;
grant execute on function public.sell_shop_item(uuid,bigint,integer) to authenticated;
