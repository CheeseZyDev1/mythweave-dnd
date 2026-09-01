alter table public.dice_table_members
add column role text not null default 'player'
check (role in ('player', 'dm', 'spectator'));

update public.dice_table_members as member
set role = 'dm'
from public.dice_tables as room
where member.table_id = room.id and member.user_id = room.created_by;

alter table public.dice_table_members alter column role set default 'dm';

drop function public.join_dice_table(text, text);
create function public.join_dice_table(invite_code text, member_name text, requested_role text)
returns table (table_id uuid, table_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_id uuid;
  normalized_code text;
  clean_name text;
  clean_role text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  clean_name := left(trim(member_name), 40);
  if char_length(clean_name) < 1 then raise exception 'display name required'; end if;
  clean_role := lower(trim(requested_role));
  if clean_role not in ('player', 'dm', 'spectator') then raise exception 'invalid role'; end if;
  normalized_code := upper(trim(invite_code));
  select room.id into found_id from public.dice_tables as room where room.code = normalized_code;
  if found_id is null then raise exception 'table not found'; end if;
  insert into public.dice_table_members (table_id, user_id, display_name, role)
  values (found_id, auth.uid(), clean_name, clean_role)
  on conflict on constraint dice_table_members_pkey
  do update set display_name = excluded.display_name, role = excluded.role;
  return query select found_id, normalized_code;
end;
$$;

revoke all on function public.join_dice_table(text, text, text) from public;
grant execute on function public.join_dice_table(text, text, text) to authenticated;
