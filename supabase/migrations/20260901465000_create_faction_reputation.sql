create table public.faction_definitions (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name_th text not null,
  name_en text not null,
  description_th text not null,
  emblem text not null,
  color text not null,
  rival_faction_id bigint references public.faction_definitions(id)
);

create table public.faction_reputation_tiers (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name_th text not null,
  minimum_reputation integer not null unique check(minimum_reputation between -1000 and 1000),
  perk_th text not null
);

create table public.character_faction_reputation (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  faction_id bigint not null references public.faction_definitions(id),
  reputation integer not null default 0 check(reputation between -1000 and 1000),
  updated_at timestamptz not null default now(),
  unique(character_id,faction_id)
);

create table public.character_faction_pledges (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  faction_id bigint not null references public.faction_definitions(id),
  pledged_at timestamptz not null default now()
);

create table public.faction_reputation_events (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  faction_id bigint not null references public.faction_definitions(id),
  source_key text not null,
  reason_th text not null,
  reputation_delta integer not null check(reputation_delta between -1000 and 1000 and reputation_delta<>0),
  reputation_after integer not null check(reputation_after between -1000 and 1000),
  created_at timestamptz not null default now(),
  unique(character_id,source_key)
);

alter table public.faction_definitions enable row level security;
alter table public.faction_reputation_tiers enable row level security;
alter table public.character_faction_reputation enable row level security;
alter table public.character_faction_pledges enable row level security;
alter table public.faction_reputation_events enable row level security;

create policy "Authenticated players can browse factions" on public.faction_definitions for select to authenticated using(true);
create policy "Authenticated players can browse faction tiers" on public.faction_reputation_tiers for select to authenticated using(true);
create policy "Owners can read faction reputation" on public.character_faction_reputation for select to authenticated using(user_id=auth.uid());
create policy "Owners can read faction pledge" on public.character_faction_pledges for select to authenticated using(user_id=auth.uid());
create policy "Owners can read faction events" on public.faction_reputation_events for select to authenticated using(user_id=auth.uid());

insert into public.faction_definitions(slug,name_th,name_en,description_th,emblem,color) values
('dawn-concord','ภาคีรุ่งอรุณ','Dawn Concord','ผู้พิทักษ์นครและเส้นทางซึ่งยึดคำสัตย์เหนือผลประโยชน์','DC','#d7ad5c'),
('verdant-wardens','ผู้พิทักษ์พนาลี','Verdant Wardens','เครือข่ายผู้ดูแลป่า สายน้ำ และชุมชนชายแดน','VW','#5f9f72'),
('azure-consortium','สหพันธ์คราม','Azure Consortium','พันธมิตรนักเดินเรือ นักประดิษฐ์ และพ่อค้าผู้เปิดเส้นทางใหม่','AC','#5798bd'),
('umbral-court','ราชสำนักเงา','Umbral Court','ผู้รักษาสมดุลผ่านข่าวกรอง ความลับ และข้อตกลงที่ไม่ถูกจารึก','UC','#9471ae');

update public.faction_definitions set rival_faction_id=(select id from public.faction_definitions where slug='umbral-court') where slug='dawn-concord';
update public.faction_definitions set rival_faction_id=(select id from public.faction_definitions where slug='azure-consortium') where slug='verdant-wardens';
update public.faction_definitions set rival_faction_id=(select id from public.faction_definitions where slug='verdant-wardens') where slug='azure-consortium';
update public.faction_definitions set rival_faction_id=(select id from public.faction_definitions where slug='dawn-concord') where slug='umbral-court';

insert into public.faction_reputation_tiers(slug,name_th,minimum_reputation,perk_th) values
('hostile','ศัตรูประกาศ',-1000,'หน่วยลาดตระเวนของฝ่ายนี้จะเข้าขัดขวาง'),
('wary','ระแวง',-25,'ราคาบริการสูงขึ้นและบทสนทนาบางส่วนถูกปิด'),
('neutral','เป็นกลาง',0,'ใช้บริการพื้นฐานของฝ่ายได้'),
('respected','ได้รับความนับถือ',100,'ปลดล็อกภารกิจฝ่ายและส่วนลดเฉพาะ'),
('honored','ผู้ทรงเกียรติ',250,'เข้าถึงคลังเสบียงและผู้ติดต่อระดับสูง'),
('exalted','ตำนานของฝ่าย',500,'ปลดล็อกรางวัลและบทสรุปเนื้อเรื่องเฉพาะฝ่าย');

