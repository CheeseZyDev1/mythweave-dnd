create table public.guilds (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name_th text not null,
  name_en text not null,
  description_th text not null,
  emblem text not null
);
alter table public.guilds enable row level security;
create policy "Authenticated players can browse guilds" on public.guilds for select to authenticated using(true);
insert into public.guilds(slug,name_th,name_en,description_th,emblem) values
('iron-vanguard','แนวหน้าเหล็ก','Iron Vanguard','กิลด์นักรบผู้คุ้มกันเส้นทางและรับมือภัยจากป่า','IV'),
('gilded-scale','ตราชั่งทอง','Gilded Scale','สมาคมพ่อค้าที่เชื่อมตลาดทุกอาณาจักร','GS'),
('astral-archive','หอจดหมายเหตุดารา','Astral Archive','นักเวทและนักปราชญ์ผู้รวบรวมความรู้ต้องห้าม','AA'),
('silent-key','กุญแจเงียบ','Silent Key','เครือข่ายข่าวกรองที่เปิดประตูซึ่งไม่มีใครมองเห็น','SK');

create table public.character_guild_affinity (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  guild_id bigint not null references public.guilds(id),
  score smallint not null default 0 check(score between -100 and 100),
  contributions integer not null default 0,
  last_contribution_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(character_id,guild_id)
);
create table public.guild_affinity_events (
  id uuid primary key default gen_random_uuid(),
  affinity_id uuid not null references public.character_guild_affinity(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check(action in ('service','donate_gold','betray')),
  score_delta smallint not null,
  cost_copper integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.character_guild_affinity enable row level security;
alter table public.guild_affinity_events enable row level security;

create or replace function public.guild_standings(target_character_id uuid)
returns table(guild_id bigint,slug text,name_th text,name_en text,description_th text,emblem text,standing text,contributions integer,last_contribution_at timestamptz)
language plpgsql security definer set search_path='' stable as $$
begin
  if not exists(select 1 from public.characters where id=target_character_id and user_id=auth.uid()) then raise exception 'character not found'; end if;
  return query select guild.id,guild.slug,guild.name_th,guild.name_en,guild.description_th,guild.emblem,
    case when coalesce(affinity.score,0)<0 then 'cold' when coalesce(affinity.score,0)<15 then 'unknown' when affinity.score<35 then 'noticed' when affinity.score<65 then 'respected' else 'inner_circle' end,
    coalesce(affinity.contributions,0),affinity.last_contribution_at
  from public.guilds guild left join public.character_guild_affinity affinity on affinity.guild_id=guild.id and affinity.character_id=target_character_id order by guild.id;
end;$$;

create or replace function public.contribute_to_guild(target_character_id uuid,target_guild_id bigint,target_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype; guild public.guilds%rowtype; affinity public.character_guild_affinity%rowtype; wallet public.character_wallets%rowtype; delta integer; cost integer:=0; standing text;
begin
  if target_action not in ('service','donate_gold','betray') then raise exception 'invalid action'; end if;
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception 'character not found';end if;
  select * into guild from public.guilds where id=target_guild_id;if guild.id is null then raise exception 'guild not found';end if;
  select * into affinity from public.character_guild_affinity where character_id=target_character_id and guild_id=target_guild_id for update;
  if affinity.id is not null and affinity.last_contribution_at>now()-interval '5 minutes' then raise exception 'guild cooldown';end if;
  delta:=case target_action when 'service' then 8 when 'donate_gold' then 5 else -20 end;
  if target_action='donate_gold' then
    cost:=100;select * into wallet from public.character_wallets where character_id=target_character_id and user_id=auth.uid() for update;
    if wallet.balance_copper<cost then raise exception 'insufficient funds';end if;
    update public.character_wallets set balance_copper=balance_copper-cost,updated_at=now() where character_id=target_character_id returning * into wallet;
    insert into public.wallet_transactions(character_id,user_id,delta_copper,balance_after,reason) values(target_character_id,auth.uid(),-cost,wallet.balance_copper,'บริจาคให้ '||guild.name_th);
  end if;
  insert into public.character_guild_affinity(character_id,user_id,guild_id,score,contributions,last_contribution_at)
  values(target_character_id,auth.uid(),target_guild_id,delta,1,now())
  on conflict on constraint character_guild_affinity_character_id_guild_id_key do update set score=greatest(-100,least(100,public.character_guild_affinity.score+excluded.score)),contributions=public.character_guild_affinity.contributions+1,last_contribution_at=now(),updated_at=now()
  returning * into affinity;
  insert into public.guild_affinity_events(affinity_id,character_id,user_id,action,score_delta,cost_copper) values(affinity.id,target_character_id,auth.uid(),target_action,delta,cost);
  standing:=case when affinity.score<0 then 'cold' when affinity.score<15 then 'unknown' when affinity.score<35 then 'noticed' when affinity.score<65 then 'respected' else 'inner_circle' end;
  return jsonb_build_object('guild_id',guild.id,'guild_name',guild.name_th,'standing',standing,'contributions',affinity.contributions,'action',target_action,'cost_copper',cost,'wallet_balance',case when target_action='donate_gold' then wallet.balance_copper else null end,'last_contribution_at',affinity.last_contribution_at);
end;$$;
revoke all on function public.guild_standings(uuid) from public;
revoke all on function public.contribute_to_guild(uuid,bigint,text) from public;
grant execute on function public.guild_standings(uuid) to authenticated;
grant execute on function public.contribute_to_guild(uuid,bigint,text) to authenticated;
