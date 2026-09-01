create table public.character_bestiary_entries(
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  monster_name text not null check(char_length(monster_name)between 1 and 100),
  biome text not null check(biome in('forest','cave','swamp','ruins')),
  signature_trait text not null,
  encounter_count integer not null default 0 check(encounter_count>=0),
  notes text not null default '' check(char_length(notes)<=1000),
  guessed_weakness text check(guessed_weakness in('fire','cold','lightning','radiant','bludgeoning','piercing','slashing','poison','psychic')),
  discovered_weakness text check(discovered_weakness in('fire','cold','lightning','radiant','bludgeoning','piercing','slashing','poison','psychic')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(character_id,monster_name)
);
create table public.bestiary_sightings(
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.character_bestiary_entries(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  monster_id uuid references public.generated_monsters(id) on delete set null,
  observed_at timestamptz not null default now(),
  unique(entry_id,monster_id)
);
alter table public.character_bestiary_entries enable row level security;
alter table public.bestiary_sightings enable row level security;
create policy "Players can read their bestiary" on public.character_bestiary_entries for select to authenticated using(user_id=auth.uid());
create policy "Players can read their bestiary sightings" on public.bestiary_sightings for select to authenticated using(user_id=auth.uid());

create or replace function public.record_bestiary_observation(target_character_id uuid,target_monster_id uuid,target_notes text,target_guessed_weakness text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;monster public.generated_monsters%rowtype;member public.dice_table_members%rowtype;entry public.character_bestiary_entries%rowtype;sighting public.bestiary_sightings%rowtype;weakness public.monster_weakness_templates%rowtype;clean_notes text;trait_name text;
begin
  clean_notes:=trim(coalesce(target_notes,''));if char_length(clean_notes)>1000 then raise exception 'notes too long';end if;
  if target_guessed_weakness is not null and target_guessed_weakness not in('fire','cold','lightning','radiant','bludgeoning','piercing','slashing','poison','psychic')then raise exception 'invalid weakness guess';end if;
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception 'character not found';end if;
  select * into monster from public.generated_monsters where id=target_monster_id;if monster.id is null then raise exception 'monster not found';end if;
  select * into member from public.dice_table_members where table_id=monster.table_id and user_id=auth.uid()and role in('dm','player');if member.user_id is null then raise exception 'player required';end if;
  trait_name:=coalesce(monster.traits->>'signature','สัญชาตญาณดิบ');
  select * into entry from public.character_bestiary_entries where character_id=target_character_id and monster_name=monster.name_th for update;
  if entry.id is null then insert into public.character_bestiary_entries(character_id,user_id,monster_name,biome,signature_trait)values(target_character_id,auth.uid(),monster.name_th,monster.biome,trait_name)returning * into entry;end if;
  insert into public.bestiary_sightings(entry_id,character_id,user_id,monster_id)values(entry.id,target_character_id,auth.uid(),monster.id)on conflict(entry_id,monster_id)do nothing returning * into sighting;
  if sighting.id is not null then entry.encounter_count:=entry.encounter_count+1;end if;
  select template.* into weakness from public.generated_monster_weaknesses assigned join public.monster_weakness_templates template on template.id=assigned.template_id where assigned.monster_id=monster.id;
  update public.character_bestiary_entries set encounter_count=entry.encounter_count,notes=clean_notes,guessed_weakness=target_guessed_weakness,discovered_weakness=case when entry.encounter_count>=2 and target_guessed_weakness=weakness.damage_type then weakness.damage_type else discovered_weakness end,updated_at=now()where id=entry.id returning * into entry;
  return jsonb_build_object('id',entry.id,'monster_name',entry.monster_name,'biome',entry.biome,'signature_trait',entry.signature_trait,'encounter_count',entry.encounter_count,'notes',entry.notes,'guessed_weakness',entry.guessed_weakness,'discovered_weakness',entry.discovered_weakness,'new_sighting',sighting.id is not null,'updated_at',entry.updated_at);
end;$$;
revoke all on function public.record_bestiary_observation(uuid,uuid,text,text) from public;
grant execute on function public.record_bestiary_observation(uuid,uuid,text,text) to authenticated;
