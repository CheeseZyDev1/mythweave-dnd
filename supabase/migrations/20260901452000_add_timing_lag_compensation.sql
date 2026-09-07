create or replace function public.resolve_timed_attack_synced(target_action_id uuid,client_pressed_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_action public.timed_combat_actions%rowtype;v_monster public.generated_monsters%rowtype;v_weakness public.monster_weakness_templates%rowtype;v_now timestamptz;v_offset integer;v_grade text;v_timing_damage integer;v_applied integer;v_effective boolean;v_hp_before integer;v_hp_after integer;
begin
  v_now:=clock_timestamp();
  if client_pressed_at is null or client_pressed_at>v_now+interval'250 milliseconds' or client_pressed_at<v_now-interval'8 seconds'then raise exception'invalid press time';end if;
  select * into v_action from public.timed_combat_actions where id=target_action_id and actor_user_id=auth.uid() for update;
  if v_action.id is null then raise exception'attack not found';end if;
  if not public.is_dice_table_actor(v_action.table_id) then raise exception'player required';end if;
  if v_action.status<>'pending'then raise exception'already resolved';end if;
  v_offset:=round(extract(epoch from(client_pressed_at-v_action.target_at))*1000)::integer;
  if client_pressed_at<v_action.opens_at or client_pressed_at>v_action.closes_at then v_grade:='miss';
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
revoke all on function public.resolve_timed_attack_synced(uuid,timestamptz) from public;
grant execute on function public.resolve_timed_attack_synced(uuid,timestamptz) to authenticated;
