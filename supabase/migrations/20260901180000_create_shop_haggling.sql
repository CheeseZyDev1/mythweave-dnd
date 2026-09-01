create table public.shop_haggles (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content_item_id bigint not null references public.content_items(id),
  dice_roll smallint not null check (dice_roll between 1 and 20),
  charisma_modifier smallint not null,
  difficulty_class smallint not null,
  discount_percent smallint not null check (discount_percent in (0,10,20)),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index shop_haggles_lookup_idx on public.shop_haggles(character_id,content_item_id,created_at desc);
alter table public.shop_haggles enable row level security;
create policy "Players can view their haggle attempts" on public.shop_haggles for select to authenticated using(user_id=auth.uid());

create or replace function public.haggle_shop_item(target_character_id uuid,target_item_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  hero public.characters%rowtype;
  item public.content_items%rowtype;
  previous public.shop_haggles%rowtype;
  attempt public.shop_haggles%rowtype;
  rolled integer;
  modifier integer;
  dc integer;
  discount integer;
begin
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();
  if hero.id is null then raise exception 'character not found'; end if;
  select * into item from public.content_items where id=target_item_id and active;
  if item.id is null then raise exception 'item not found'; end if;
  select * into previous from public.shop_haggles
  where character_id=target_character_id and content_item_id=target_item_id
    and created_at>now()-interval '5 minutes'
  order by created_at desc limit 1;
  if previous.id is not null then raise exception 'haggle cooldown'; end if;

  rolled:=floor(random()*20)::integer+1;
  modifier:=floor((hero.charisma-10)::numeric/2)::integer;
  dc:=case item.rarity when 'common' then 12 when 'uncommon' then 14 else 16 end;
  discount:=case when rolled=20 or rolled+modifier>=dc+5 then 20 when rolled+modifier>=dc then 10 else 0 end;

  insert into public.shop_haggles(character_id,user_id,content_item_id,dice_roll,charisma_modifier,difficulty_class,discount_percent,expires_at)
  values(target_character_id,auth.uid(),target_item_id,rolled,modifier,dc,discount,now()+interval '5 minutes')
  returning * into attempt;
  return jsonb_build_object(
    'id',attempt.id,'item_id',item.id,'item_name',item.name_th,'dice_roll',rolled,
    'charisma_modifier',modifier,'total',rolled+modifier,'difficulty_class',dc,
    'success',discount>0,'discount_percent',discount,'original_price',item.base_value,
    'offer_price',greatest(1,floor(item.base_value*(100-discount)/100)::integer),
    'expires_at',attempt.expires_at
  );
end;$$;

create or replace function public.buy_shop_item(target_character_id uuid,target_item_id bigint,target_quantity integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  wallet public.character_wallets%rowtype;
  item public.content_items%rowtype;
  deal public.shop_haggles%rowtype;
  total integer;
  unit_price integer;
  discount integer:=0;
  stack public.character_item_stacks%rowtype;
begin
  if target_quantity<1 or target_quantity>99 then raise exception 'invalid quantity'; end if;
  select * into wallet from public.character_wallets where character_id=target_character_id and user_id=auth.uid() for update;
  if wallet.character_id is null then raise exception 'wallet not found'; end if;
  select * into item from public.content_items where id=target_item_id and active;
  if item.id is null then raise exception 'item not found'; end if;
  select * into deal from public.shop_haggles
  where character_id=target_character_id and user_id=auth.uid() and content_item_id=target_item_id
    and discount_percent>0 and consumed_at is null and expires_at>now()
  order by created_at desc limit 1 for update;
  if deal.id is not null then discount:=deal.discount_percent; end if;
  unit_price:=greatest(1,floor(item.base_value*(100-discount)/100)::integer);
  total:=unit_price*target_quantity;
  if wallet.balance_copper<total then raise exception 'insufficient funds'; end if;
  update public.character_wallets set balance_copper=balance_copper-total,updated_at=now() where character_id=target_character_id returning * into wallet;
  if deal.id is not null then update public.shop_haggles set consumed_at=now() where id=deal.id; end if;
  insert into public.wallet_transactions(character_id,user_id,delta_copper,balance_after,reason)
  values(target_character_id,auth.uid(),-total,wallet.balance_copper,'ซื้อ '||item.name_th||' x'||target_quantity||case when discount>0 then ' (ต่อรอง -'||discount||'%)' else '' end);
  insert into public.character_item_stacks(character_id,user_id,content_item_id,quantity,acquired_unit_value)
  values(target_character_id,auth.uid(),target_item_id,target_quantity,unit_price)
  on conflict on constraint character_item_stacks_character_id_content_item_id_key do update
  set quantity=public.character_item_stacks.quantity+excluded.quantity,updated_at=now()
  returning * into stack;
  return jsonb_build_object('balance_copper',wallet.balance_copper,'stack_id',stack.id,'quantity',stack.quantity,'item_id',item.id,'item_name',item.name_th,'total',total,'unit_price',unit_price,'discount_percent',discount);
end;$$;

revoke all on function public.haggle_shop_item(uuid,bigint) from public;
grant execute on function public.haggle_shop_item(uuid,bigint) to authenticated;
