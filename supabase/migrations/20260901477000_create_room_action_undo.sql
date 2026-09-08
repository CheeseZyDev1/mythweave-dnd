create table public.room_action_history(
 id uuid primary key default gen_random_uuid(),table_id uuid not null references public.dice_tables(id)on delete cascade,actor_user_id uuid not null references auth.users(id)on delete cascade,
 action_type text not null check(action_type in('chat','dice','narration','initiative','token_move','fog')),entity_table text not null,entity_key text not null,operation text not null check(operation in('insert','update')),
 description_th text not null,before_state jsonb,after_state jsonb not null,created_at timestamptz not null default now(),undone_at timestamptz,undone_by uuid references auth.users(id)
);
create index room_action_history_room_idx on public.room_action_history(table_id,created_at desc)where undone_at is null;
alter table public.room_action_history enable row level security;
create policy "Room members can read action history"on public.room_action_history for select to authenticated using(public.is_dice_table_member(table_id));

create or replace function public.record_reversible_room_action()returns trigger language plpgsql security definer set search_path=''as $$
declare v_table_id uuid;v_type text;v_key text;v_description text;
begin
 if auth.uid()is null or current_setting('mythweave.undoing',true)='true'then return new;end if;
 v_table_id:=new.table_id;
 if tg_table_name='room_messages'then v_type:='chat';v_key:=new.id::text;v_description:='ส่งข้อความ: '||left(new.content,90);
 elsif tg_table_name='dice_rolls'then v_type:='dice';v_key:=new.id::text;v_description:=new.roller_name||' ทอย d'||new.dice_sides||' ได้ '||new.total;
 elsif tg_table_name='dm_narrations'then v_type:='narration';v_key:=new.id::text;v_description:='คำบรรยาย DM: '||left(new.narration,90);
 elsif tg_table_name='initiative_entries'then v_type:='initiative';v_key:=new.id::text;v_description:='เพิ่ม initiative '||new.name||' ('||new.initiative||')';
 elsif tg_table_name='vtt_tokens'then v_type:='token_move';v_key:=new.id::text;v_description:='ย้ายไอคอน '||new.label;
 elsif tg_table_name='vtt_fog_cells'then v_type:='fog';v_key:=new.cell_x||':'||new.cell_y;v_description:=case when new.revealed then'เปิด'else'ปิด'end||'หมอกช่อง '||new.cell_x||','||new.cell_y;
 else return new;end if;
 insert into public.room_action_history(table_id,actor_user_id,action_type,entity_table,entity_key,operation,description_th,before_state,after_state)
 values(v_table_id,auth.uid(),v_type,tg_table_name,v_key,lower(tg_op),v_description,case when tg_op='UPDATE'then to_jsonb(old)else null end,to_jsonb(new));return new;
end;$$;
create trigger reversible_chat after insert on public.room_messages for each row execute function public.record_reversible_room_action();
create trigger reversible_dice after insert on public.dice_rolls for each row execute function public.record_reversible_room_action();
create trigger reversible_narration after insert on public.dm_narrations for each row execute function public.record_reversible_room_action();
create trigger reversible_initiative after insert on public.initiative_entries for each row execute function public.record_reversible_room_action();
create trigger reversible_token_move after update of x,y on public.vtt_tokens for each row when(old.x is distinct from new.x or old.y is distinct from new.y)execute function public.record_reversible_room_action();
create trigger reversible_fog after insert or update of revealed on public.vtt_fog_cells for each row execute function public.record_reversible_room_action();

create or replace function public.undo_latest_room_action(target_table_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare v_action public.room_action_history%rowtype;v_affected integer;
begin
 if not exists(select 1 from public.dice_table_members where table_id=target_table_id and user_id=auth.uid()and role='dm')then raise exception'dm required';end if;
 select*into v_action from public.room_action_history where table_id=target_table_id and undone_at is null order by created_at desc,id desc limit 1 for update skip locked;
 if v_action.id is null then raise exception'nothing to undo';end if;perform set_config('mythweave.undoing','true',true);
 if v_action.action_type='chat'then delete from public.room_messages where id=v_action.entity_key::uuid and table_id=target_table_id;
 elsif v_action.action_type='dice'then delete from public.dice_rolls where id=v_action.entity_key::uuid and table_id=target_table_id;
 elsif v_action.action_type='narration'then delete from public.dm_narrations where id=v_action.entity_key::uuid and table_id=target_table_id;
 elsif v_action.action_type='initiative'then delete from public.initiative_entries where id=v_action.entity_key::uuid and table_id=target_table_id;
 elsif v_action.action_type='token_move'then update public.vtt_tokens set x=(v_action.before_state->>'x')::numeric,y=(v_action.before_state->>'y')::numeric,updated_at=now()where id=v_action.entity_key::uuid and table_id=target_table_id;
 elsif v_action.action_type='fog'and v_action.operation='insert'then delete from public.vtt_fog_cells where table_id=target_table_id and cell_x=(split_part(v_action.entity_key,':',1))::integer and cell_y=(split_part(v_action.entity_key,':',2))::integer;
 elsif v_action.action_type='fog'then update public.vtt_fog_cells set revealed=(v_action.before_state->>'revealed')::boolean,updated_by=auth.uid(),updated_at=now()where table_id=target_table_id and cell_x=(split_part(v_action.entity_key,':',1))::integer and cell_y=(split_part(v_action.entity_key,':',2))::integer;
 end if;get diagnostics v_affected=row_count;if v_affected<>1 then raise exception'action target unavailable';end if;
 update public.room_action_history set undone_at=now(),undone_by=auth.uid()where id=v_action.id;return jsonb_build_object('action',to_jsonb(v_action),'undone_at',now());
end;$$;
revoke all on function public.record_reversible_room_action()from public;revoke all on function public.undo_latest_room_action(uuid)from public;
grant execute on function public.undo_latest_room_action(uuid)to authenticated;
alter publication supabase_realtime add table public.room_action_history;
