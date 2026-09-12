insert into public.skill_definitions(slug,class_id,name_th,description_th,action_type,effect_type,dice_count,dice_sides,modifier_stat,max_uses,recharge,required_level,sort_order)values
('fighter-cleaving-arc','fighter','คมดาบกวาดวง','เหวี่ยงอาวุธเป็นวงกว้างเพื่อกดดันศัตรูหลายตัว','action','damage',1,10,'strength',1,'short_rest',1,4),
('fighter-rallying-cry','fighter','เสียงปลุกใจ','ตะโกนเรียกขวัญให้สหายยืนหยัดต่อ','bonus','buff',1,6,'charisma',1,'long_rest',1,5),
('ranger-snare','ranger','กับดักเถาวัลย์','วางกับดักหยุดการเคลื่อนที่ของเป้าหมาย','action','utility',0,null,'wisdom',2,'short_rest',1,4),
('ranger-windstep','ranger','ก้าวตามสายลม','เคลื่อนผ่านพื้นที่อันตรายโดยไม่เสียจังหวะ','bonus','buff',0,null,'dexterity',2,'long_rest',1,5),
('wizard-frost-lance','wizard','หอกน้ำแข็ง','ยิงผลึกเย็นจัดเพื่อสร้างความเสียหายและชะลอเป้าหมาย','action','damage',1,8,'intelligence',0,'at_will',1,4),
('wizard-misty-step','wizard','ย่างก้าวหมอก','เคลื่อนย้ายระยะสั้นผ่านม่านหมอก','bonus','utility',0,null,'intelligence',2,'long_rest',1,5),
('cleric-guiding-light','cleric','แสงนำทาง','ส่องแสงเปิดจุดอ่อนให้การโจมตีถัดไป','action','buff',1,6,'wisdom',0,'at_will',1,4),
('cleric-sanctuary','cleric','เขตศักดิ์สิทธิ์','กางเขตคุ้มครองผู้บาดเจ็บจากการโจมตี','reaction','buff',0,null,'wisdom',1,'long_rest',1,5),
('rogue-poisoned-edge','rogue','คมมีดอาบพิษ','เคลือบพิษฉับไวบนอาวุธก่อนลงมือ','bonus','damage',1,8,'dexterity',2,'long_rest',1,4),
('rogue-smoke-veil','rogue','ม่านควัน','สร้างควันบดบังเพื่อถอนตัวหรือช่วยสหาย','reaction','utility',0,null,'dexterity',2,'short_rest',1,5),
('paladin-radiant-challenge','paladin','คำท้าทายเรืองรอง','บังคับศัตรูให้หันมารับคำพิพากษา','bonus','buff',0,null,'charisma',0,'at_will',1,4),
('paladin-cleansing-light','paladin','แสงชำระล้าง','ขจัดพลังมืดและประคองผู้ถูกคำสาป','action','heal',1,6,'charisma',1,'long_rest',1,5),
('bard-thunderous-verse','bard','วรรคคำราม','ขับขานถ้อยคำก้องสะเทือนผลักศัตรูออกไป','action','damage',1,10,'charisma',1,'short_rest',1,4),
('bard-charming-refrain','bard','ท่อนเพลงสะกดใจ','เบี่ยงความสนใจเป้าหมายด้วยท่วงทำนองต้องมนตร์','action','utility',0,null,'charisma',2,'long_rest',1,5),
('druid-barkskin','druid','ผิวเปลือกไม้','ห่อหุ้มร่างด้วยเปลือกไม้แข็งเพื่อรับการโจมตี','reaction','buff',1,6,'wisdom',1,'short_rest',1,4),
('druid-moonbeam','druid','ลำแสงจันทรา','เรียกแสงจันทร์เผาผลาญสิ่งชั่วร้าย','action','damage',1,10,'wisdom',2,'long_rest',1,5)
on conflict(slug)do nothing;

create table public.character_skills(
  character_id uuid not null references public.characters(id)on delete cascade,user_id uuid not null references auth.users(id)on delete cascade,skill_id bigint not null references public.skill_definitions(id),assigned_at timestamptz not null default now(),primary key(character_id,skill_id)
);
create index character_skills_user_idx on public.character_skills(user_id,character_id);
alter table public.character_skills enable row level security;
create policy "Players can read their assigned skills"on public.character_skills for select to authenticated using(user_id=auth.uid());

