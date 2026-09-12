alter table public.character_languages
  add column learned_via text not null default 'legacy' check(learned_via in('legacy','formal_training','rune_record')),
  add column source_note text;

create table public.character_rune_records(
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  language_id text not null references public.rune_languages(id),
  discovered_at timestamptz not null default now(),
  studied_at timestamptz,
  primary key(character_id,language_id)
);
alter table public.character_rune_records enable row level security;
create policy "Players can read their rune records" on public.character_rune_records for select to authenticated using(user_id=auth.uid());

create table public.divine_blessing_definitions(
  id text primary key,
  tier smallint not null check(tier between 1 and 3),
  name_th text not null,
  deity_th text not null,
  description_th text not null,
  effect_key text not null,
  effect_value numeric not null default 0,
  color text not null default '#dfbe72'
);
insert into public.divine_blessing_definitions(id,tier,name_th,deity_th,description_th,effect_key,effect_value,color)values
('whispered-tongues',1,'พรแห่งเสียงกระซิบ','อีลารา เทวีแห่งถ้อยคำ','เข้าใจเจตนาของภาษาสามัญที่ไม่คุ้นเคย และได้เปรียบเมื่อค้นคว้าภาษา','language_insight',1,'#77b7a8'),
('small-fortune',1,'เหรียญแห่งโชคเล็กน้อย','เฟย์รา ผู้พลิกเหรียญ','เหตุบังเอิญเล็ก ๆ มักเอนเอียงเข้าข้างผู้ได้รับพร','fortune',1,'#c3a65b'),
('star-guidance',2,'ดวงดาวชี้ทาง','อัสตรา ผู้เฝ้ามองทางไกล','การสำรวจความรู้และร่องรอยลับมีโอกาสพบสิ่งสำคัญมากขึ้น','discovery_luck',10,'#8caed8'),
('fates-favor',2,'ด้ายชะตาสีทอง','มอยรา ผู้ถักชะตา','การเสี่ยงอันตรายครั้งสำคัญมีโอกาสพลิกเป็นผลดี','danger_favor',10,'#d3a866'),
('last-dawn',3,'รุ่งอรุณสุดท้าย','โซลัน เทพแห่งรุ่งอรุณ','เมื่อเผชิญอันตรายถึงชีวิต เทพอาจแทรกแซงให้เหลือ HP 1 โดยไม่ต้องทอยเต๋า','divine_rescue',35,'#f1d98b'),
('guardian-hand',3,'หัตถ์ผู้พิทักษ์','อาร์เดน ผู้เฝ้าประตูชีวิต','กำแพงศักดิ์สิทธิ์อาจหยุดความตายไว้ชั่วขณะโดยไม่ต้องทอยเต๋า','divine_rescue',35,'#e9c47b');
alter table public.divine_blessing_definitions enable row level security;
create policy "Players can read blessing lore" on public.divine_blessing_definitions for select to authenticated using(true);

create table public.character_divine_blessings(
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  blessing_id text not null references public.divine_blessing_definitions(id),
  granted_at timestamptz not null default now(),
  last_triggered_at timestamptz,
  trigger_count integer not null default 0
);
alter table public.character_divine_blessings enable row level security;
create policy "Players can read their divine blessing" on public.character_divine_blessings for select to authenticated using(user_id=auth.uid());

create or replace function public.assign_birth_blessing() returns trigger language plpgsql security definer set search_path='' as $$
declare roll integer; chosen text; chosen_tier smallint;
begin
  roll:=floor(random()*10000)::integer;
  chosen_tier:=case when roll<10 then 3 when roll<100 then 2 when roll<550 then 1 else null end;
  if chosen_tier is not null then
    select id into chosen from public.divine_blessing_definitions where tier=chosen_tier order by random() limit 1;
    insert into public.character_divine_blessings(character_id,user_id,blessing_id) values(new.id,new.user_id,chosen);
  end if;
  return new;
end;$$;
create trigger characters_assign_birth_blessing after insert on public.characters for each row execute function public.assign_birth_blessing();

