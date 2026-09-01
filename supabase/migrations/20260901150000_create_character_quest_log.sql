create table public.character_quests(
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id bigint not null references public.quest_templates(id),
  title_th text not null,
  description_th text not null,
  quest_type text not null,
  target_count integer not null check(target_count between 1 and 999),
  current_count integer not null default 0 check(current_count>=0),
  reward_gold integer not null default 0 check(reward_gold>=0),
  reward_xp integer not null default 0 check(reward_xp>=0),
  status text not null default 'active' check(status in('active','completed')),
  accepted_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(character_id,template_id)
);
alter table public.character_quests enable row level security;
create policy "Players can view their quest log" on public.character_quests for select to authenticated using(user_id=auth.uid());

create or replace function public.accept_quest_template(target_character_id uuid,target_template_id bigint)
returns public.character_quests language plpgsql security definer set search_path='' as $$
declare character public.characters%rowtype; template public.quest_templates%rowtype; quest public.character_quests%rowtype;
begin
  select * into character from public.characters where id=target_character_id and user_id=auth.uid();if character.id is null then raise exception 'character not found';end if;
  select * into template from public.quest_templates where id=target_template_id and active;if template.id is null then raise exception 'quest not found';end if;
  insert into public.character_quests(character_id,user_id,template_id,title_th,description_th,quest_type,target_count,reward_gold,reward_xp)
  values(target_character_id,auth.uid(),template.id,template.title_th,template.description_th,template.quest_type,(template.objective_template->>'target_count')::integer,(template.reward_template->>'gold')::integer,(template.reward_template->>'xp')::integer)
  returning * into quest;return quest;
exception when unique_violation then raise exception 'quest already accepted';
end;$$;

create or replace function public.advance_character_quest(target_quest_id uuid,progress_amount integer)
returns public.character_quests language plpgsql security definer set search_path='' as $$
declare quest public.character_quests%rowtype;wallet public.character_wallets%rowtype;new_count integer;reward_copper integer;
begin
  if progress_amount<1 or progress_amount>99 then raise exception 'invalid progress';end if;
  select * into quest from public.character_quests where id=target_quest_id and user_id=auth.uid() for update;
  if quest.id is null then raise exception 'quest not found';end if;if quest.status='completed' then raise exception 'quest completed';end if;
  new_count:=least(quest.target_count,quest.current_count+progress_amount);
  if new_count>=quest.target_count then
    update public.character_quests set current_count=new_count,status='completed',completed_at=now() where id=quest.id returning * into quest;
    reward_copper:=quest.reward_gold*100;
    select * into wallet from public.character_wallets where character_id=quest.character_id for update;
    update public.character_wallets set balance_copper=balance_copper+reward_copper,updated_at=now() where character_id=quest.character_id returning * into wallet;
    insert into public.wallet_transactions(character_id,user_id,delta_copper,balance_after,reason)values(quest.character_id,auth.uid(),reward_copper,wallet.balance_copper,'รางวัลภารกิจ: '||quest.title_th);
    update public.characters set experience=experience+quest.reward_xp where id=quest.character_id;
  else update public.character_quests set current_count=new_count where id=quest.id returning * into quest;end if;
  return quest;
end;$$;

revoke all on function public.accept_quest_template(uuid,bigint) from public;revoke all on function public.advance_character_quest(uuid,integer) from public;
grant execute on function public.accept_quest_template(uuid,bigint) to authenticated;grant execute on function public.advance_character_quest(uuid,integer) to authenticated;
