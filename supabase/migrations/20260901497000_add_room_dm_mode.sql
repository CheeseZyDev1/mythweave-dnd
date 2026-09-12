alter table public.dice_tables add column dm_mode text not null default 'human'
check(dm_mode in('human','subscription','api'));

create or replace function public.create_configured_dimension_dice_table(member_name text,target_character_id uuid,target_dm_mode text)
returns table(table_id uuid,table_code text)
language plpgsql
security definer
set search_path=''
as $$
declare created record;clean_mode text;
begin
  clean_mode:=lower(trim(coalesce(target_dm_mode,'human')));
  if clean_mode not in('human','subscription','api')then raise exception'invalid dm mode';end if;
  select*into created from public.create_dimension_dice_table(member_name,target_character_id);
  update public.dice_tables set dm_mode=clean_mode where id=created.table_id and created_by=(select auth.uid());
  return query select created.table_id,created.table_code;
end;$$;

revoke all on function public.create_configured_dimension_dice_table(text,uuid,text)from public;
grant execute on function public.create_configured_dimension_dice_table(text,uuid,text)to authenticated;

create or replace function public.join_dice_table(invite_code text,member_name text,requested_role text)
returns table(table_id uuid,table_code text)language plpgsql security definer set search_path=''as $$
declare found_id uuid;normalized_code text;clean_name text;clean_role text;active_solo public.solo_adventures%rowtype;
begin
  if auth.uid()is null then raise exception'authentication required';end if;
  clean_name:=left(trim(member_name),40);if char_length(clean_name)<1 then raise exception'display name required';end if;
  clean_role:=lower(trim(requested_role));if clean_role not in('player','spectator')then raise exception'invalid role';end if;
  select*into active_solo from public.solo_adventures where user_id=auth.uid()and status='active';
  if active_solo.id is not null then if not exists(select 1 from public.solo_life_states where character_id=active_solo.character_id and status='dead')then raise exception'solo mode forbids rooms';end if;if clean_role<>'spectator'then raise exception'ghost spectator only';end if;end if;
  normalized_code:=upper(trim(invite_code));select room.id into found_id from public.dice_tables room where room.code=normalized_code;
  if found_id is null then raise exception'table not found';end if;
  insert into public.dice_table_members(table_id,user_id,display_name,role)values(found_id,auth.uid(),clean_name,clean_role)
  on conflict on constraint dice_table_members_pkey do update set display_name=excluded.display_name,role=case when public.dice_table_members.role='dm'then'dm'else excluded.role end;
  return query select found_id,normalized_code;
end;$$;
