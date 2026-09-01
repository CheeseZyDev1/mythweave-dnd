create or replace function public.choose_monster_weakness_id(target_name text,target_biome text)
returns bigint language sql stable security definer set search_path='' as $$
  select ranked.id from(
    select template.id,
      sum(template.weight)over(order by template.slug)as cumulative,
      1+mod((pg_catalog.hashtextextended(target_name||':'||target_biome,0)::numeric+9223372036854775808),sum(template.weight)over())as roll
    from public.monster_weakness_templates template where template.biome in('any',target_biome)and template.active
  )ranked where ranked.cumulative>=ranked.roll order by ranked.cumulative limit 1
$$;
revoke all on function public.choose_monster_weakness_id(text,text) from public;

create or replace function public.assign_generated_monster_weakness()
returns trigger language plpgsql security definer set search_path='' as $$
declare chosen_id bigint;
begin
  chosen_id:=public.choose_monster_weakness_id(new.name_th,new.biome);if chosen_id is null then raise exception 'monster weakness pool missing';end if;
  insert into public.generated_monster_weaknesses(monster_id,template_id)values(new.id,chosen_id);return new;
end;$$;

update public.generated_monster_weaknesses assigned set template_id=public.choose_monster_weakness_id(monster.name_th,monster.biome)
from public.generated_monsters monster where monster.id=assigned.monster_id;
