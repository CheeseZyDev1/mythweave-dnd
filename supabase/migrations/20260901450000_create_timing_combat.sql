alter table public.generated_monsters add column hp_current integer;
update public.generated_monsters set hp_current=hp_max where hp_current is null;
alter table public.generated_monsters alter column hp_current set not null;
alter table public.generated_monsters add constraint generated_monsters_hp_current_check check(hp_current between 0 and hp_max);

create or replace function public.initialize_generated_monster_hp()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.hp_current is null then new.hp_current:=new.hp_max;end if;
  return new;
end;$$;
create trigger generated_monsters_initialize_hp before insert on public.generated_monsters for each row execute function public.initialize_generated_monster_hp();

create table public.timed_combat_actions(
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.dice_tables(id) on delete cascade,
  monster_id uuid not null references public.generated_monsters(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  actor_name text not null,
  character_name text not null,
  damage_type text not null check(damage_type in('fire','cold','lightning','radiant','bludgeoning','piercing','slashing','poison','psychic')),
  base_damage integer not null check(base_damage between 1 and 999),
  status text not null default'pending' check(status in('pending','resolved')),
  opens_at timestamptz not null,
  target_at timestamptz not null,
  closes_at timestamptz not null,
  resolved_at timestamptz,
  timing_offset_ms integer,
  grade text check(grade in('perfect','good','weak','miss')),
  applied_damage integer check(applied_damage between 0 and 9999),
  weakness_effective boolean,
  monster_hp_before integer,
  monster_hp_after integer,
  created_at timestamptz not null default now(),
  check(opens_at<target_at and target_at<closes_at)
);
create unique index timed_combat_one_pending_actor_idx on public.timed_combat_actions(table_id,actor_user_id) where status='pending';
create index timed_combat_room_history_idx on public.timed_combat_actions(table_id,created_at desc);
alter table public.timed_combat_actions enable row level security;
create policy "Room members can read timed combat" on public.timed_combat_actions for select to authenticated using(public.is_dice_table_member(table_id));

create or replace function public.start_timed_attack(target_monster_id uuid,target_character_id uuid)
returns public.timed_combat_actions language plpgsql security definer set search_path='' as $$
declare v_monster public.generated_monsters%rowtype;v_member public.dice_table_members%rowtype;v_hero public.characters%rowtype;v_action public.timed_combat_actions%rowtype;v_now timestamptz;v_target timestamptz;v_stat integer;v_damage_type text;v_delay_ms integer;
begin
  v_now:=clock_timestamp();
  select * into v_monster from public.generated_monsters where id=target_monster_id;
  if v_monster.id is null then raise exception'monster not found';end if;
  if not public.is_dice_table_actor(v_monster.table_id) then raise exception'player required';end if;
  select * into v_member from public.dice_table_members where table_id=v_monster.table_id and user_id=auth.uid() and character_id=target_character_id;
  if v_member.user_id is null then raise exception'character not linked';end if;
  select * into v_hero from public.characters where id=target_character_id and user_id=auth.uid();
  if v_hero.id is null then raise exception'character not found';end if;
  if v_hero.hp_current<1 then raise exception'character defeated';end if;
  if v_monster.hp_current<1 then raise exception'monster defeated';end if;
  update public.timed_combat_actions set status='resolved',resolved_at=v_now,grade='miss',applied_damage=0,weakness_effective=false,timing_offset_ms=extract(epoch from(v_now-target_at))*1000,monster_hp_before=v_monster.hp_current,monster_hp_after=v_monster.hp_current
    where table_id=v_monster.table_id and actor_user_id=auth.uid() and status='pending' and closes_at<v_now;
  if exists(select 1 from public.timed_combat_actions where table_id=v_monster.table_id and actor_user_id=auth.uid() and status='pending')then raise exception'attack pending';end if;
  v_stat:=case v_hero.character_class when'fighter'then v_hero.strength when'ranger'then v_hero.dexterity when'wizard'then v_hero.intelligence when'cleric'then v_hero.wisdom when'rogue'then v_hero.dexterity when'paladin'then v_hero.charisma when'bard'then v_hero.charisma else v_hero.wisdom end;
  v_damage_type:=case v_hero.character_class when'ranger'then'piercing' when'rogue'then'piercing' when'wizard'then'fire' when'cleric'then'radiant' when'paladin'then'radiant' when'bard'then'psychic' when'druid'then'poison' else'slashing' end;
  v_delay_ms:=1800+floor(random()*1001)::integer;v_target:=v_now+(v_delay_ms||' milliseconds')::interval;
  insert into public.timed_combat_actions(table_id,monster_id,actor_user_id,character_id,actor_name,character_name,damage_type,base_damage,opens_at,target_at,closes_at)
  values(v_monster.table_id,v_monster.id,auth.uid(),v_hero.id,v_member.display_name,v_hero.name,v_damage_type,greatest(2,2+v_hero.level+floor(v_stat/4)::integer),v_target-interval'1200 milliseconds',v_target,v_target+interval'1500 milliseconds') returning * into v_action;
  return v_action;
end;$$;

create or replace function public.resolve_timed_attack(target_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_action public.timed_combat_actions%rowtype;v_monster public.generated_monsters%rowtype;v_weakness public.monster_weakness_templates%rowtype;v_now timestamptz;v_offset integer;v_grade text;v_timing_damage integer;v_applied integer;v_effective boolean;v_hp_before integer;v_hp_after integer;
begin
  v_now:=clock_timestamp();
  select * into v_action from public.timed_combat_actions where id=target_action_id and actor_user_id=auth.uid() for update;
  if v_action.id is null then raise exception'attack not found';end if;
  if not public.is_dice_table_actor(v_action.table_id) then raise exception'player required';end if;
  if v_action.status<>'pending'then raise exception'already resolved';end if;
  if v_now<v_action.opens_at then raise exception'timing not open';end if;
  v_offset:=round(extract(epoch from(v_now-v_action.target_at))*1000)::integer;
  if v_now>v_action.closes_at then v_grade:='miss';
  elsif abs(v_offset)<=180 then v_grade:='perfect';
  elsif abs(v_offset)<=450 then v_grade:='good';
  elsif abs(v_offset)<=900 then v_grade:='weak';
  else v_grade:='miss';end if;
  v_timing_damage:=case v_grade when'perfect'then v_action.base_damage*2 when'good'then floor(v_action.base_damage*1.5)::integer when'weak'then v_action.base_damage else 0 end;
  select * into v_monster from public.generated_monsters where id=v_action.monster_id for update;
  if v_monster.id is null then raise exception'monster not found';end if;
  select template.* into v_weakness from public.generated_monster_weaknesses assigned join public.monster_weakness_templates template on template.id=assigned.template_id where assigned.monster_id=v_monster.id;
  v_effective:=v_timing_damage>0 and v_weakness.damage_type=v_action.damage_type;
  v_applied:=case when v_effective then floor(v_timing_damage*v_weakness.multiplier)::integer else v_timing_damage end;
  v_hp_before:=v_monster.hp_current;v_applied:=least(v_applied,v_hp_before);v_hp_after:=greatest(0,v_hp_before-v_applied);
  update public.generated_monsters set hp_current=v_hp_after where id=v_monster.id;
  update public.timed_combat_actions set status='resolved',resolved_at=v_now,timing_offset_ms=v_offset,grade=v_grade,applied_damage=v_applied,weakness_effective=v_effective,monster_hp_before=v_hp_before,monster_hp_after=v_hp_after where id=v_action.id returning * into v_action;
  return jsonb_build_object('action',to_jsonb(v_action),'monster',jsonb_build_object('id',v_monster.id,'hp_current',v_hp_after,'hp_max',v_monster.hp_max));
end;$$;

revoke all on function public.initialize_generated_monster_hp() from public;
revoke all on function public.start_timed_attack(uuid,uuid) from public;
revoke all on function public.resolve_timed_attack(uuid) from public;
grant execute on function public.start_timed_attack(uuid,uuid) to authenticated;
grant execute on function public.resolve_timed_attack(uuid) to authenticated;
alter publication supabase_realtime add table public.timed_combat_actions;
