create table public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 24),
  race text not null check (race in ('human', 'elf', 'dwarf', 'half_orc', 'goblin', 'fallen')),
  character_class text not null check (character_class in ('fighter', 'ranger', 'wizard', 'cleric', 'rogue', 'paladin', 'bard', 'druid')),
  level smallint not null default 1 check (level between 1 and 20),
  experience integer not null default 0 check (experience >= 0),
  strength smallint not null check (strength between 8 and 20),
  dexterity smallint not null check (dexterity between 8 and 20),
  constitution smallint not null check (constitution between 8 and 20),
  intelligence smallint not null check (intelligence between 8 and 20),
  wisdom smallint not null check (wisdom between 8 and 20),
  charisma smallint not null check (charisma between 8 and 20),
  hp_current integer not null check (hp_current >= 0),
  hp_max integer not null check (hp_max > 0),
  appearance jsonb not null default '{}'::jsonb,
  portrait_version smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index characters_user_id_idx on public.characters(user_id);

alter table public.characters enable row level security;

create policy "Players can view their own characters"
  on public.characters for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Players can create their own characters"
  on public.characters for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Players can update their own characters"
  on public.characters for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Players can delete their own characters"
  on public.characters for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger characters_set_updated_at
before update on public.characters
for each row execute function public.set_updated_at();
