create table public.village_event_templates(
  id bigint generated always as identity primary key,
  slug text not null unique,
  title_th text not null,
  description_th text not null,
  event_type text not null check(event_type in('social','trade','danger','mystery')),
  weight integer not null check(weight between 1 and 100),
  reward_copper integer not null default 0 check(reward_copper between 0 and 500),
  active boolean not null default true
);
create table public.character_village_events(
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id bigint not null references public.world_locations(id),
  template_id bigint not null references public.village_event_templates(id),
  world_day integer not null check(world_day>=1),
  status text not null default 'active' check(status in('active','completed','ignored')),
  chosen_action text check(chosen_action in('participate','ignore')),
  reward_copper integer not null default 0,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(character_id,location_id,world_day)
);
alter table public.village_event_templates enable row level security;
alter table public.character_village_events enable row level security;
create policy "Players can read village events" on public.village_event_templates for select to authenticated using(active);
create policy "Players can read their village event history" on public.character_village_events for select to authenticated using(user_id=auth.uid());

insert into public.village_event_templates(slug,title_th,description_th,event_type,weight,reward_copper)values
('harvest-fair','งานเก็บเกี่ยว','ชาวบ้านชวนช่วยขนฟ่อนข้าวก่อนฝนตก','social',12,20),
('lost-child','เด็กหลงทาง','เสียงร้องไห้ดังมาจากชายป่าหลังหมู่บ้าน','social',10,25),
('broken-well','บ่อน้ำแตก','กลไกบ่อน้ำพังลงและทั้งหมู่บ้านกำลังขาดน้ำ','social',9,30),
('runaway-cart','เกวียนหลุด','เกวียนบรรทุกผักไหลลงเนินตรงมายังตลาด','danger',8,35),
('wolf-tracks','รอยหมาป่า','รอยเท้าสดวนรอบคอกสัตว์ยามเช้า','danger',7,40),
('night-bells','ระฆังกลางคืน','ระฆังโบราณดังขึ้นเองทั้งที่ไม่มีลม','mystery',5,50),
('wandering-peddler','พ่อค้าเร่','พ่อค้าแปลกหน้าวางของจากแดนไกลบนผ้าสีคราม','trade',10,15),
('herb-bloom','สมุนไพรบาน','สมุนไพรหายากผลิดอกพร้อมกันที่ทุ่งท้ายบ้าน','trade',8,20),
('bridge-repair','สะพานชำรุด','แม่น้ำเชี่ยวทำให้สะพานไม้ต้องซ่อมด่วน','social',8,30),
('sick-livestock','ปศุสัตว์ล้มป่วย','สัตว์ในคอกหลายตัวไม่ยอมกินอาหารและมีรอยเรืองแสง','mystery',6,35),
('masked-feast','งานเลี้ยงหน้ากาก','ชาวบ้านทุกคนสวมหน้ากากไม้และไม่บอกเหตุผล','mystery',4,45),
('river-catch','ปลายักษ์ติดแห','ชาวประมงขอคนช่วยลากแหหนักขึ้นจากน้ำ','social',8,25),
('tax-collector','คนเก็บภาษี','ตัวแทนจากเมืองหลวงเข้าตรวจบัญชีหมู่บ้าน','social',6,15),
('strange-seeds','เมล็ดพันธุ์เรืองแสง','ถุงเมล็ดพันธุ์ที่ไม่มีเจ้าของปรากฏกลางตลาด','mystery',5,40),
('duel-challenge','คำท้าประลอง','นักดาบเร่ร้องท้าผู้กล้าต่อหน้าฝูงชน','danger',5,50),
('lantern-procession','ขบวนโคมไฟ','ชาวบ้านจุดโคมเพื่อนำทางวิญญาณบรรพบุรุษ','mystery',4,30);

create or replace function public.get_or_create_village_event(target_character_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;position public.character_world_positions%rowtype;location public.world_locations%rowtype;event public.character_village_events%rowtype;template public.village_event_templates%rowtype;day_number integer;roll integer;total_weight integer;
begin
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception 'character not found';end if;
  select * into position from public.character_world_positions where character_id=target_character_id and user_id=auth.uid();if position.character_id is null then select * into position from public.ensure_character_world_position(target_character_id);end if;
  select * into location from public.world_locations where id=position.location_id;if location.location_type<>'small_town' then return null;end if;
  day_number:=floor((8+position.world_hours_elapsed)/24.0)::integer+1;
  select * into event from public.character_village_events where character_id=target_character_id and location_id=location.id and world_day=day_number;
  if event.id is null then
    select sum(weight) into total_weight from public.village_event_templates where active;roll:=mod((pg_catalog.hashtextextended(target_character_id::text||':'||location.id::text||':'||day_number::text,0)::numeric+9223372036854775808),total_weight)::integer+1;
    select chosen.id,chosen.slug,chosen.title_th,chosen.description_th,chosen.event_type,chosen.weight,chosen.reward_copper,chosen.active into template from(select t.*,sum(t.weight)over(order by t.slug)as cumulative from public.village_event_templates t where t.active)chosen where chosen.cumulative>=roll order by chosen.cumulative limit 1;
    insert into public.character_village_events(character_id,user_id,location_id,template_id,world_day)values(target_character_id,auth.uid(),location.id,template.id,day_number)returning * into event;
  else select * into template from public.village_event_templates where id=event.template_id;end if;
  return jsonb_build_object('id',event.id,'title_th',template.title_th,'description_th',template.description_th,'event_type',template.event_type,'reward_copper',template.reward_copper,'status',event.status,'chosen_action',event.chosen_action,'world_day',event.world_day,'location_id',event.location_id);
end;$$;

create or replace function public.resolve_village_event(target_character_id uuid,target_event_id uuid,target_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare event public.character_village_events%rowtype;template public.village_event_templates%rowtype;wallet public.character_wallets%rowtype;reward integer:=0;
begin
  if target_action not in('participate','ignore')then raise exception 'invalid action';end if;
  select * into event from public.character_village_events where id=target_event_id and character_id=target_character_id and user_id=auth.uid() for update;if event.id is null then raise exception 'event not found';end if;if event.status<>'active' then raise exception 'event resolved';end if;
  select * into template from public.village_event_templates where id=event.template_id;
  if target_action='participate' then reward:=template.reward_copper;update public.character_wallets set balance_copper=balance_copper+reward,updated_at=now() where character_id=target_character_id and user_id=auth.uid() returning * into wallet;insert into public.wallet_transactions(character_id,user_id,delta_copper,balance_after,reason)values(target_character_id,auth.uid(),reward,wallet.balance_copper,'ช่วยเหตุการณ์หมู่บ้าน: '||template.title_th);end if;
  update public.character_village_events set status=case when target_action='participate' then 'completed' else 'ignored' end,chosen_action=target_action,reward_copper=reward,resolved_at=now() where id=event.id returning * into event;
  return jsonb_build_object('id',event.id,'status',event.status,'chosen_action',event.chosen_action,'reward_copper',reward,'wallet_balance',case when target_action='participate' then wallet.balance_copper else null end);
end;$$;
revoke all on function public.get_or_create_village_event(uuid) from public;grant execute on function public.get_or_create_village_event(uuid) to authenticated;
revoke all on function public.resolve_village_event(uuid,uuid,text) from public;grant execute on function public.resolve_village_event(uuid,uuid,text) to authenticated;
