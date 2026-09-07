create table public.world_bosses(
  id uuid primary key default gen_random_uuid(),slug text not null unique,name_th text not null,title_th text not null,phase smallint not null default 1 check(phase between 1 and 5),hp_max bigint not null check(hp_max>0),hp_current bigint not null check(hp_current between 0 and hp_max),status text not null default'active'check(status in('active','defeated','ended')),starts_at timestamptz not null default now(),ends_at timestamptz not null,updated_at timestamptz not null default now()
);
create table public.world_boss_contributions(
  id uuid primary key default gen_random_uuid(),boss_id uuid not null references public.world_bosses(id)on delete cascade,table_id uuid not null references public.dice_tables(id)on delete cascade,user_id uuid not null references auth.users(id)on delete cascade,character_id uuid not null references public.characters(id)on delete cascade,character_name text not null,damage integer not null check(damage between 1 and 999),boss_hp_after bigint not null,created_at timestamptz not null default now()
);
create index world_boss_contributions_boss_idx on public.world_boss_contributions(boss_id,created_at desc);create index world_boss_contributions_character_idx on public.world_boss_contributions(boss_id,character_id,created_at desc);
alter table public.world_bosses enable row level security;alter table public.world_boss_contributions enable row level security;
create policy "Authenticated players can view world bosses"on public.world_bosses for select to authenticated using(true);
create policy "Room members can view world boss contributions"on public.world_boss_contributions for select to authenticated using(public.is_dice_table_member(table_id));
insert into public.world_bosses(slug,name_th,title_th,hp_max,hp_current,ends_at)values('astravor-worldroot','แอสตราวอร์','ผู้กลืนรากโลก',50000,50000,now()+interval'365 days');

create or replace function public.strike_world_boss(target_boss_id uuid,target_table_id uuid,target_character_id uuid)
returns jsonb language plpgsql security definer set search_path=''as $$
declare v_boss public.world_bosses%rowtype;v_member public.dice_table_members%rowtype;v_hero public.characters%rowtype;v_contribution public.world_boss_contributions%rowtype;v_stat integer;v_damage integer;v_hp bigint;v_phase smallint;
begin
  if not public.is_dice_table_actor(target_table_id)then raise exception'player required';end if;
  select*into v_member from public.dice_table_members where table_id=target_table_id and user_id=auth.uid()and character_id=target_character_id;if v_member.user_id is null then raise exception'character not linked';end if;
  select*into v_hero from public.characters where id=target_character_id and user_id=auth.uid();if v_hero.id is null then raise exception'character not found';end if;if v_hero.hp_current<1 then raise exception'character defeated';end if;
  select*into v_boss from public.world_bosses where id=target_boss_id for update;if v_boss.id is null then raise exception'boss not found';end if;if v_boss.status<>'active'or v_boss.ends_at<=now()or v_boss.hp_current<1 then raise exception'boss inactive';end if;
  if exists(select 1 from public.world_boss_contributions where boss_id=v_boss.id and character_id=v_hero.id and created_at>now()-interval'8 seconds')then raise exception'strike cooldown';end if;
  v_stat:=case v_hero.character_class when'fighter'then v_hero.strength when'ranger'then v_hero.dexterity when'wizard'then v_hero.intelligence when'cleric'then v_hero.wisdom when'rogue'then v_hero.dexterity when'paladin'then v_hero.charisma when'bard'then v_hero.charisma else v_hero.wisdom end;
  v_damage:=least(999,greatest(4,v_hero.level+floor(v_stat/3)::integer+4+floor(random()*7)::integer));v_damage:=least(v_damage,v_boss.hp_current::integer);v_hp:=v_boss.hp_current-v_damage;v_phase:=case when v_hp=0 then 5 when v_hp<=v_boss.hp_max/4 then 4 when v_hp<=v_boss.hp_max/2 then 3 when v_hp<=v_boss.hp_max*3/4 then 2 else 1 end;
  update public.world_bosses set hp_current=v_hp,phase=v_phase,status=case when v_hp=0 then'defeated'else'active'end,updated_at=now()where id=v_boss.id returning*into v_boss;
  insert into public.world_boss_contributions(boss_id,table_id,user_id,character_id,character_name,damage,boss_hp_after)values(v_boss.id,target_table_id,auth.uid(),v_hero.id,v_hero.name,v_damage,v_hp)returning*into v_contribution;
  return jsonb_build_object('boss',to_jsonb(v_boss),'contribution',to_jsonb(v_contribution));
end;$$;
revoke all on function public.strike_world_boss(uuid,uuid,uuid)from public;grant execute on function public.strike_world_boss(uuid,uuid,uuid)to authenticated;
alter publication supabase_realtime add table public.world_bosses;alter publication supabase_realtime add table public.world_boss_contributions;