create or replace function public.assign_random_starting_skills()returns trigger language plpgsql security definer set search_path=''as $$begin
  insert into public.character_skills(character_id,user_id,skill_id)
  select new.id,new.user_id,chosen.id from(
    (select skill.id from public.skill_definitions skill where skill.class_id=new.character_class and skill.required_level<=new.level and skill.recharge='at_will'order by md5(new.id::text||skill.id::text)limit 1)
    union all
    (select skill.id from public.skill_definitions skill where skill.class_id=new.character_class and skill.required_level<=new.level and skill.recharge<>'at_will'order by md5(skill.id::text||new.id::text)limit 2)
  )chosen;
  return new;
end;$$;
create trigger characters_assign_starting_skills after insert on public.characters for each row execute function public.assign_random_starting_skills();
insert into public.character_skills(character_id,user_id,skill_id)
select hero.id,hero.user_id,chosen.id from public.characters hero cross join lateral(
  (select skill.id from public.skill_definitions skill where skill.class_id=hero.character_class and skill.required_level<=hero.level and skill.recharge='at_will'order by md5(hero.id::text||skill.id::text)limit 1)
  union all
  (select skill.id from public.skill_definitions skill where skill.class_id=hero.character_class and skill.required_level<=hero.level and skill.recharge<>'at_will'order by md5(skill.id::text||hero.id::text)limit 2)
)chosen on conflict do nothing;

create or replace function public.grant_random_starter_loadout()returns trigger language plpgsql security definer set search_path=''as $$declare weapon_id bigint;gear_id bigint;item_id bigint;begin
  select id into weapon_id from public.content_items where slug=any(case new.character_class when'fighter'then array['common-1','common-2','common-3']when'ranger'then array['common-4','common-5','common-7']when'wizard'then array['common-8','common-6']when'cleric'then array['common-6','common-3']when'rogue'then array['common-7','common-5']when'paladin'then array['common-1','common-3']when'bard'then array['common-7','common-5','common-6']else array['common-6','common-8']end)order by md5(new.id::text||id::text)limit 1;
  select id into gear_id from public.content_items where slug=any(case when new.character_class in('fighter','paladin','cleric')then array['common-9','common-10','common-11','common-12']else array['common-14','common-15','common-22','common-23','common-28']end)order by md5(id::text||new.id::text)limit 1;
  insert into public.character_item_stacks(character_id,user_id,content_item_id,quantity,acquired_unit_value)values(new.id,new.user_id,weapon_id,1,0),(new.id,new.user_id,gear_id,1,0)on conflict(character_id,content_item_id)do nothing;
  select id into item_id from public.content_items where slug='common-16';insert into public.character_item_stacks(character_id,user_id,content_item_id,quantity,acquired_unit_value)values(new.id,new.user_id,item_id,2,0)on conflict(character_id,content_item_id)do nothing;
  select id into item_id from public.content_items where slug='common-19';insert into public.character_item_stacks(character_id,user_id,content_item_id,quantity,acquired_unit_value)values(new.id,new.user_id,item_id,3,0)on conflict(character_id,content_item_id)do nothing;
  return new;
end;$$;
create trigger characters_grant_starter_loadout after insert on public.characters for each row execute function public.grant_random_starter_loadout();

insert into public.character_item_stacks(character_id,user_id,content_item_id,quantity,acquired_unit_value)
select hero.id,hero.user_id,item.id,1,0 from public.characters hero cross join lateral(select id from public.content_items where slug=any(case hero.character_class when'fighter'then array['common-1','common-2','common-3']when'ranger'then array['common-4','common-5','common-7']when'wizard'then array['common-8','common-6']when'cleric'then array['common-6','common-3']when'rogue'then array['common-7','common-5']when'paladin'then array['common-1','common-3']when'bard'then array['common-7','common-5','common-6']else array['common-6','common-8']end)order by md5(hero.id::text||id::text)limit 1)item on conflict(character_id,content_item_id)do nothing;
insert into public.character_item_stacks(character_id,user_id,content_item_id,quantity,acquired_unit_value)
select hero.id,hero.user_id,item.id,1,0 from public.characters hero cross join lateral(select id from public.content_items where slug=any(case when hero.character_class in('fighter','paladin','cleric')then array['common-9','common-10','common-11','common-12']else array['common-14','common-15','common-22','common-23','common-28']end)order by md5(id::text||hero.id::text)limit 1)item on conflict(character_id,content_item_id)do nothing;
insert into public.character_item_stacks(character_id,user_id,content_item_id,quantity,acquired_unit_value)
select hero.id,hero.user_id,item.id,case item.slug when'common-16'then 2 else 3 end,0 from public.characters hero cross join public.content_items item where item.slug in('common-16','common-19')on conflict(character_id,content_item_id)do nothing;

