create table public.npc_schedules(
  id bigint generated always as identity primary key,
  npc_id bigint not null references public.npc_profiles(id) on delete cascade,
  period text not null check(period in('day','night')),
  start_hour smallint not null check(start_hour between 0 and 23),
  end_hour smallint not null check(end_hour between 0 and 23),
  location_th text not null,
  activity_th text not null,
  available_for_interaction boolean not null default true,
  unique(npc_id,period),
  check(start_hour<>end_hour)
);
alter table public.npc_schedules enable row level security;
create policy "Players can read NPC schedules" on public.npc_schedules for select to authenticated using(true);

insert into public.npc_schedules(npc_id,period,start_hour,end_hour,location_th,activity_th,available_for_interaction)
select npc.id,s.period,s.start_hour,s.end_hour,s.location_th,s.activity_th,s.available
from public.npc_profiles npc join(values
('elder-elrin','day',6,20,'ลานต้นไม้ศักดิ์สิทธิ์','ดูแลชาวบ้านและเล่าตำนาน',true),('elder-elrin','night',20,6,'กระท่อมผู้เฒ่า','พักผ่อน',false),
('mira-goldwing','day',8,19,'ตลาดกริฟฟินทอง','เปิดร้านและต่อรองราคา',true),('mira-goldwing','night',19,8,'หลังร้านกริฟฟินทอง','ตรวจบัญชีและพักผ่อน',false),
('captain-vael','day',6,18,'ลานฝึกป้อมอำพัน','ฝึกทหารรักษาการณ์',true),('captain-vael','night',18,6,'กำแพงเมือง','เดินตรวจยามค่ำ',true),
('lyra-moonquill','day',10,22,'หอสมุดแสงจันทร์','วิจัยรอยแยกมิติ',true),('lyra-moonquill','night',22,10,'ห้องพักนักปราชญ์','หลับอยู่ท่ามกลางหนังสือ',false),
('brokk-emberhand','day',7,18,'โรงตีเหล็กเถ้าร้อน','ตีอาวุธและซ่อมเกราะ',true),('brokk-emberhand','night',18,7,'โรงเตี๊ยมท่าตะวัน','ดื่มและพักผ่อน',false),
('nyx-whisper','night',19,5,'ตรอกเงา','ซื้อขายข่าวลับ',true),('nyx-whisper','day',5,19,'ที่ซ่อนลับ','หลบซ่อนและรวบรวมข่าว',false)
)s(slug,period,start_hour,end_hour,location_th,activity_th,available) on s.slug=npc.slug;

create or replace function public.interact_with_npc(target_character_id uuid,target_npc_id bigint,target_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;npc public.npc_profiles%rowtype;affinity public.character_npc_affinity%rowtype;wallet public.character_wallets%rowtype;position public.character_world_positions%rowtype;schedule public.npc_schedules%rowtype;delta integer;cost integer:=0;tier text;current_hour integer;
begin
  if target_action not in('talk','gift','help','insult')then raise exception 'invalid action';end if;
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception 'character not found';end if;
  select * into npc from public.npc_profiles where id=target_npc_id;if npc.id is null then raise exception 'npc not found';end if;
  select * into position from public.character_world_positions where character_id=target_character_id and user_id=auth.uid();current_hour:=mod(8+coalesce(position.world_hours_elapsed,0),24);
  select * into schedule from public.npc_schedules where npc_id=target_npc_id and((start_hour<end_hour and current_hour>=start_hour and current_hour<end_hour)or(start_hour>end_hour and(current_hour>=start_hour or current_hour<end_hour)))limit 1;
  if schedule.id is null or not schedule.available_for_interaction then raise exception 'npc unavailable';end if;
  select * into affinity from public.character_npc_affinity where character_id=target_character_id and npc_id=target_npc_id for update;
  if affinity.id is not null and affinity.last_interaction_at>now()-interval '1 minute' then raise exception 'interaction cooldown';end if;
  delta:=case target_action when 'talk' then 1 when 'gift' then 5 when 'help' then 8 else -10 end;
  if target_action='gift' then cost:=25;select * into wallet from public.character_wallets where character_id=target_character_id and user_id=auth.uid() for update;if wallet.balance_copper<cost then raise exception 'insufficient funds';end if;update public.character_wallets set balance_copper=balance_copper-cost,updated_at=now() where character_id=target_character_id returning * into wallet;insert into public.wallet_transactions(character_id,user_id,delta_copper,balance_after,reason)values(target_character_id,auth.uid(),-cost,wallet.balance_copper,'ของขวัญให้ '||npc.name_th);end if;
  insert into public.character_npc_affinity(character_id,user_id,npc_id,score,interactions,last_interaction_at)values(target_character_id,auth.uid(),target_npc_id,delta,1,now())on conflict on constraint character_npc_affinity_character_id_npc_id_key do update set score=greatest(-100,least(100,public.character_npc_affinity.score+excluded.score)),interactions=public.character_npc_affinity.interactions+1,last_interaction_at=now(),updated_at=now() returning * into affinity;
  insert into public.npc_affinity_events(affinity_id,character_id,user_id,action,score_delta,score_after,cost_copper)values(affinity.id,target_character_id,auth.uid(),target_action,delta,affinity.score,cost);
  tier:=case when affinity.score<=-50 then 'hostile' when affinity.score<0 then 'wary' when affinity.score<20 then 'neutral' when affinity.score<50 then 'friendly' else 'trusted' end;
  return jsonb_build_object('id',affinity.id,'npc_id',npc.id,'npc_name',npc.name_th,'score',affinity.score,'tier',tier,'interactions',affinity.interactions,'delta',delta,'action',target_action,'cost_copper',cost,'wallet_balance',case when target_action='gift' then wallet.balance_copper else null end,'last_interaction_at',affinity.last_interaction_at,'schedule',jsonb_build_object('location_th',schedule.location_th,'activity_th',schedule.activity_th));
end;$$;
