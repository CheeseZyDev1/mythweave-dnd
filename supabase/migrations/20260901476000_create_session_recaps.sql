create table public.session_recaps(
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.dice_tables(id) on delete cascade,
  sequence integer not null check(sequence between 1 and 9999),
  generated_by uuid not null references auth.users(id) on delete cascade,
  title text not null check(char_length(title) between 1 and 100),
  summary_th text not null check(char_length(summary_th) between 20 and 5000),
  highlights jsonb not null default '[]'::jsonb check(jsonb_typeof(highlights)='array'),
  metrics jsonb not null default '{}'::jsonb check(jsonb_typeof(metrics)='object'),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(table_id,sequence),
  check(started_at<=ended_at)
);
create index session_recaps_room_idx on public.session_recaps(table_id,sequence desc);
alter table public.session_recaps enable row level security;
create policy "Room members can read session recaps" on public.session_recaps for select to authenticated using(public.is_dice_table_member(table_id));

create or replace function public.store_session_recap(
  target_table_id uuid,target_title text,target_summary text,target_highlights jsonb,target_metrics jsonb,target_started_at timestamptz,target_ended_at timestamptz
) returns public.session_recaps language plpgsql security definer set search_path='' as $$
declare v_recap public.session_recaps%rowtype;v_sequence integer;v_title text;v_summary text;
begin
  if not exists(select 1 from public.dice_table_members where table_id=target_table_id and user_id=auth.uid() and role='dm')then raise exception'dm required';end if;
  if target_started_at is null or target_ended_at is null or target_started_at>target_ended_at then raise exception'invalid time range';end if;
  v_title:=left(trim(target_title),100);v_summary:=left(trim(target_summary),5000);
  if char_length(v_title)<1 or char_length(v_summary)<20 or jsonb_typeof(target_highlights)<>'array' or jsonb_typeof(target_metrics)<>'object' then raise exception'invalid recap';end if;
  perform 1 from public.dice_tables where id=target_table_id for update;
  select coalesce(max(sequence),0)+1 into v_sequence from public.session_recaps where table_id=target_table_id;
  insert into public.session_recaps(table_id,sequence,generated_by,title,summary_th,highlights,metrics,started_at,ended_at)
  values(target_table_id,v_sequence,auth.uid(),v_title,v_summary,target_highlights,target_metrics,target_started_at,target_ended_at)returning*into v_recap;
  return v_recap;
end;$$;
revoke all on function public.store_session_recap(uuid,text,text,jsonb,jsonb,timestamptz,timestamptz)from public;
grant execute on function public.store_session_recap(uuid,text,text,jsonb,jsonb,timestamptz,timestamptz)to authenticated;
alter publication supabase_realtime add table public.session_recaps;