create or replace function public.get_character_room_skills(target_table_id uuid,target_character_id uuid)
returns table(id bigint,slug text,name_th text,description_th text,action_type text,effect_type text,dice_count smallint,dice_sides smallint,modifier_stat text,max_uses smallint,recharge text,required_level smallint,uses_remaining smallint)
language plpgsql stable security definer set search_path=''as $$declare hero public.characters%rowtype;begin
  if not public.is_dice_table_member(target_table_id)then raise exception'not a member';end if;select*into hero from public.characters where public.characters.id=target_character_id;
  if hero.id is null or not exists(select 1 from public.dice_table_members where table_id=target_table_id and character_id=hero.id)then raise exception'character not in room';end if;
  return query select skill.id,skill.slug,skill.name_th,skill.description_th,skill.action_type,skill.effect_type,skill.dice_count,skill.dice_sides,skill.modifier_stat,skill.max_uses,skill.recharge,skill.required_level,case when skill.max_uses=0 then null else coalesce(state.uses_remaining,skill.max_uses)end::smallint
  from public.character_skills learned join public.skill_definitions skill on skill.id=learned.skill_id left join public.character_room_skills state on state.table_id=target_table_id and state.character_id=hero.id and state.skill_id=skill.id where learned.character_id=hero.id order by skill.sort_order,skill.id;
end;$$;

create or replace function public.use_character_skill(target_table_id uuid,target_character_id uuid,target_skill_id bigint)
returns jsonb language plpgsql security definer set search_path=''as $$declare hero public.characters%rowtype;skill public.skill_definitions%rowtype;skill_state public.character_room_skills%rowtype;skill_use public.skill_uses%rowtype;roll_value integer:=0;modifier_value integer:=0;remaining smallint;summary text;begin
  if not public.is_dice_table_actor(target_table_id)then raise exception'actor required';end if;select*into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception'character not found';end if;
  if not exists(select 1 from public.dice_table_members where table_id=target_table_id and user_id=auth.uid()and character_id=hero.id and role in('player','dm'))then raise exception'character not in room';end if;
  select skill_definitions.*into skill from public.skill_definitions join public.character_skills learned on learned.skill_id=skill_definitions.id and learned.character_id=hero.id where skill_definitions.id=target_skill_id;if skill.id is null then raise exception'skill unavailable';end if;
  if skill.max_uses>0 then insert into public.character_room_skills(table_id,character_id,skill_id,uses_remaining)values(target_table_id,hero.id,skill.id,skill.max_uses)on conflict do nothing;update public.character_room_skills set uses_remaining=uses_remaining-1,updated_at=now()where table_id=target_table_id and character_id=hero.id and skill_id=skill.id and uses_remaining>0 returning*into skill_state;if skill_state.skill_id is null then raise exception'no uses remaining';end if;remaining:=skill_state.uses_remaining;end if;
  modifier_value:=case skill.modifier_stat when'strength'then floor((hero.strength-10)/2.0)when'dexterity'then floor((hero.dexterity-10)/2.0)when'constitution'then floor((hero.constitution-10)/2.0)when'intelligence'then floor((hero.intelligence-10)/2.0)when'wisdom'then floor((hero.wisdom-10)/2.0)when'charisma'then floor((hero.charisma-10)/2.0)else 0 end;
  if skill.dice_count>0 then for die in 1..skill.dice_count loop roll_value:=roll_value+floor(random()*skill.dice_sides)::integer+1;end loop;roll_value:=greatest(0,roll_value+modifier_value);summary:=skill.name_th||' · '||skill.dice_count||'d'||skill.dice_sides||case when modifier_value>=0 then' + 'else' - 'end||abs(modifier_value)||' = '||roll_value;else summary:=skill.name_th||' · เปิดใช้ผลของสกิลแล้ว';end if;
  insert into public.skill_uses(table_id,character_id,user_id,skill_id,character_name,skill_name,effect_type,roll_total,effect_summary)values(target_table_id,hero.id,auth.uid(),skill.id,hero.name,skill.name_th,skill.effect_type,case when skill.dice_count>0 then roll_value else null end,summary)returning*into skill_use;return jsonb_build_object('use',to_jsonb(skill_use),'uses_remaining',remaining);
end;$$;
