create table public.bestiary_shares(
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.character_bestiary_entries(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_character_id uuid not null references public.characters(id) on delete cascade,
  share_mode text not null check(share_mode in('party','direct')),
  table_id uuid references public.dice_tables(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  monster_name text not null,
  biome text not null,
  signature_trait text not null,
  encounter_count integer not null,
  notes text not null,
  discovered_weakness text,
  created_at timestamptz not null default now(),
  check((share_mode='party'and table_id is not null and recipient_user_id is null)or(share_mode='direct'and recipient_user_id is not null and table_id is null))
);
create unique index bestiary_party_share_once on public.bestiary_shares(entry_id,table_id)where share_mode='party';
create unique index bestiary_direct_share_once on public.bestiary_shares(entry_id,recipient_user_id)where share_mode='direct';
create table public.bestiary_guild_contributions(
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.character_bestiary_entries(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  guild_id bigint not null references public.guilds(id),
  contribution_mode text not null check(contribution_mode in('sell','donate')),
  payout_copper integer not null default 0,
  affinity_delta smallint not null,
  created_at timestamptz not null default now(),
  unique(entry_id,guild_id)
);
alter table public.bestiary_shares enable row level security;
alter table public.bestiary_guild_contributions enable row level security;
create policy "Players can read relevant bestiary shares" on public.bestiary_shares for select to authenticated using(sender_user_id=auth.uid()or recipient_user_id=auth.uid()or(share_mode='party'and public.is_dice_table_member(table_id)));
create policy "Players can read their guild knowledge contributions" on public.bestiary_guild_contributions for select to authenticated using(user_id=auth.uid());

alter table public.guild_affinity_events drop constraint guild_affinity_events_action_check;
alter table public.guild_affinity_events add constraint guild_affinity_events_action_check check(action in('service','donate_gold','betray','bestiary_sell','bestiary_donate'));

create or replace function public.share_bestiary_entry(target_character_id uuid,target_entry_id uuid,target_mode text,target_table_id uuid default null,target_recipient_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;entry public.character_bestiary_entries%rowtype;member public.dice_table_members%rowtype;recipient_name text;share public.bestiary_shares%rowtype;
begin
  if target_mode not in('party','direct')then raise exception 'invalid share mode';end if;
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception 'character not found';end if;
  select * into entry from public.character_bestiary_entries where id=target_entry_id and character_id=target_character_id and user_id=auth.uid();if entry.id is null then raise exception 'entry not found';end if;
  if target_mode='party' then
    select * into member from public.dice_table_members where table_id=target_table_id and user_id=auth.uid()and role in('dm','player');if member.user_id is null then raise exception 'party required';end if;
    if exists(select 1 from public.bestiary_shares where entry_id=entry.id and table_id=target_table_id and share_mode='party')then raise exception 'already shared';end if;
    insert into public.bestiary_shares(entry_id,sender_user_id,sender_character_id,share_mode,table_id,monster_name,biome,signature_trait,encounter_count,notes,discovered_weakness)
    values(entry.id,auth.uid(),hero.id,'party',target_table_id,entry.monster_name,entry.biome,entry.signature_trait,entry.encounter_count,entry.notes,entry.discovered_weakness)returning * into share;
  else
    if target_recipient_user_id is null or target_recipient_user_id=auth.uid()then raise exception 'invalid recipient';end if;
    select recipient.display_name into recipient_name from public.dice_table_members sender join public.dice_table_members recipient on recipient.table_id=sender.table_id where sender.user_id=auth.uid()and recipient.user_id=target_recipient_user_id limit 1;
    if recipient_name is null then raise exception 'recipient unavailable';end if;
    if exists(select 1 from public.bestiary_shares where entry_id=entry.id and recipient_user_id=target_recipient_user_id and share_mode='direct')then raise exception 'already shared';end if;
    insert into public.bestiary_shares(entry_id,sender_user_id,sender_character_id,share_mode,recipient_user_id,monster_name,biome,signature_trait,encounter_count,notes,discovered_weakness)
    values(entry.id,auth.uid(),hero.id,'direct',target_recipient_user_id,entry.monster_name,entry.biome,entry.signature_trait,entry.encounter_count,entry.notes,entry.discovered_weakness)returning * into share;
  end if;
  return jsonb_build_object('id',share.id,'share_mode',share.share_mode,'monster_name',share.monster_name,'table_id',share.table_id,'recipient_user_id',share.recipient_user_id,'recipient_name',recipient_name,'created_at',share.created_at);
end;$$;

create or replace function public.contribute_bestiary_to_guild(target_character_id uuid,target_entry_id uuid,target_guild_id bigint,target_mode text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;entry public.character_bestiary_entries%rowtype;guild public.guilds%rowtype;affinity public.character_guild_affinity%rowtype;wallet public.character_wallets%rowtype;contribution public.bestiary_guild_contributions%rowtype;delta integer;payout integer;standing text;
begin
  if target_mode not in('sell','donate')then raise exception 'invalid contribution mode';end if;
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception 'character not found';end if;
  select * into entry from public.character_bestiary_entries where id=target_entry_id and character_id=hero.id and user_id=auth.uid();if entry.id is null then raise exception 'entry not found';end if;if entry.discovered_weakness is null then raise exception 'knowledge unconfirmed';end if;
  select * into guild from public.guilds where id=target_guild_id;if guild.id is null then raise exception 'guild not found';end if;
  if exists(select 1 from public.bestiary_guild_contributions where entry_id=entry.id and guild_id=guild.id)then raise exception 'already contributed';end if;
  delta:=case target_mode when 'donate' then 8 else 2 end;payout:=case target_mode when 'sell' then 80+least(entry.encounter_count,10)*10 else 0 end;
  if payout>0 then update public.character_wallets set balance_copper=balance_copper+payout,updated_at=now()where character_id=hero.id and user_id=auth.uid()returning * into wallet;insert into public.wallet_transactions(character_id,user_id,delta_copper,balance_after,reason)values(hero.id,auth.uid(),payout,wallet.balance_copper,'ขายบันทึกอสูรให้ '||guild.name_th);end if;
  insert into public.character_guild_affinity(character_id,user_id,guild_id,score,contributions,last_contribution_at)values(hero.id,auth.uid(),guild.id,delta,1,now())on conflict on constraint character_guild_affinity_character_id_guild_id_key do update set score=greatest(-100,least(100,public.character_guild_affinity.score+excluded.score)),contributions=public.character_guild_affinity.contributions+1,last_contribution_at=now(),updated_at=now()returning * into affinity;
  insert into public.guild_affinity_events(affinity_id,character_id,user_id,action,score_delta,cost_copper)values(affinity.id,hero.id,auth.uid(),case target_mode when 'sell' then 'bestiary_sell' else 'bestiary_donate' end,delta,0);
  insert into public.bestiary_guild_contributions(entry_id,character_id,user_id,guild_id,contribution_mode,payout_copper,affinity_delta)values(entry.id,hero.id,auth.uid(),guild.id,target_mode,payout,delta)returning * into contribution;
  standing:=case when affinity.score<0 then 'cold' when affinity.score<15 then 'unknown' when affinity.score<35 then 'noticed' when affinity.score<65 then 'respected' else 'inner_circle' end;
  return jsonb_build_object('id',contribution.id,'guild_id',guild.id,'guild_name',guild.name_th,'contribution_mode',target_mode,'payout_copper',payout,'affinity_delta',delta,'standing',standing,'wallet_balance',case when payout>0 then wallet.balance_copper else null end);
end;$$;
revoke all on function public.share_bestiary_entry(uuid,uuid,text,uuid,uuid) from public;grant execute on function public.share_bestiary_entry(uuid,uuid,text,uuid,uuid) to authenticated;
revoke all on function public.contribute_bestiary_to_guild(uuid,uuid,bigint,text) from public;grant execute on function public.contribute_bestiary_to_guild(uuid,uuid,bigint,text) to authenticated;
