create table public.npc_profiles (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name_th text not null,
  name_en text not null,
  role_th text not null,
  location_th text not null,
  description_th text not null
);
alter table public.npc_profiles enable row level security;
create policy "Authenticated players can browse NPC profiles" on public.npc_profiles for select to authenticated using(true);

insert into public.npc_profiles(slug,name_th,name_en,role_th,location_th,description_th) values
('elder-elrin','ผู้เฒ่าเอลริน','Elder Elrin','ผู้นำหมู่บ้าน','กรีนฮอลโลว์','ผู้เฒ่าผู้จดจำเส้นทางเก่าและคำสาบานที่ถูกลืม'),
('mira-goldwing','มิร่า โกลด์วิง','Mira Goldwing','พ่อค้า','ตลาดกริฟฟินทอง','นักต่อรองตาไว ผู้ให้ค่ากับความจริงใจมากกว่าเหรียญ'),
('captain-vael','กัปตันวาเอล','Captain Vael','หัวหน้าทหาร','ป้อมอำพัน','นายทหารเคร่งครัดที่เชื่อในการกระทำมากกว่าคำพูด'),
('lyra-moonquill','ไลรา มูนควิลล์','Lyra Moonquill','นักปราชญ์เวท','หอสมุดแสงจันทร์','นักวิจัยผู้ตามหารอยแยกระหว่างมิติ'),
('brokk-emberhand','บร็อก เอ็มเบอร์แฮนด์','Brokk Emberhand','ช่างตีเหล็ก','โรงตีเหล็กเถ้าร้อน','ช่างฝีมือผู้หยาบคายแต่รักษาสัญญาเสมอ'),
('nyx-whisper','นิกซ์ วิสเปอร์','Nyx Whisper','นายหน้าข่าว','ตรอกเงา','ผู้ซื้อขายความลับและไม่เคยลืมหนี้บุญคุณ');

create table public.character_npc_affinity (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  npc_id bigint not null references public.npc_profiles(id),
  score smallint not null default 0 check(score between -100 and 100),
  interactions integer not null default 0,
  last_interaction_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(character_id,npc_id)
);
create table public.npc_affinity_events (
  id uuid primary key default gen_random_uuid(),
  affinity_id uuid not null references public.character_npc_affinity(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check(action in ('talk','gift','help','insult')),
  score_delta smallint not null,
  score_after smallint not null,
  cost_copper integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.character_npc_affinity enable row level security;
alter table public.npc_affinity_events enable row level security;
create policy "Players can view their NPC affinity" on public.character_npc_affinity for select to authenticated using(user_id=auth.uid());
create policy "Players can view their NPC affinity events" on public.npc_affinity_events for select to authenticated using(user_id=auth.uid());

create or replace function public.interact_with_npc(target_character_id uuid,target_npc_id bigint,target_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  hero public.characters%rowtype;
  npc public.npc_profiles%rowtype;
  affinity public.character_npc_affinity%rowtype;
  wallet public.character_wallets%rowtype;
  delta integer;
  cost integer:=0;
  tier text;
begin
  if target_action not in ('talk','gift','help','insult') then raise exception 'invalid action'; end if;
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();
  if hero.id is null then raise exception 'character not found'; end if;
  select * into npc from public.npc_profiles where id=target_npc_id;
  if npc.id is null then raise exception 'npc not found'; end if;
  select * into affinity from public.character_npc_affinity
  where character_id=target_character_id and npc_id=target_npc_id for update;
  if affinity.id is not null and affinity.last_interaction_at>now()-interval '1 minute' then raise exception 'interaction cooldown'; end if;
  delta:=case target_action when 'talk' then 1 when 'gift' then 5 when 'help' then 8 else -10 end;
  if target_action='gift' then
    cost:=25;
    select * into wallet from public.character_wallets where character_id=target_character_id and user_id=auth.uid() for update;
    if wallet.balance_copper<cost then raise exception 'insufficient funds'; end if;
    update public.character_wallets set balance_copper=balance_copper-cost,updated_at=now() where character_id=target_character_id returning * into wallet;
    insert into public.wallet_transactions(character_id,user_id,delta_copper,balance_after,reason)
    values(target_character_id,auth.uid(),-cost,wallet.balance_copper,'ของขวัญให้ '||npc.name_th);
  end if;
  insert into public.character_npc_affinity(character_id,user_id,npc_id,score,interactions,last_interaction_at)
  values(target_character_id,auth.uid(),target_npc_id,delta,1,now())
  on conflict on constraint character_npc_affinity_character_id_npc_id_key do update
  set score=greatest(-100,least(100,public.character_npc_affinity.score+excluded.score)),
      interactions=public.character_npc_affinity.interactions+1,last_interaction_at=now(),updated_at=now()
  returning * into affinity;
  insert into public.npc_affinity_events(affinity_id,character_id,user_id,action,score_delta,score_after,cost_copper)
  values(affinity.id,target_character_id,auth.uid(),target_action,delta,affinity.score,cost);
  tier:=case when affinity.score<=-50 then 'hostile' when affinity.score<0 then 'wary' when affinity.score<20 then 'neutral' when affinity.score<50 then 'friendly' else 'trusted' end;
  return jsonb_build_object('id',affinity.id,'npc_id',npc.id,'npc_name',npc.name_th,'score',affinity.score,'tier',tier,'interactions',affinity.interactions,'delta',delta,'action',target_action,'cost_copper',cost,'wallet_balance',case when target_action='gift' then wallet.balance_copper else null end,'last_interaction_at',affinity.last_interaction_at);
end;$$;

revoke all on function public.interact_with_npc(uuid,bigint,text) from public;
grant execute on function public.interact_with_npc(uuid,bigint,text) to authenticated;
