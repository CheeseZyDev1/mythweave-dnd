create or replace function public.is_dice_table_dm(target_table_id uuid)
returns boolean language sql stable security definer set search_path=''as $$
  select exists(select 1 from public.dice_table_members where table_id=target_table_id and user_id=auth.uid()and role='dm');
$$;
revoke all on function public.is_dice_table_dm(uuid)from public;
grant execute on function public.is_dice_table_dm(uuid)to authenticated;

drop policy if exists "Actors can add initiative entries"on public.initiative_entries;
drop policy if exists "Actors can remove initiative entries"on public.initiative_entries;
create policy "DM can add initiative entries"on public.initiative_entries for insert to authenticated with check((select auth.uid())=created_by and public.is_dice_table_dm(table_id));
create policy "DM can remove initiative entries"on public.initiative_entries for delete to authenticated using(public.is_dice_table_dm(table_id));

create or replace function public.dm_advance_initiative(target_table_id uuid)
returns table(current_entry uuid,new_round integer,is_active boolean)
language plpgsql security definer set search_path=''as $$begin
  if not public.is_dice_table_dm(target_table_id)then raise exception'dm required';end if;
  return query select*from public.advance_initiative(target_table_id);
end;$$;
create or replace function public.dm_reset_initiative(target_table_id uuid)
returns void language plpgsql security definer set search_path=''as $$begin
  if not public.is_dice_table_dm(target_table_id)then raise exception'dm required';end if;
  perform public.reset_initiative(target_table_id);
end;$$;
revoke all on function public.advance_initiative(uuid)from authenticated;
revoke all on function public.reset_initiative(uuid)from authenticated;
revoke all on function public.dm_advance_initiative(uuid)from public;
revoke all on function public.dm_reset_initiative(uuid)from public;
grant execute on function public.dm_advance_initiative(uuid)to authenticated;
grant execute on function public.dm_reset_initiative(uuid)to authenticated;
