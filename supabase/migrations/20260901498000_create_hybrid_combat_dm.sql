create table public.combat_dm_moments(
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.dice_tables(id) on delete cascade,
  action_id uuid not null unique references public.timed_combat_actions(id) on delete cascade,
  monster_id uuid not null references public.generated_monsters(id) on delete cascade,
  trigger_type text not null check(trigger_type in('critical','fumble','defeat','fortune')),
  title_th text not null,
  description_th text not null,
  status text not null default 'pending' check(status in('pending','resolved')),
  resolution text check(resolution in('dice','fortune','twist')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index combat_dm_moments_room_idx on public.combat_dm_moments(table_id,status,created_at desc);
alter table public.combat_dm_moments enable row level security;
create policy "Room members can read combat DM moments" on public.combat_dm_moments for select to authenticated using(public.is_dice_table_member(table_id));

create or replace function public.queue_combat_dm_moment()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_monster public.generated_monsters%rowtype;v_roll bigint;v_create boolean:=false;v_type text;v_title text;v_description text;
begin
  if old.status<>'pending' or new.status<>'resolved'then return new;end if;
  select * into v_monster from public.generated_monsters where id=new.monster_id;
  if v_monster.id is null then return new;end if;
  v_roll:=mod(abs(pg_catalog.hashtext(new.id::text)::bigint),100);
  v_create:=case v_monster.challenge_tier
    when'minion'then v_roll<10
    when'standard'then new.grade in('perfect','miss')or new.monster_hp_after=0 or v_roll<25
    when'elite'then new.grade in('perfect','miss')or new.monster_hp_after=0 or v_roll<50
    when'boss'then true
    else false end;
  if not v_create then return new;end if;
  if new.monster_hp_after=0 then v_type:='defeat';v_title:='จังหวะปิดฉาก';v_description:=new.character_name||' กำลังจะโค่น '||v_monster.name_th||' — DM อาจยืนยันผล ให้โชคช่วย หรือเพิ่มเหตุพลิกผัน';
  elsif new.grade='perfect'then v_type:='critical';v_title:='โชคเข้าข้าง';v_description:=new.character_name||' โจมตีได้สมบูรณ์แบบใส่ '||v_monster.name_th||' — จังหวะนี้อาจมีผลเกินกว่าความเสียหาย';
  elsif new.grade='miss'then v_type:='fumble';v_title:='พลาดแบบไม่คาดคิด';v_description:=new.character_name||' พลาดการโจมตี '||v_monster.name_th||' — DM อาจปล่อยตามผล หรือเปลี่ยนเป็นความซวยที่น่าจดจำ';
  else v_type:='fortune';v_title:='ชะตากำลังขยับ';v_description:='การต่อสู้กับ '||v_monster.name_th||' เปิดช่องให้ DM เพิ่มเหตุการณ์เล็กน้อย';end if;
  insert into public.combat_dm_moments(table_id,action_id,monster_id,trigger_type,title_th,description_th)
  values(new.table_id,new.id,new.monster_id,v_type,v_title,v_description)on conflict(action_id)do nothing;
  return new;
end;$$;
create trigger timed_combat_queue_dm_moment after update on public.timed_combat_actions for each row execute function public.queue_combat_dm_moment();

create or replace function public.resolve_combat_dm_moment(target_moment_id uuid,target_resolution text)
returns public.combat_dm_moments language plpgsql security definer set search_path='' as $$
declare v_moment public.combat_dm_moments%rowtype;v_member public.dice_table_members%rowtype;v_text text;
begin
  if target_resolution not in('dice','fortune','twist')then raise exception'invalid resolution';end if;
  select * into v_moment from public.combat_dm_moments where id=target_moment_id for update;
  if v_moment.id is null then raise exception'moment not found';end if;
  select * into v_member from public.dice_table_members where table_id=v_moment.table_id and user_id=auth.uid()and role='dm';
  if v_member.user_id is null then raise exception'dm required';end if;
  if v_moment.status='resolved'then return v_moment;end if;
  update public.combat_dm_moments set status='resolved',resolution=target_resolution,resolved_by=auth.uid(),resolved_at=now()where id=v_moment.id returning * into v_moment;
  v_text:=case target_resolution when'dice'then'⚔️ DM ยืนยันผลการต่อสู้ตามลูกเต๋า' when'fortune'then'✨ โชคชะตาแทรกแซง เปิดทางรอดหรือโอกาสพิเศษโดยไม่ลบผลเต๋า' else'🎭 ผลเต๋ายังคงเดิม แต่ DM เพิ่มเหตุพลิกผันเล็กน้อยให้ฉาก'end;
  insert into public.dm_narrations(table_id,user_id,dm_name,narration)values(v_moment.table_id,auth.uid(),v_member.display_name,v_text||E'\n'||v_moment.description_th);
  return v_moment;
end;$$;
revoke all on function public.resolve_combat_dm_moment(uuid,text)from public;
grant execute on function public.resolve_combat_dm_moment(uuid,text)to authenticated;
alter publication supabase_realtime add table public.combat_dm_moments;
