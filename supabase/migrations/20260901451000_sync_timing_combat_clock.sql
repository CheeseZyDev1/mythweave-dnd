create or replace function public.start_timed_attack_synced(target_monster_id uuid,target_character_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_action public.timed_combat_actions%rowtype;v_server_now timestamptz;
begin
  select * into v_action from public.start_timed_attack(target_monster_id,target_character_id);
  v_server_now:=clock_timestamp();
  return jsonb_build_object('action',to_jsonb(v_action),'server_now',v_server_now);
end;$$;
revoke all on function public.start_timed_attack_synced(uuid,uuid) from public;
grant execute on function public.start_timed_attack_synced(uuid,uuid) to authenticated;