create or replace function public.faction_standings(target_character_id uuid)
returns table(faction_id bigint,slug text,name_th text,name_en text,description_th text,emblem text,color text,reputation integer,tier_slug text,tier_name_th text,perk_th text,is_pledged boolean,pledged_at timestamptz)
language plpgsql security definer set search_path='' stable as $$
begin
  if not exists(select 1 from public.characters where id=target_character_id and user_id=auth.uid()) then raise exception 'character not found';end if;
  return query
  select faction.id,faction.slug,faction.name_th,faction.name_en,faction.description_th,faction.emblem,faction.color,
    coalesce(rep.reputation,0),tier.slug,tier.name_th,tier.perk_th,(pledge.faction_id=faction.id),pledge.pledged_at
  from public.faction_definitions faction
  left join public.character_faction_reputation rep on rep.character_id=target_character_id and rep.faction_id=faction.id
  left join public.character_faction_pledges pledge on pledge.character_id=target_character_id
  cross join lateral(
    select t.slug,t.name_th,t.perk_th from public.faction_reputation_tiers t
    where t.minimum_reputation<=coalesce(rep.reputation,0) order by t.minimum_reputation desc limit 1
  )tier
  order by faction.id;
end;$$;

create or replace function public.pledge_to_faction(target_character_id uuid,target_faction_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype; faction public.faction_definitions%rowtype; selected_rep integer; rival_rep integer;
begin
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid() for update;
  if hero.id is null then raise exception 'character not found';end if;
  select * into faction from public.faction_definitions where id=target_faction_id;
  if faction.id is null then raise exception 'faction not found';end if;
  if exists(select 1 from public.character_faction_pledges where character_id=hero.id) then raise exception 'already pledged';end if;

  insert into public.character_faction_pledges(character_id,user_id,faction_id) values(hero.id,auth.uid(),faction.id);
  insert into public.character_faction_reputation(character_id,user_id,faction_id,reputation)
  values(hero.id,auth.uid(),faction.id,100)
  on conflict(character_id,faction_id) do update set reputation=least(1000,public.character_faction_reputation.reputation+100),updated_at=now()
  returning reputation into selected_rep;
  insert into public.faction_reputation_events(character_id,user_id,faction_id,source_key,reason_th,reputation_delta,reputation_after)
  values(hero.id,auth.uid(),faction.id,'pledge:ally','ปฏิญาณตนต่อ '||faction.name_th,100,selected_rep);

  if faction.rival_faction_id is not null then
    insert into public.character_faction_reputation(character_id,user_id,faction_id,reputation)
    values(hero.id,auth.uid(),faction.rival_faction_id,-25)
    on conflict(character_id,faction_id) do update set reputation=greatest(-1000,public.character_faction_reputation.reputation-25),updated_at=now()
    returning reputation into rival_rep;
    insert into public.faction_reputation_events(character_id,user_id,faction_id,source_key,reason_th,reputation_delta,reputation_after)
    values(hero.id,auth.uid(),faction.rival_faction_id,'pledge:rival','ผลจากการเลือกฝ่ายคู่แข่งของ '||faction.name_th,-25,rival_rep);
  end if;
  return jsonb_build_object('faction_id',faction.id,'faction_name',faction.name_th,'reputation',selected_rep,'rival_reputation',rival_rep);
end;$$;

revoke all on function public.faction_standings(uuid) from public;
revoke all on function public.pledge_to_faction(uuid,bigint) from public;
grant execute on function public.faction_standings(uuid) to authenticated;
grant execute on function public.pledge_to_faction(uuid,bigint) to authenticated;
