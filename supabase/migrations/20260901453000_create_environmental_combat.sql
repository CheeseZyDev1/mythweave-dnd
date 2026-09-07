create table public.combat_environment_objects(
  id uuid primary key default gen_random_uuid(),table_id uuid not null references public.dice_tables(id) on delete cascade,created_by uuid not null references auth.users(id) on delete cascade,
  object_type text not null check(object_type in('explosive_barrel','falling_pillar','snare_trap')),name_th text not null,damage_type text not null,base_damage integer not null,status text not null default'active' check(status in('active','spent')),
  triggered_by uuid references auth.users(id),triggered_character_id uuid references public.characters(id),target_monster_id uuid references public.generated_monsters(id),applied_damage integer,weakness_effective boolean,effect_th text,created_at timestamptz not null default now(),triggered_at timestamptz
);
create index combat_environment_room_idx on public.combat_environment_objects(table_id,created_at desc);
alter table public.combat_environment_objects enable row level security;
create policy "Room members can read combat environment" on public.combat_environment_objects for select to authenticated using(public.is_dice_table_member(table_id));

create or replace function public.spawn_combat_environment(target_table_id uuid,target_object_type text)
returns public.combat_environment_objects language plpgsql security definer set search_path='' as $$
declare v_member public.dice_table_members%rowtype;v_object public.combat_environment_objects%rowtype;v_name text;v_type text;v_damage integer;
begin
  if target_object_type not in('explosive_barrel','falling_pillar','snare_trap')then raise exception'invalid object';end if;
  select * into v_member from public.dice_table_members where table_id=target_table_id and user_id=auth.uid() and role='dm';if v_member.user_id is null then raise exception'dm required';end if;
  if(select count(*)from public.combat_environment_objects where table_id=target_table_id and status='active')>=6 then raise exception'object limit';end if;
  v_name:=case target_object_type when'explosive_barrel'then'ถังดินเพลิง' when'falling_pillar'then'เสาหินแตกร้าว' else'กับดักโซ่หนาม'end;
  v_type:=case target_object_type when'explosive_barrel'then'fire' when'falling_pillar'then'bludgeoning' else'slashing'end;
  v_damage:=case target_object_type when'explosive_barrel'then 18 when'falling_pillar'then 24 else 10 end;
  insert into public.combat_environment_objects(table_id,created_by,object_type,name_th,damage_type,base_damage)values(target_table_id,auth.uid(),target_object_type,v_name,v_type,v_damage)returning*into v_object;return v_object;
end;$$;

create or replace function public.trigger_combat_environment(target_object_id uuid,target_monster_id uuid,target_character_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_object public.combat_environment_objects%rowtype;v_monster public.generated_monsters%rowtype;v_member public.dice_table_members%rowtype;v_weakness public.monster_weakness_templates%rowtype;v_effective boolean;v_applied integer;v_hp integer;v_effect text;
begin
  select*into v_object from public.combat_environment_objects where id=target_object_id for update;if v_object.id is null then raise exception'object not found';end if;
  if not public.is_dice_table_actor(v_object.table_id)then raise exception'player required';end if;
  select*into v_member from public.dice_table_members where table_id=v_object.table_id and user_id=auth.uid() and character_id=target_character_id;if v_member.user_id is null then raise exception'character not linked';end if;
  if v_object.status<>'active'then raise exception'object spent';end if;
  select*into v_monster from public.generated_monsters where id=target_monster_id and table_id=v_object.table_id for update;if v_monster.id is null then raise exception'monster not found';end if;if v_monster.hp_current<1 then raise exception'monster defeated';end if;
  select template.* into v_weakness from public.generated_monster_weaknesses assigned join public.monster_weakness_templates template on template.id=assigned.template_id where assigned.monster_id=v_monster.id;
  v_effective:=v_weakness.damage_type=v_object.damage_type;v_applied:=case when v_effective then floor(v_object.base_damage*v_weakness.multiplier)::integer else v_object.base_damage end;v_applied:=least(v_applied,v_monster.hp_current);v_hp:=v_monster.hp_current-v_applied;
  v_effect:=case v_object.object_type when'explosive_barrel'then'เปลวไฟกวาดผ่านสนาม' when'falling_pillar'then'เศษหินทำให้เป้าหมายเสียหลัก' else'โซ่หนามตรึงการเคลื่อนไหว'end;
  update public.generated_monsters set hp_current=v_hp where id=v_monster.id;
  update public.combat_environment_objects set status='spent',triggered_by=auth.uid(),triggered_character_id=target_character_id,target_monster_id=v_monster.id,applied_damage=v_applied,weakness_effective=v_effective,effect_th=v_effect,triggered_at=now()where id=v_object.id returning*into v_object;
  return jsonb_build_object('object',to_jsonb(v_object),'monster',jsonb_build_object('id',v_monster.id,'hp_current',v_hp,'hp_max',v_monster.hp_max));
end;$$;
revoke all on function public.spawn_combat_environment(uuid,text)from public;revoke all on function public.trigger_combat_environment(uuid,uuid,uuid)from public;
grant execute on function public.spawn_combat_environment(uuid,text)to authenticated;grant execute on function public.trigger_combat_environment(uuid,uuid,uuid)to authenticated;
alter publication supabase_realtime add table public.combat_environment_objects;