create or replace function public.configure_character_calling(target_character_id uuid,target_secondary_class text,target_profession_id text)returns public.character_callings language plpgsql security definer set search_path=''as $$
declare hero public.characters%rowtype;calling public.character_callings%rowtype;secondary_skill bigint;v_language text;rune bigint;
begin
 select*into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception'character not found';end if;
 if not exists(select 1 from public.profession_definitions where id=target_profession_id)then raise exception'invalid profession';end if;
 if target_secondary_class is not null and not exists(select 1 from public.multiclass_compatibility where primary_class=hero.character_class and secondary_class=target_secondary_class)then raise exception'incompatible class';end if;
 insert into public.character_callings(character_id,user_id,secondary_class,profession_id)values(hero.id,auth.uid(),target_secondary_class,target_profession_id)returning*into calling;
 if target_secondary_class is not null then select id into secondary_skill from public.skill_definitions where class_id=target_secondary_class and required_level<=hero.level order by md5(hero.id::text||id::text)limit 1;insert into public.character_skills(character_id,user_id,skill_id)values(hero.id,auth.uid(),secondary_skill)on conflict do nothing;end if;
 if target_profession_id='rune_scholar' then
   select id into v_language from public.rune_languages order by md5(hero.id::text||id)limit 1;
   insert into public.character_languages(character_id,user_id,language_id,learned_via,source_note)values(hero.id,auth.uid(),v_language,'formal_training','เรียนจากสำนักอักษรรูนก่อนออกผจญภัย')on conflict do nothing;
   select id into rune from public.rune_definitions where language_id=v_language order by md5(id::text||hero.id::text)limit 1;
   insert into public.character_runes(character_id,user_id,rune_id,quantity)values(hero.id,auth.uid(),rune,1)on conflict do nothing;
 end if;
 return calling;
end;$$;

