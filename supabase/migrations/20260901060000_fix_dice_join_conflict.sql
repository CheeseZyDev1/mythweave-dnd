create or replace function public.join_dice_table(invite_code text, member_name text)
returns table (table_id uuid, table_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_id uuid;
  normalized_code text;
  clean_name text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  clean_name := left(trim(member_name), 40);
  if char_length(clean_name) < 1 then raise exception 'display name required'; end if;
  normalized_code := upper(trim(invite_code));

  select dt.id into found_id
  from public.dice_tables as dt
  where dt.code = normalized_code;
  if found_id is null then raise exception 'table not found'; end if;

  insert into public.dice_table_members (table_id, user_id, display_name)
  values (found_id, auth.uid(), clean_name)
  on conflict on constraint dice_table_members_pkey
  do update set display_name = excluded.display_name;
  return query select found_id, normalized_code;
end;
$$;

revoke all on function public.join_dice_table(text, text) from public;
grant execute on function public.join_dice_table(text, text) to authenticated;
