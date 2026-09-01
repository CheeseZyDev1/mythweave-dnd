create table public.character_wallets (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  balance_copper bigint not null default 1000 check (balance_copper >= 0),
  updated_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta_copper integer not null check (delta_copper between -100000000 and 100000000 and delta_copper <> 0),
  balance_after bigint not null check (balance_after >= 0),
  reason text not null check (char_length(reason) between 1 and 120),
  created_at timestamptz not null default now()
);

create index wallet_transactions_character_idx on public.wallet_transactions(character_id,created_at desc);
alter table public.character_wallets enable row level security;
alter table public.wallet_transactions enable row level security;
create policy "Players can view their wallets" on public.character_wallets for select to authenticated using (user_id=auth.uid());
create policy "Players can view their wallet ledger" on public.wallet_transactions for select to authenticated using (user_id=auth.uid());

create or replace function public.create_character_wallet()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.character_wallets(character_id,user_id) values(new.id,new.user_id);
  insert into public.wallet_transactions(character_id,user_id,delta_copper,balance_after,reason)
  values(new.id,new.user_id,1000,1000,'ทุนเริ่มต้นนักผจญภัย');
  return new;
end;
$$;
create trigger characters_create_wallet after insert on public.characters for each row execute function public.create_character_wallet();

insert into public.character_wallets(character_id,user_id)
select id,user_id from public.characters on conflict(character_id) do nothing;
insert into public.wallet_transactions(character_id,user_id,delta_copper,balance_after,reason)
select wallet.character_id,wallet.user_id,1000,1000,'ทุนเริ่มต้นนักผจญภัย'
from public.character_wallets wallet
where not exists(select 1 from public.wallet_transactions tx where tx.character_id=wallet.character_id);

create or replace function public.adjust_character_wallet(target_character_id uuid, amount_copper integer, transaction_reason text)
returns public.wallet_transactions
language plpgsql security definer set search_path='' as $$
declare
  wallet public.character_wallets%rowtype;
  transaction public.wallet_transactions%rowtype;
  clean_reason text;
begin
  if amount_copper=0 or amount_copper < -100000000 or amount_copper > 100000000 then raise exception 'invalid amount'; end if;
  clean_reason:=left(trim(transaction_reason),120);
  if char_length(clean_reason)<1 then raise exception 'reason required'; end if;
  select * into wallet from public.character_wallets where character_id=target_character_id and user_id=auth.uid() for update;
  if wallet.character_id is null then raise exception 'wallet not found'; end if;
  if wallet.balance_copper+amount_copper<0 then raise exception 'insufficient funds'; end if;
  update public.character_wallets set balance_copper=balance_copper+amount_copper,updated_at=now() where character_id=target_character_id
  returning * into wallet;
  insert into public.wallet_transactions(character_id,user_id,delta_copper,balance_after,reason)
  values(target_character_id,auth.uid(),amount_copper,wallet.balance_copper,clean_reason) returning * into transaction;
  return transaction;
end;
$$;

revoke all on function public.adjust_character_wallet(uuid,integer,text) from public;
grant execute on function public.adjust_character_wallet(uuid,integer,text) to authenticated;