create or replace function public.search_rune_lore(target_character_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare hero public.characters%rowtype;roll integer;found_language text;found_rune bigint;found_name text;has_guidance boolean;
begin
 select*into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception'character not found';end if;
 if exists(select 1 from public.rune_searches where character_id=hero.id and created_at>now()-interval'6 hours')then raise exception'search cooldown';end if;
 has_guidance:=exists(select 1 from public.character_divine_blessings blessing join public.divine_blessing_definitions definition on definition.id=blessing.blessing_id where blessing.character_id=hero.id and definition.effect_key='discovery_luck');
 roll:=floor(random()*100)::integer;
 if roll<(case when has_guidance then 28 else 18 end) then
   select language.id,language.name_th into found_language,found_name from public.rune_languages language where not exists(select 1 from public.character_languages known where known.character_id=hero.id and known.language_id=language.id)and not exists(select 1 from public.character_rune_records record where record.character_id=hero.id and record.language_id=language.id)order by random()limit 1;
   if found_language is not null then insert into public.character_rune_records(character_id,user_id,language_id)values(hero.id,auth.uid(),found_language);end if;
 end if;
 if found_language is null and roll<(case when has_guidance then 65 else 55 end)then
   select rune.id,rune.name_th into found_rune,found_name from public.rune_definitions rune order by random()limit 1;
   insert into public.character_runes(character_id,user_id,rune_id,quantity)values(hero.id,auth.uid(),found_rune,1)on conflict(character_id,rune_id)do update set quantity=public.character_runes.quantity+1;
 end if;
 insert into public.rune_searches(character_id,user_id,result_type,result_name)values(hero.id,auth.uid(),case when found_language is not null then'record'when found_rune is not null then'rune'else'nothing'end,found_name);
 return jsonb_build_object('type',case when found_language is not null then'record'when found_rune is not null then'rune'else'nothing'end,'name',found_name,'roll',roll);
end;$$;

create or replace function public.study_rune_record(target_character_id uuid,target_language_id text)returns jsonb language plpgsql security definer set search_path=''as $$
declare v_record public.character_rune_records%rowtype;language public.rune_languages%rowtype;
begin
 select*into v_record from public.character_rune_records where character_id=target_character_id and user_id=auth.uid()and language_id=target_language_id for update;
 if v_record.character_id is null then raise exception'record required';end if;
 if v_record.studied_at is not null then raise exception'already studied';end if;
 select*into language from public.rune_languages where id=v_record.language_id;
 insert into public.character_languages(character_id,user_id,language_id,learned_via,source_note)values(target_character_id,auth.uid(),v_record.language_id,'rune_record','ถอดความจากบันทึก '||language.name_th)on conflict do nothing;
 update public.character_rune_records set studied_at=now()where character_id=v_record.character_id and language_id=v_record.language_id;
 return jsonb_build_object('language_id',language.id,'name',language.name_th,'learned_via','rune_record');
end;$$;

alter table public.character_life_events drop constraint character_life_events_event_type_check;
alter table public.character_life_events add constraint character_life_events_event_type_check check(event_type in('defeat','respawn','permadeath','divine_intervention'));

create or replace function public.record_character_defeat(target_character_id uuid,target_cause text default'พ่ายแพ้ระหว่างการผจญภัย')returns jsonb language plpgsql security definer set search_path=''as $$
declare hero public.characters%rowtype;life public.character_life_profiles%rowtype;position public.character_world_positions%rowtype;clean_cause text;next_status text;event_type text;blessing record;rescue_roll integer;divine_message text;
begin
  select*into hero from public.characters where id=target_character_id and user_id=auth.uid()for update;if hero.id is null then raise exception'character not found';end if;
  if exists(select 1 from public.solo_adventures where character_id=hero.id and status='active')then raise exception'use solo life system';end if;
  select*into life from public.character_life_profiles where character_id=hero.id for update;if life.status<>'alive'then raise exception'already dead';end if;
  clean_cause:=left(trim(coalesce(target_cause,'')),120);if clean_cause=''then clean_cause:='พ่ายแพ้ระหว่างการผจญภัย';end if;
  select owned.character_id,owned.blessing_id,owned.last_triggered_at,definition.name_th,definition.deity_th,definition.effect_value into blessing from public.character_divine_blessings owned join public.divine_blessing_definitions definition on definition.id=owned.blessing_id where owned.character_id=hero.id and definition.effect_key='divine_rescue' for update of owned;
  if blessing.character_id is not null and(blessing.last_triggered_at is null or blessing.last_triggered_at<now()-interval'7 days')then
    rescue_roll:=floor(random()*100)::integer+1;
    if rescue_roll<=blessing.effect_value then
      divine_message:='แสงของ '||blessing.deity_th||' ปรากฏขึ้น — '||blessing.name_th||' ปฏิเสธความตายของ '||hero.name||' และเหลือ HP 1';
      update public.characters set hp_current=1,updated_at=now()where id=hero.id;
      update public.character_divine_blessings set last_triggered_at=now(),trigger_count=trigger_count+1 where character_id=hero.id;
      select*into position from public.character_world_positions where character_id=hero.id;
      insert into public.character_life_events(character_id,user_id,event_type,life_mode,cause,location_id,hp_after)values(hero.id,auth.uid(),'divine_intervention',life.life_mode,divine_message,position.location_id,1);
      return jsonb_build_object('character_id',hero.id,'life_mode',life.life_mode,'status','alive','death_count',life.death_count,'respawn_count',life.respawn_count,'cause',clean_cause,'can_respawn',false,'mode_locked',life.death_count>0,'divine_intervention',true,'message',divine_message,'hp_current',1);
    end if;
  end if;
  next_status:=case when life.life_mode='permadeath'then'permanently_dead'else'dead'end;event_type:=case when life.life_mode='permadeath'then'permadeath'else'defeat'end;
  select*into position from public.character_world_positions where character_id=hero.id;
  perform set_config('mythweave.life_transition','allowed',true);update public.characters set hp_current=0,updated_at=now()where id=hero.id;
  update public.character_life_profiles set status=next_status,death_count=death_count+1,last_cause=clean_cause,last_died_at=now(),updated_at=now()where character_id=hero.id returning*into life;
  insert into public.character_life_events(character_id,user_id,event_type,life_mode,cause,location_id,hp_after)values(hero.id,auth.uid(),event_type,life.life_mode,clean_cause,position.location_id,0);
  return jsonb_build_object('character_id',hero.id,'life_mode',life.life_mode,'status',life.status,'death_count',life.death_count,'respawn_count',life.respawn_count,'cause',clean_cause,'can_respawn',life.status='dead','divine_intervention',false);
end;$$;

revoke all on function public.study_rune_record(uuid,text) from public;
grant execute on function public.study_rune_record(uuid,text) to authenticated;
