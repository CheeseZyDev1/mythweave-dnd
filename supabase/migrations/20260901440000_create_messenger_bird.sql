insert into public.content_items(slug,name_th,name_en,rarity,category,base_value,weight,tags,properties,active)
values('messenger-raven','นกสารผนึกเวท','Sealed Messenger Raven','common','consumable',35,10,array['travel','party','message'],'{"tradeable":true,"range":"far_city"}',true);

create table public.messenger_dispatches(
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.dice_tables(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  sender_character_id uuid not null references public.characters(id) on delete cascade,
  recipient_character_id uuid not null references public.characters(id) on delete cascade,
  content text not null check(char_length(content) between 1 and 240),
  content_item_id bigint not null references public.content_items(id),
  created_at timestamptz not null default now(),
  check(sender_user_id<>recipient_user_id)
);
create index messenger_dispatches_party_idx on public.messenger_dispatches(table_id,created_at desc);
alter table public.messenger_dispatches enable row level security;
create policy "Participants can read messenger dispatches" on public.messenger_dispatches for select to authenticated using((sender_user_id=auth.uid() or recipient_user_id=auth.uid()) and public.is_dice_table_member(table_id));

create or replace function public.send_messenger_bird(target_table_id uuid,target_sender_character_id uuid,target_recipient_user_id uuid,message_content text)
returns public.messenger_dispatches language plpgsql security definer set search_path='' as $$
declare sender_member public.dice_table_members%rowtype;recipient_member public.dice_table_members%rowtype;sender_position public.character_world_positions%rowtype;recipient_position public.character_world_positions%rowtype;sender_location public.world_locations%rowtype;recipient_location public.world_locations%rowtype;bird public.content_items%rowtype;stack public.character_item_stacks%rowtype;clean_content text;remaining integer;dispatch public.messenger_dispatches%rowtype;
begin
  if not public.is_dice_table_actor(target_table_id) then raise exception 'player required';end if;
  select * into sender_member from public.dice_table_members where table_id=target_table_id and user_id=auth.uid() and character_id=target_sender_character_id;if sender_member.user_id is null then raise exception 'sender character not linked';end if;
  select * into recipient_member from public.dice_table_members where table_id=target_table_id and user_id=target_recipient_user_id and character_id is not null;if recipient_member.user_id is null then raise exception 'recipient not found';end if;
  if recipient_member.user_id=sender_member.user_id then raise exception 'invalid recipient';end if;
  select * into sender_position from public.character_world_positions where character_id=sender_member.character_id;
  select * into recipient_position from public.character_world_positions where character_id=recipient_member.character_id;
  select * into sender_location from public.world_locations where id=sender_position.location_id;
  select * into recipient_location from public.world_locations where id=recipient_position.location_id;
  if sender_position.location_id is null or recipient_position.location_id is null or coalesce(sender_location.parent_id,sender_location.id)=coalesce(recipient_location.parent_id,recipient_location.id) then raise exception 'far city required';end if;
  clean_content:=regexp_replace(trim(coalesce(message_content,'')),'\s+',' ','g');if char_length(clean_content)<1 or char_length(clean_content)>240 then raise exception 'invalid message';end if;
  select * into bird from public.content_items where slug='messenger-raven';
  select * into stack from public.character_item_stacks where character_id=sender_member.character_id and user_id=auth.uid() and content_item_id=bird.id for update;
  if stack.id is null or stack.quantity<1 then raise exception 'messenger bird required';end if;
  remaining:=stack.quantity-1;if remaining=0 then delete from public.character_item_stacks where id=stack.id;else update public.character_item_stacks set quantity=remaining,updated_at=now() where id=stack.id;end if;
  insert into public.messenger_dispatches(table_id,sender_user_id,recipient_user_id,sender_character_id,recipient_character_id,content,content_item_id)
  values(target_table_id,auth.uid(),recipient_member.user_id,sender_member.character_id,recipient_member.character_id,clean_content,bird.id) returning * into dispatch;
  return dispatch;
end;$$;
revoke all on function public.send_messenger_bird(uuid,uuid,uuid,text) from public;
grant execute on function public.send_messenger_bird(uuid,uuid,uuid,text) to authenticated;
alter publication supabase_realtime add table public.messenger_dispatches;
