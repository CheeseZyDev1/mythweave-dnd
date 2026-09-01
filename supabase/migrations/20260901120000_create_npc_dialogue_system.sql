create table public.npc_dialogue_history (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.dice_tables(id) on delete cascade,
  triggered_by uuid not null references auth.users(id) on delete cascade,
  npc_name text not null check (char_length(npc_name) between 1 and 40),
  speaker_type text not null,
  context text not null,
  dialogue_id bigint not null references public.dialogue_pool(id),
  text_th text not null,
  created_at timestamptz not null default now()
);

create index npc_dialogue_history_table_idx on public.npc_dialogue_history(table_id, created_at desc);
alter table public.npc_dialogue_history enable row level security;
create policy "Room members can read NPC dialogue"
  on public.npc_dialogue_history for select to authenticated
  using (public.is_dice_table_member(table_id));

create or replace function public.trigger_npc_dialogue(target_table_id uuid, target_npc_name text, target_speaker_type text, target_context text)
returns public.npc_dialogue_history
language plpgsql security definer set search_path = '' as $$
declare
  selected public.dialogue_pool%rowtype;
  history public.npc_dialogue_history%rowtype;
  clean_name text;
begin
  if not public.is_dice_table_member(target_table_id) then raise exception 'not a member'; end if;
  clean_name := left(trim(target_npc_name), 40);
  if char_length(clean_name) < 1 then raise exception 'npc name required'; end if;
  if target_context not in ('greeting','farewell','shop','rumor','quest','weather','danger','tavern') then raise exception 'invalid context'; end if;
  if target_speaker_type not in ('villager','merchant','guard','traveller','innkeeper','scholar','generic') then raise exception 'invalid speaker'; end if;

  select * into selected from public.dialogue_pool
  where active and context = target_context and (speaker_type = target_speaker_type or target_speaker_type = 'generic')
  order by -ln(greatest(random(), 0.000001)) / weight limit 1;
  if selected.id is null then
    select * into selected from public.dialogue_pool where active and context = target_context
    order by -ln(greatest(random(), 0.000001)) / weight limit 1;
  end if;
  if selected.id is null then raise exception 'dialogue unavailable'; end if;

  insert into public.npc_dialogue_history(table_id,triggered_by,npc_name,speaker_type,context,dialogue_id,text_th)
  values(target_table_id,auth.uid(),clean_name,target_speaker_type,target_context,selected.id,selected.text_th)
  returning * into history;
  return history;
end;
$$;

revoke all on function public.trigger_npc_dialogue(uuid,text,text,text) from public;
grant execute on function public.trigger_npc_dialogue(uuid,text,text,text) to authenticated;
alter publication supabase_realtime add table public.npc_dialogue_history;

