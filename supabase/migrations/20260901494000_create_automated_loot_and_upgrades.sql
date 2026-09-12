create table public.character_exploration_loot(
  id uuid primary key default gen_random_uuid(),character_id uuid not null references public.characters(id)on delete cascade,user_id uuid not null references auth.users(id)on delete cascade,location_id bigint not null references public.world_locations(id),content_item_id bigint not null references public.content_items(id),rarity text not null,rolled_value smallint not null,created_at timestamptz not null default now(),unique(character_id,location_id)
);
alter table public.character_exploration_loot enable row level security;
create policy "Players can read their exploration loot"on public.character_exploration_loot for select to authenticated using(user_id=auth.uid());

create or replace function public.roll_exploration_loot(target_character_id uuid,target_location_id bigint)
returns jsonb language plpgsql security definer set search_path=''as $$
declare hero public.characters%rowtype;position public.character_world_positions%rowtype;location public.world_locations%rowtype;item public.content_items%rowtype;entry public.character_exploration_loot%rowtype;rolled integer;rare_rate integer;uncommon_rate integer;chosen_rarity text;
begin
  select*into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception'character not found';end if;
  select*into position from public.character_world_positions where character_id=hero.id;select*into location from public.world_locations where id=target_location_id and active;
  if position.location_id<>location.id then raise exception'location not reached';end if;
  if not exists(select 1 from public.character_world_discoveries where character_id=hero.id and location_id=location.id)then raise exception'discovery required';end if;
  if exists(select 1 from public.character_exploration_loot where character_id=hero.id and location_id=location.id)then return null;end if;
  rare_rate:=least(15,3+location.danger_level);uncommon_rate:=least(35,20+location.danger_level*2);rolled:=floor(random()*100)::integer+1;
  chosen_rarity:=case when rolled<=rare_rate then'rare'when rolled<=rare_rate+uncommon_rate then'uncommon'else'common'end;
  select*into item from public.content_items where rarity=chosen_rarity and active and category<>'treasure'order by random()limit 1;
  if item.id is null then select*into item from public.content_items where rarity='common'and active order by random()limit 1;chosen_rarity:='common';end if;
  insert into public.character_exploration_loot(character_id,user_id,location_id,content_item_id,rarity,rolled_value)values(hero.id,auth.uid(),location.id,item.id,chosen_rarity,rolled)returning*into entry;
  insert into public.character_item_stacks(character_id,user_id,content_item_id,quantity,acquired_unit_value)values(hero.id,auth.uid(),item.id,1,0)on conflict(character_id,content_item_id)do update set quantity=public.character_item_stacks.quantity+1,updated_at=now();
  return jsonb_build_object('id',entry.id,'item_id',item.id,'item_name',item.name_th,'rarity',chosen_rarity,'roll',rolled,'rates',jsonb_build_object('common',100-rare_rate-uncommon_rate,'uncommon',uncommon_rate,'rare',rare_rate));
end;$$;
revoke all on function public.roll_exploration_loot(uuid,bigint)from public;
grant execute on function public.roll_exploration_loot(uuid,bigint)to authenticated;

alter table public.generated_items add column enhancement_level smallint not null default 0 check(enhancement_level between 0 and 5);
alter table public.generated_items add column upgrade_attempts integer not null default 0 check(upgrade_attempts>=0);
create or replace function public.upgrade_generated_item(target_character_id uuid,target_item_id uuid)
returns jsonb language plpgsql security definer set search_path=''as $$
declare hero public.characters%rowtype;item public.generated_items%rowtype;wallet public.character_wallets%rowtype;cost integer;chance integer;rolled integer;succeeded boolean;
begin
  select*into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception'character not found';end if;
  select*into item from public.generated_items where id=target_item_id and character_id=hero.id and user_id=auth.uid()for update;if item.id is null then raise exception'item not found';end if;if item.enhancement_level>=5 then raise exception'max enhancement';end if;
  select*into wallet from public.character_wallets where character_id=hero.id and user_id=auth.uid()for update;
  cost:=(item.enhancement_level+1)*100+item.power_rating*10;chance:=(array[90,75,60,45,30])[item.enhancement_level+1];if wallet.balance_copper<cost then raise exception'insufficient funds';end if;
  update public.character_wallets set balance_copper=balance_copper-cost,updated_at=now()where character_id=hero.id returning*into wallet;rolled:=floor(random()*100)::integer+1;succeeded:=rolled<=chance;
  update public.generated_items set enhancement_level=enhancement_level+case when succeeded then 1 else 0 end,power_rating=least(100,power_rating+case when succeeded then 2+enhancement_level else 0 end),upgrade_attempts=upgrade_attempts+1 where id=item.id returning*into item;
  insert into public.wallet_transactions(character_id,user_id,delta_copper,balance_after,reason)values(hero.id,auth.uid(),-cost,wallet.balance_copper,'ตีบวก '||item.name_th||case when succeeded then' สำเร็จ'else' ล้มเหลว'end);
  return jsonb_build_object('item',to_jsonb(item),'success',succeeded,'roll',rolled,'chance',chance,'cost',cost,'balance_copper',wallet.balance_copper);
end;$$;
revoke all on function public.upgrade_generated_item(uuid,uuid)from public;
grant execute on function public.upgrade_generated_item(uuid,uuid)to authenticated;
