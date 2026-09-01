create or replace function public.create_dice_table(member_name text)
returns table (table_id uuid, table_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  new_code text;
  raw_code text;
  clean_name text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  clean_name := left(trim(member_name), 40);
  if char_length(clean_name) < 1 then raise exception 'display name required'; end if;

  loop
    raw_code := replace(gen_random_uuid()::text, '-', '');
    new_code := upper(substr(raw_code, 1, 4) || '-' || substr(raw_code, 5, 4) || '-' || substr(raw_code, 9, 4));
    begin
      insert into public.dice_tables (code, created_by) values (new_code, auth.uid()) returning id into new_id;
      exit;
    exception when unique_violation then
    end;
  end loop;

  insert into public.dice_table_members (table_id, user_id, display_name)
  values (new_id, auth.uid(), clean_name);
  return query select new_id, new_code;
end;
$$;

revoke all on function public.create_dice_table(text) from public;
grant execute on function public.create_dice_table(text) to authenticated;
