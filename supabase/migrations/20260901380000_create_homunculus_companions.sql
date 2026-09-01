create table public.homunculus_companions(
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null unique references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(char_length(name)between 1 and 40),
  stance text not null default 'waiting' check(stance in('following','guarding','scouting','assisting','waiting')),
  hp_current smallint not null default 12 check(hp_current between 0 and 12),
  hp_max smallint not null default 12 check(hp_max=12),
  active_table_id uuid references public.dice_tables(id) on delete set null,
  last_command_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.homunculus_commands(
  id uuid primary key default gen_random_uuid(),
  companion_id uuid not null references public.homunculus_companions(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  table_id uuid references public.dice_tables(id) on delete set null,
  command text not null check(command in('summon','follow','guard','scout','assist','wait','dismiss')),
  response_th text not null,
  created_at timestamptz not null default now()
);
create index homunculus_commands_companion_idx on public.homunculus_commands(companion_id,created_at desc);
alter table public.homunculus_companions enable row level security;alter table public.homunculus_commands enable row level security;
create policy "Owners and room members can see homunculi" on public.homunculus_companions for select to authenticated using(user_id=auth.uid()or(active_table_id is not null and public.is_dice_table_member(active_table_id)));
create policy "Owners and room members can see homunculus commands" on public.homunculus_commands for select to authenticated using(user_id=auth.uid()or(table_id is not null and public.is_dice_table_member(table_id)));
create or replace function public.create_character_homunculus()returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.homunculus_companions(character_id,user_id,name)values(new.id,new.user_id,'มินิมัส');return new;end;$$;
create trigger characters_create_homunculus after insert on public.characters for each row execute function public.create_character_homunculus();
insert into public.homunculus_companions(character_id,user_id,name)select id,user_id,'มินิมัส'from public.characters on conflict(character_id)do nothing;
create or replace function public.command_homunculus(target_character_id uuid,target_command text,target_table_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare companion public.homunculus_companions%rowtype;member public.dice_table_members%rowtype;result public.homunculus_commands%rowtype;reply text;next_stance text;
begin
  if target_command not in('summon','follow','guard','scout','assist','wait','dismiss')then raise exception 'invalid command';end if;
  select * into companion from public.homunculus_companions where character_id=target_character_id and user_id=auth.uid()for update;if companion.id is null then raise exception 'companion not found';end if;
  if target_command='summon'then
    if target_table_id is null then raise exception 'table required';end if;select * into member from public.dice_table_members where table_id=target_table_id and user_id=auth.uid()and role in('dm','player');if member.user_id is null then raise exception 'player required';end if;
    update public.homunculus_companions set active_table_id=target_table_id,stance='waiting',last_command_at=now(),updated_at=now()where id=companion.id returning * into companion;reply:='มินิมัสปรากฏตัวข้างเจ้านายและรอรับคำสั่ง';
  elsif target_command='dismiss'then update public.homunculus_companions set active_table_id=null,stance='waiting',last_command_at=now(),updated_at=now()where id=companion.id returning * into companion;reply:='มินิมัสกลับสู่ภาชนะโดยไม่ออกนอกคำสั่ง';
  else
    if companion.active_table_id is null then raise exception 'not summoned';end if;
    next_stance:=case target_command when'follow'then'following'when'guard'then'guarding'when'scout'then'scouting'when'assist'then'assisting'else'waiting'end;
    update public.homunculus_companions set stance=next_stance,last_command_at=now(),updated_at=now()where id=companion.id returning * into companion;
    reply:=case target_command when'follow'then'มินิมัสจะตามติดและไม่แยกจากเจ้านาย'when'guard'then'มินิมัสตั้งท่าป้องกัน รอการตัดสินผลโดย DM'when'scout'then'มินิมัสออกสำรวจระยะใกล้ รอ DM รายงานสิ่งที่พบ'when'assist'then'มินิมัสเตรียมช่วยการกระทำถัดไป รอ DM ตัดสินโบนัส'else'มินิมัสหยุดนิ่งและรอคำสั่งใหม่'end;
  end if;
  insert into public.homunculus_commands(companion_id,character_id,user_id,table_id,command,response_th)values(companion.id,companion.character_id,auth.uid(),case when target_command='dismiss'then null else companion.active_table_id end,target_command,reply)returning * into result;
  return jsonb_build_object('companion',to_jsonb(companion),'command',to_jsonb(result));
end;$$;
revoke all on function public.command_homunculus(uuid,text,uuid)from public;grant execute on function public.command_homunculus(uuid,text,uuid)to authenticated;
alter publication supabase_realtime add table public.homunculus_commands;
alter publication supabase_realtime add table public.homunculus_companions;
