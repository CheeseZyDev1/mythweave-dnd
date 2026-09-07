create or replace function public.is_dice_table_member(target_table_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.dice_table_members member
    where member.table_id=target_table_id and member.user_id=(select auth.uid())
      and(
        not exists(select 1 from public.solo_adventures solo where solo.user_id=(select auth.uid()) and solo.status='active')
        or(
          member.role='spectator'
          and exists(select 1 from public.solo_adventures solo join public.solo_life_states life on life.character_id=solo.character_id where solo.user_id=(select auth.uid()) and solo.status='active' and life.status='dead')
        )
      )
  )
$$;

create or replace function public.is_dice_table_actor(target_table_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.dice_table_members member where member.table_id=target_table_id and member.user_id=(select auth.uid()) and member.role in('player','dm'))
    and not exists(select 1 from public.solo_adventures solo where solo.user_id=(select auth.uid()) and solo.status='active')
$$;

create or replace function public.prevent_solo_room_membership()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.solo_adventures solo where solo.user_id=new.user_id and solo.status='active') then
    if new.role<>'spectator' or not exists(select 1 from public.solo_adventures solo join public.solo_life_states life on life.character_id=solo.character_id where solo.user_id=new.user_id and solo.status='active' and life.status='dead') then
      raise exception 'solo mode forbids rooms';
    end if;
  end if;
  return new;
end;$$;

create or replace function public.join_dice_table(invite_code text,member_name text,requested_role text)
returns table(table_id uuid,table_code text) language plpgsql security definer set search_path='' as $$
declare found_id uuid;normalized_code text;clean_name text;clean_role text;active_solo public.solo_adventures%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required';end if;
  clean_name:=left(trim(member_name),40);if char_length(clean_name)<1 then raise exception 'display name required';end if;
  clean_role:=lower(trim(requested_role));if clean_role not in('player','dm','spectator') then raise exception 'invalid role';end if;
  select * into active_solo from public.solo_adventures where user_id=auth.uid() and status='active';
  if active_solo.id is not null then
    if not exists(select 1 from public.solo_life_states where character_id=active_solo.character_id and status='dead') then raise exception 'solo mode forbids rooms';end if;
    if clean_role<>'spectator' then raise exception 'ghost spectator only';end if;
  end if;
  normalized_code:=upper(trim(invite_code));select room.id into found_id from public.dice_tables room where room.code=normalized_code;
  if found_id is null then raise exception 'table not found';end if;
  insert into public.dice_table_members(table_id,user_id,display_name,role) values(found_id,auth.uid(),clean_name,clean_role)
  on conflict on constraint dice_table_members_pkey do update set display_name=excluded.display_name,role=excluded.role;
  return query select found_id,normalized_code;
end;$$;

create or replace function public.enforce_dice_table_actor()
returns trigger language plpgsql security definer set search_path='' as $$
declare target_id uuid;
begin
  if auth.role()='service_role' then if tg_op='DELETE' then return old;else return new;end if;end if;
  if tg_op='DELETE' then target_id:=old.table_id;else target_id:=new.table_id;end if;
  if not public.is_dice_table_actor(target_id) then raise exception 'spectator read only';end if;
  if tg_op='DELETE' then return old;else return new;end if;
end;$$;

drop policy "Members can create their own dice rolls" on public.dice_rolls;
create policy "Actors can create their own dice rolls" on public.dice_rolls for insert to authenticated with check((select auth.uid())=user_id and public.is_dice_table_actor(table_id));
drop policy "Members can add initiative entries" on public.initiative_entries;
drop policy "Members can remove initiative entries" on public.initiative_entries;
create policy "Actors can add initiative entries" on public.initiative_entries for insert to authenticated with check((select auth.uid())=created_by and public.is_dice_table_actor(table_id));
create policy "Actors can remove initiative entries" on public.initiative_entries for delete to authenticated using(public.is_dice_table_actor(table_id));

create trigger dice_rolls_actor_only before insert on public.dice_rolls for each row execute function public.enforce_dice_table_actor();
create trigger room_messages_actor_only before insert on public.room_messages for each row execute function public.enforce_dice_table_actor();
create trigger npc_dialogue_actor_only before insert on public.npc_dialogue_history for each row execute function public.enforce_dice_table_actor();
create trigger initiative_entries_actor_only before insert or update or delete on public.initiative_entries for each row execute function public.enforce_dice_table_actor();
create trigger initiative_trackers_actor_only before insert or update or delete on public.initiative_trackers for each row execute function public.enforce_dice_table_actor();

revoke all on function public.is_dice_table_actor(uuid) from public;
revoke all on function public.enforce_dice_table_actor() from public;
grant execute on function public.is_dice_table_actor(uuid) to authenticated;
