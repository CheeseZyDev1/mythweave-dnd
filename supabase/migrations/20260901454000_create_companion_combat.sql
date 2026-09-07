alter table public.homunculus_companions add column guard_points smallint not null default 0 check(guard_points between 0 and 12);
create table public.companion_combat_actions(
  id uuid primary key default gen_random_uuid(),table_id uuid not null references public.dice_tables(id)on delete cascade,companion_id uuid not null references public.homunculus_companions(id)on delete cascade,owner_user_id uuid not null references auth.users(id)on delete cascade,character_id uuid not null references public.characters(id)on delete cascade,
  action_type text not null check(action_type in('assist','guard')),round_number integer not null,target_monster_id uuid references public.generated_monsters(id),damage_type text,applied_damage integer not null default 0,guard_points integer not null default 0,effect_th text not null,created_at timestamptz not null default now(),unique(table_id,companion_id,round_number)
);
create index companion_combat_room_idx on public.companion_combat_actions(table_id,created_at desc);
alter table public.companion_combat_actions enable row level security;
create policy "Room members can read companion combat"on public.companion_combat_actions for select to authenticated using(public.is_dice_table_member(table_id));
create or replace function public.command_companion_combat(target_companion_id uuid,target_action text,target_monster_id uuid default null)
returns jsonb language plpgsql security definer set search_path=''as $$
declare v_companion public.homunculus_companions%rowtype;v_member public.dice_table_members%rowtype;v_tracker public.initiative_trackers%rowtype;v_monster public.generated_monsters%rowtype;v_action public.companion_combat_actions%rowtype;v_damage integer;v_hp integer;v_effect text;
begin
  if target_action not in('assist','guard')then raise exception'invalid action';end if;
  select*into v_companion from public.homunculus_companions where id=target_companion_id and user_id=auth.uid()for update;if v_companion.id is null then raise exception'companion not found';end if;if v_companion.active_table_id is null then raise exception'not summoned';end if;
  if not public.is_dice_table_actor(v_companion.active_table_id)then raise exception'player required';end if;select*into v_member from public.dice_table_members where table_id=v_companion.active_table_id and user_id=auth.uid()and character_id=v_companion.character_id;if v_member.user_id is null then raise exception'character not linked';end if;
  select*into v_tracker from public.initiative_trackers where table_id=v_companion.active_table_id and active for update;if v_tracker.table_id is null then raise exception'initiative required';end if;
  if exists(select 1 from public.companion_combat_actions where table_id=v_companion.active_table_id and companion_id=v_companion.id and round_number=v_tracker.round_number)then raise exception'action spent';end if;
  if target_action='assist'then
    select*into v_monster from public.generated_monsters where id=target_monster_id and table_id=v_companion.active_table_id for update;if v_monster.id is null then raise exception'monster not found';end if;if v_monster.hp_current<1 then raise exception'monster defeated';end if;
    v_damage:=least(3+floor(random()*6)::integer,v_monster.hp_current);v_hp:=v_monster.hp_current-v_damage;v_effect:='โฮมุนครุสพุ่งเข้ารบตามคำสั่งของเจ้านาย';update public.generated_monsters set hp_current=v_hp where id=v_monster.id;update public.homunculus_companions set stance='assisting',guard_points=0,updated_at=now()where id=v_companion.id returning*into v_companion;
  else v_damage:=0;v_hp:=null;v_effect:='โฮมุนครุสกางม่านคุ้มกัน 4 แต้มจนถึงคำสั่งรอบถัดไป';update public.homunculus_companions set stance='guarding',guard_points=4,updated_at=now()where id=v_companion.id returning*into v_companion;end if;
  insert into public.companion_combat_actions(table_id,companion_id,owner_user_id,character_id,action_type,round_number,target_monster_id,damage_type,applied_damage,guard_points,effect_th)values(v_companion.active_table_id,v_companion.id,auth.uid(),v_companion.character_id,target_action,v_tracker.round_number,case when target_action='assist'then v_monster.id else null end,case when target_action='assist'then'bludgeoning'else null end,v_damage,v_companion.guard_points,v_effect)returning*into v_action;
  return jsonb_build_object('action',to_jsonb(v_action),'companion',to_jsonb(v_companion),'monster',case when v_monster.id is null then null else jsonb_build_object('id',v_monster.id,'hp_current',v_hp,'hp_max',v_monster.hp_max)end);
end;$$;
revoke all on function public.command_companion_combat(uuid,text,uuid)from public;grant execute on function public.command_companion_combat(uuid,text,uuid)to authenticated;
alter publication supabase_realtime add table public.companion_combat_actions;
