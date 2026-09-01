create table public.room_messages (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.dice_tables(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null check (char_length(sender_name) between 1 and 40),
  sender_role text not null check (sender_role in ('player', 'dm', 'spectator')),
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index room_messages_table_created_idx on public.room_messages(table_id, created_at desc);
alter table public.room_messages enable row level security;

create policy "Room members can read chat"
  on public.room_messages for select to authenticated
  using (public.is_dice_table_member(table_id));

create or replace function public.send_room_message(target_table_id uuid, message_content text)
returns public.room_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  member public.dice_table_members%rowtype;
  clean_content text;
  new_message public.room_messages%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into member from public.dice_table_members
  where table_id = target_table_id and user_id = auth.uid();
  if member.user_id is null then raise exception 'not a member'; end if;

  clean_content := trim(message_content);
  if char_length(clean_content) < 1 or char_length(clean_content) > 500 then raise exception 'invalid message'; end if;
  if exists (
    select 1 from public.room_messages
    where table_id = target_table_id and user_id = auth.uid() and created_at > now() - interval '700 milliseconds'
  ) then raise exception 'rate limited'; end if;

  insert into public.room_messages (table_id, user_id, sender_name, sender_role, content)
  values (target_table_id, auth.uid(), member.display_name, member.role, clean_content)
  returning * into new_message;
  return new_message;
end;
$$;

revoke all on function public.send_room_message(uuid, text) from public;
grant execute on function public.send_room_message(uuid, text) to authenticated;
alter publication supabase_realtime add table public.room_messages;

