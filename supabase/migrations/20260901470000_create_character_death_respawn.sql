create table public.character_life_profiles(
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  life_mode text not null default 'standard' check(life_mode in('standard','permadeath')),
  status text not null default 'alive' check(status in('alive','dead','permanently_dead')),
  death_count integer not null default 0,
  respawn_count integer not null default 0,
  last_cause text,
  last_died_at timestamptz,
  last_respawned_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.character_life_events(
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check(event_type in('defeat','respawn','permadeath')),
  life_mode text not null check(life_mode in('standard','permadeath')),
  cause text,
  location_id bigint references public.world_locations(id),
  hp_after integer not null,
  created_at timestamptz not null default now()
);

alter table public.character_life_profiles enable row level security;
alter table public.character_life_events enable row level security;
create policy "Owners can read character life profiles" on public.character_life_profiles for select to authenticated using(user_id=auth.uid());
create policy "Owners can read character life events" on public.character_life_events for select to authenticated using(user_id=auth.uid());

insert into public.character_life_profiles(character_id,user_id)
select id,user_id from public.characters on conflict(character_id)do nothing;

create or replace function public.initialize_character_life()returns trigger language plpgsql security definer set search_path=''as $$
begin insert into public.character_life_profiles(character_id,user_id)values(new.id,new.user_id)on conflict(character_id)do nothing;return new;end;$$;
create trigger characters_initialize_life after insert on public.characters for each row execute function public.initialize_character_life();

create or replace function public.guard_character_life()returns trigger language plpgsql security definer set search_path=''as $$
declare life_status text;
begin
  if current_setting('mythweave.life_transition',true)='allowed'then return new;end if;
  select status into life_status from public.character_life_profiles where character_id=old.id;
  if life_status='dead'then raise exception'character awaiting respawn';end if;
  if life_status='permanently_dead'then raise exception'character permanently dead';end if;
  return new;
end;$$;
create trigger characters_guard_life before update on public.characters for each row execute function public.guard_character_life();

create or replace function public.guard_dead_character_movement()returns trigger language plpgsql security definer set search_path=''as $$
declare life_status text;
begin
  if current_setting('mythweave.life_transition',true)='allowed'then return new;end if;
  select status into life_status from public.character_life_profiles where character_id=new.character_id;
  if life_status='dead'then raise exception'character awaiting respawn';end if;
  if life_status='permanently_dead'then raise exception'character permanently dead';end if;
  return new;
end;$$;
create trigger character_positions_guard_life before insert or update on public.character_world_positions for each row execute function public.guard_dead_character_movement();

create or replace function public.character_life_status(target_character_id uuid)returns jsonb language plpgsql security definer set search_path=''stable as $$
declare life public.character_life_profiles%rowtype;
begin
  select profile.* into life from public.character_life_profiles profile join public.characters hero on hero.id=profile.character_id where profile.character_id=target_character_id and hero.user_id=auth.uid();
  if life.character_id is null then raise exception'character not found';end if;
  return jsonb_build_object('character_id',life.character_id,'life_mode',life.life_mode,'status',life.status,'death_count',life.death_count,'respawn_count',life.respawn_count,'last_cause',life.last_cause,'last_died_at',life.last_died_at,'last_respawned_at',life.last_respawned_at,'mode_locked',life.death_count>0);
end;$$;

create or replace function public.configure_character_life(target_character_id uuid,target_life_mode text)returns jsonb language plpgsql security definer set search_path=''as $$
declare life public.character_life_profiles%rowtype;
begin
  if target_life_mode not in('standard','permadeath')then raise exception'invalid life mode';end if;
  select profile.* into life from public.character_life_profiles profile join public.characters hero on hero.id=profile.character_id where profile.character_id=target_character_id and hero.user_id=auth.uid()for update of profile;
  if life.character_id is null then raise exception'character not found';end if;
  if life.status<>'alive'or life.death_count>0 then raise exception'life mode locked';end if;
  update public.character_life_profiles set life_mode=target_life_mode,updated_at=now()where character_id=life.character_id returning*into life;
  return jsonb_build_object('character_id',life.character_id,'life_mode',life.life_mode,'status',life.status,'death_count',life.death_count,'respawn_count',life.respawn_count,'mode_locked',false);
end;$$;

create or replace function public.record_character_defeat(target_character_id uuid,target_cause text default'พ่ายแพ้ระหว่างการผจญภัย')returns jsonb language plpgsql security definer set search_path=''as $$
declare hero public.characters%rowtype;life public.character_life_profiles%rowtype;position public.character_world_positions%rowtype;clean_cause text;next_status text;event_type text;
begin
  select*into hero from public.characters where id=target_character_id and user_id=auth.uid()for update;if hero.id is null then raise exception'character not found';end if;
  if exists(select 1 from public.solo_adventures where character_id=hero.id and status='active')then raise exception'use solo life system';end if;
  select*into life from public.character_life_profiles where character_id=hero.id for update;if life.status<>'alive'then raise exception'already dead';end if;
  clean_cause:=left(trim(coalesce(target_cause,'')),120);if clean_cause=''then clean_cause:='พ่ายแพ้ระหว่างการผจญภัย';end if;
  next_status:=case when life.life_mode='permadeath'then'permanently_dead'else'dead'end;event_type:=case when life.life_mode='permadeath'then'permadeath'else'defeat'end;
  select*into position from public.character_world_positions where character_id=hero.id;
  perform set_config('mythweave.life_transition','allowed',true);update public.characters set hp_current=0,updated_at=now()where id=hero.id;
  update public.character_life_profiles set status=next_status,death_count=death_count+1,last_cause=clean_cause,last_died_at=now(),updated_at=now()where character_id=hero.id returning*into life;
  insert into public.character_life_events(character_id,user_id,event_type,life_mode,cause,location_id,hp_after)values(hero.id,auth.uid(),event_type,life.life_mode,clean_cause,position.location_id,0);
  return jsonb_build_object('character_id',hero.id,'life_mode',life.life_mode,'status',life.status,'death_count',life.death_count,'respawn_count',life.respawn_count,'cause',clean_cause,'can_respawn',life.status='dead');
end;$$;

create or replace function public.respawn_character(target_character_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare hero public.characters%rowtype;life public.character_life_profiles%rowtype;destination public.world_locations%rowtype;restored_hp integer;
begin
  select*into hero from public.characters where id=target_character_id and user_id=auth.uid()for update;if hero.id is null then raise exception'character not found';end if;
  select*into life from public.character_life_profiles where character_id=hero.id for update;
  if life.status='permanently_dead'then raise exception'permadeath final';end if;if life.status<>'dead'then raise exception'character not dead';end if;
  select location.* into destination from public.race_lore lore join public.world_locations location on location.id=lore.starting_location_id where lore.race_id=hero.race;
  if destination.id is null then select*into destination from public.world_locations where slug='greenhollow';end if;
  restored_hp:=greatest(1,(hero.hp_max+1)/2);perform set_config('mythweave.life_transition','allowed',true);
  update public.characters set hp_current=restored_hp,updated_at=now()where id=hero.id;
  insert into public.character_world_positions(character_id,user_id,location_id,arrived_at,updated_at)values(hero.id,hero.user_id,destination.id,now(),now())on conflict(character_id)do update set location_id=excluded.location_id,arrived_at=now(),updated_at=now();
  update public.character_life_profiles set status='alive',respawn_count=respawn_count+1,last_respawned_at=now(),updated_at=now()where character_id=hero.id returning*into life;
  insert into public.character_life_events(character_id,user_id,event_type,life_mode,location_id,hp_after)values(hero.id,auth.uid(),'respawn',life.life_mode,destination.id,restored_hp);
  return jsonb_build_object('character_id',hero.id,'life_mode',life.life_mode,'status',life.status,'death_count',life.death_count,'respawn_count',life.respawn_count,'hp_current',restored_hp,'location_id',destination.id,'location_name',destination.name_th,'mode_locked',true);
end;$$;

revoke all on function public.character_life_status(uuid)from public;revoke all on function public.configure_character_life(uuid,text)from public;revoke all on function public.record_character_defeat(uuid,text)from public;revoke all on function public.respawn_character(uuid)from public;
grant execute on function public.character_life_status(uuid)to authenticated;grant execute on function public.configure_character_life(uuid,text)to authenticated;grant execute on function public.record_character_defeat(uuid,text)to authenticated;grant execute on function public.respawn_character(uuid)to authenticated;
