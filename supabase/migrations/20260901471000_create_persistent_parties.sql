create table public.persistent_parties(
  id uuid primary key default gen_random_uuid(),
  name text not null check(char_length(name)between 2 and 40),
  invite_code text not null unique check(invite_code~'^[A-F0-9]{4}-[A-F0-9]{4}$'),
  dimension_id uuid not null references public.dimension_presets(id),
  owner_user_id uuid not null references auth.users(id)on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.persistent_party_members(
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.persistent_parties(id)on delete cascade,
  user_id uuid not null references auth.users(id)on delete cascade,
  character_id uuid not null references public.characters(id)on delete cascade,
  role text not null check(role in('leader','member')),
  joined_at timestamptz not null default now(),
  unique(party_id,user_id),unique(character_id)
);
alter table public.persistent_parties enable row level security;alter table public.persistent_party_members enable row level security;

create or replace function public.is_persistent_party_member(target_party_id uuid)returns boolean language sql security definer set search_path=''stable as $$select exists(select 1 from public.persistent_party_members where party_id=target_party_id and user_id=auth.uid())$$;
revoke all on function public.is_persistent_party_member(uuid)from public;grant execute on function public.is_persistent_party_member(uuid)to authenticated;
create policy "Members can read persistent party"on public.persistent_parties for select to authenticated using(public.is_persistent_party_member(id));
create policy "Members can read persistent roster"on public.persistent_party_members for select to authenticated using(public.is_persistent_party_member(party_id));

create or replace function public.persistent_party_summary(target_character_id uuid)returns jsonb language plpgsql security definer set search_path=''stable as $$
declare membership public.persistent_party_members%rowtype;party public.persistent_parties%rowtype;roster jsonb;
begin
  if not exists(select 1 from public.characters where id=target_character_id and user_id=auth.uid())then raise exception'character not found';end if;
  select*into membership from public.persistent_party_members where character_id=target_character_id and user_id=auth.uid();
  if membership.id is null then return jsonb_build_object('party',null,'members','[]'::jsonb);end if;
  select*into party from public.persistent_parties where id=membership.party_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',member.id,'user_id',member.user_id,'character_id',member.character_id,'character_name',hero.name,'race',hero.race,'character_class',hero.character_class,'role',member.role,'joined_at',member.joined_at)order by case member.role when'leader'then 0 else 1 end,member.joined_at),'[]'::jsonb)into roster from public.persistent_party_members member join public.characters hero on hero.id=member.character_id where member.party_id=party.id;
  return jsonb_build_object('party',jsonb_build_object('id',party.id,'name',party.name,'invite_code',party.invite_code,'dimension_id',party.dimension_id,'owner_user_id',party.owner_user_id,'created_at',party.created_at,'viewer_role',membership.role),'members',roster);
end;$$;

create or replace function public.create_persistent_party(target_character_id uuid,target_name text)returns jsonb language plpgsql security definer set search_path=''as $$
declare hero public.characters%rowtype;party public.persistent_parties%rowtype;clean_name text;new_code text;
begin
  select*into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception'character not found';end if;
  if exists(select 1 from public.character_life_profiles where character_id=hero.id and status<>'alive')then raise exception'character unavailable';end if;
  if exists(select 1 from public.persistent_party_members where character_id=hero.id)then raise exception'already in party';end if;
  clean_name:=left(trim(coalesce(target_name,'')),40);if char_length(clean_name)<2 then raise exception'invalid party name';end if;
  loop new_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,4)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,4));exit when not exists(select 1 from public.persistent_parties where invite_code=new_code);end loop;
  insert into public.persistent_parties(name,invite_code,dimension_id,owner_user_id)values(clean_name,new_code,hero.dimension_id,auth.uid())returning*into party;
  insert into public.persistent_party_members(party_id,user_id,character_id,role)values(party.id,auth.uid(),hero.id,'leader');
  return public.persistent_party_summary(hero.id);
end;$$;

create or replace function public.join_persistent_party(target_character_id uuid,target_invite_code text)returns jsonb language plpgsql security definer set search_path=''as $$
declare hero public.characters%rowtype;party public.persistent_parties%rowtype;code text;
begin
  select*into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception'character not found';end if;
  if exists(select 1 from public.character_life_profiles where character_id=hero.id and status<>'alive')then raise exception'character unavailable';end if;
  if exists(select 1 from public.persistent_party_members where character_id=hero.id)then raise exception'already in party';end if;
  code:=upper(trim(coalesce(target_invite_code,'')));select*into party from public.persistent_parties where invite_code=code for update;if party.id is null then raise exception'party not found';end if;
  if party.dimension_id<>hero.dimension_id then raise exception'dimension mismatch';end if;
  insert into public.persistent_party_members(party_id,user_id,character_id,role)values(party.id,auth.uid(),hero.id,'member');update public.persistent_parties set updated_at=now()where id=party.id;
  return public.persistent_party_summary(hero.id);
end;$$;

create or replace function public.leave_persistent_party(target_character_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare membership public.persistent_party_members%rowtype;member_count integer;
begin
  select member.*into membership from public.persistent_party_members member join public.characters hero on hero.id=member.character_id where member.character_id=target_character_id and hero.user_id=auth.uid()for update of member;
  if membership.id is null then raise exception'party membership not found';end if;
  select count(*)into member_count from public.persistent_party_members where party_id=membership.party_id;
  if membership.role='leader'and member_count>1 then raise exception'leader has members';end if;
  if membership.role='leader'then delete from public.persistent_parties where id=membership.party_id;else delete from public.persistent_party_members where id=membership.id;update public.persistent_parties set updated_at=now()where id=membership.party_id;end if;
  return jsonb_build_object('party',null,'members','[]'::jsonb,'left',true,'disbanded',membership.role='leader');
end;$$;

revoke all on function public.persistent_party_summary(uuid)from public;revoke all on function public.create_persistent_party(uuid,text)from public;revoke all on function public.join_persistent_party(uuid,text)from public;revoke all on function public.leave_persistent_party(uuid)from public;
grant execute on function public.persistent_party_summary(uuid)to authenticated;grant execute on function public.create_persistent_party(uuid,text)to authenticated;grant execute on function public.join_persistent_party(uuid,text)to authenticated;grant execute on function public.leave_persistent_party(uuid)to authenticated;
alter publication supabase_realtime add table public.persistent_party_members;
