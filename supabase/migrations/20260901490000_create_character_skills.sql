create table public.skill_definitions(
  id bigint generated always as identity primary key,slug text not null unique,class_id text not null check(class_id in('fighter','ranger','wizard','cleric','rogue','paladin','bard','druid')),
  name_th text not null,description_th text not null,action_type text not null check(action_type in('action','bonus','reaction')),effect_type text not null check(effect_type in('damage','heal','buff','utility')),
  dice_count smallint not null default 0 check(dice_count between 0 and 5),dice_sides smallint check(dice_sides in(4,6,8,10,12,20)),modifier_stat text check(modifier_stat in('strength','dexterity','constitution','intelligence','wisdom','charisma')),
  max_uses smallint not null default 0 check(max_uses between 0 and 20),recharge text not null check(recharge in('at_will','short_rest','long_rest')),required_level smallint not null default 1 check(required_level between 1 and 20),sort_order smallint not null default 0
);
create table public.character_room_skills(
  table_id uuid not null references public.dice_tables(id)on delete cascade,character_id uuid not null references public.characters(id)on delete cascade,skill_id bigint not null references public.skill_definitions(id)on delete cascade,
  uses_remaining smallint not null check(uses_remaining>=0),updated_at timestamptz not null default now(),primary key(table_id,character_id,skill_id)
);
create table public.skill_uses(
  id uuid primary key default gen_random_uuid(),table_id uuid not null references public.dice_tables(id)on delete cascade,character_id uuid not null references public.characters(id)on delete cascade,user_id uuid not null references auth.users(id)on delete cascade,
  skill_id bigint not null references public.skill_definitions(id),character_name text not null,skill_name text not null,effect_type text not null,roll_total integer,effect_summary text not null,created_at timestamptz not null default now()
);
create index skill_definitions_class_level_idx on public.skill_definitions(class_id,required_level,sort_order);
create index skill_uses_room_created_idx on public.skill_uses(table_id,created_at desc);
alter table public.skill_definitions enable row level security;alter table public.character_room_skills enable row level security;alter table public.skill_uses enable row level security;
create policy "Players can read skill catalog"on public.skill_definitions for select to authenticated using(true);
create policy "Room members can read skill charges"on public.character_room_skills for select to authenticated using(public.is_dice_table_member(table_id));
create policy "Room members can read skill uses"on public.skill_uses for select to authenticated using(public.is_dice_table_member(table_id));

insert into public.skill_definitions(slug,class_id,name_th,description_th,action_type,effect_type,dice_count,dice_sides,modifier_stat,max_uses,recharge,required_level,sort_order)values
('fighter-power-strike','fighter','ฟาดทำลาย','ทุ่มแรงทั้งหมดลงในการโจมตีหนึ่งครั้ง','action','damage',1,8,'strength',0,'at_will',1,1),
('fighter-second-wind','fighter','ลมหายใจที่สอง','รวบรวมกำลังใจเพื่อฟื้นพลังชีวิต','bonus','heal',1,10,'constitution',1,'short_rest',1,2),
('fighter-iron-guard','fighter','กำแพงเหล็ก','ตั้งท่าปกป้องสหายและดึงความสนใจศัตรู','reaction','buff',0,null,'constitution',2,'short_rest',1,3),
('ranger-aimed-shot','ranger','ศรเล็งจุดตาย','เล็งอย่างสุขุมก่อนปล่อยลูกศรแม่นยำ','action','damage',1,8,'dexterity',0,'at_will',1,1),
('ranger-hunters-mark','ranger','ตรานักล่า','ทำเครื่องหมายเป้าหมายเพื่อให้ปาร์ตี้ติดตามได้','bonus','buff',0,null,'wisdom',2,'long_rest',1,2),
('ranger-volley','ranger','ห่าธนู','ยิงลูกศรกวาดพื้นที่รอบเป้าหมาย','action','damage',2,6,'dexterity',2,'short_rest',1,3),
('wizard-arcane-bolt','wizard','ศรเวท','ปล่อยพลังเวทบริสุทธิ์ใส่เป้าหมาย','action','damage',1,10,'intelligence',0,'at_will',1,1),
('wizard-fireball','wizard','ลูกไฟระเบิด','อัดเปลวเพลิงให้ระเบิดครอบคลุมพื้นที่','action','damage',2,6,'intelligence',2,'long_rest',1,2),
('wizard-arcane-shield','wizard','โล่เวทฉับพลัน','สร้างม่านพลังรับการโจมตีในเสี้ยววินาที','reaction','buff',1,6,'intelligence',2,'short_rest',1,3),
('cleric-sacred-flame','cleric','เพลิงศักดิ์สิทธิ์','เรียกแสงพิพากษาลงเหนือศัตรู','action','damage',1,8,'wisdom',0,'at_will',1,1),
('cleric-healing-word','cleric','วาจาเยียวยา','เอ่ยถ้อยคำศักดิ์สิทธิ์เพื่อสมานบาดแผล','bonus','heal',1,8,'wisdom',2,'short_rest',1,2),
('cleric-blessing','cleric','พรแห่งรุ่งอรุณ','มอบพรเพิ่มความกล้าหาญแก่ปาร์ตี้','action','buff',0,null,'wisdom',1,'long_rest',1,3),
('rogue-sneak-attack','rogue','โจมตีฉวยโอกาส','แทงจุดอ่อนเมื่อศัตรูเผลอ','action','damage',1,6,'dexterity',0,'at_will',1,1),
('rogue-shadow-step','rogue','ย่างก้าวเงา','หายเข้าเงาแล้วปรากฏในตำแหน่งได้เปรียบ','bonus','utility',0,null,'dexterity',2,'short_rest',1,2),
('rogue-evasion','rogue','หลบหลีกเหนือชั้น','บิดตัวพ้นจากอันตรายที่ควรโดนเต็มแรง','reaction','buff',0,null,'dexterity',1,'short_rest',1,3),
('paladin-smite','paladin','พิฆาตศักดิ์สิทธิ์','อาบอาวุธด้วยแสงแห่งคำสัตย์','action','damage',1,8,'charisma',0,'at_will',1,1),
('paladin-lay-on-hands','paladin','วางมือรักษา','ส่งพลังศักดิ์สิทธิ์ฟื้นพลังชีวิต','action','heal',1,10,'charisma',2,'long_rest',1,2),
('paladin-aegis','paladin','โล่แห่งคำสัตย์','แผ่ออร่าคุ้มครองสหายจากภัยร้าย','reaction','buff',0,null,'charisma',1,'short_rest',1,3),
('bard-cutting-words','bard','วาจาบั่นทอน','ใช้ถ้อยคำเฉียบคมทำลายจังหวะคู่ต่อสู้','reaction','utility',1,6,'charisma',2,'short_rest',1,1),
('bard-inspiration','bard','แรงบันดาลใจ','มอบลูกเต๋าแห่งกำลังใจให้สหาย','bonus','buff',1,8,'charisma',3,'long_rest',1,2),
('bard-dissonant-note','bard','ท่วงทำนองปั่นป่วน','ดีดเสียงผิดธรรมชาติรบกวนจิตใจศัตรู','action','damage',1,8,'charisma',0,'at_will',1,3),
('druid-thorn-whip','druid','แส้เถาหนาม','เรียกเถาวัลย์หนามฟาดและดึงเป้าหมาย','action','damage',1,8,'wisdom',0,'at_will',1,1),
('druid-healing-bloom','druid','บุปผาเยียวยา','ปลุกดอกไม้เวทให้ฟื้นฟูผู้บาดเจ็บ','action','heal',1,8,'wisdom',2,'short_rest',1,2),
('druid-wild-shape','druid','จำแลงพงไพร','เปลี่ยนร่างเพื่อรับความสามารถของสัตว์ป่า','bonus','utility',0,null,'wisdom',2,'long_rest',1,3);

create or replace function public.get_character_room_skills(target_table_id uuid,target_character_id uuid)
returns table(id bigint,slug text,name_th text,description_th text,action_type text,effect_type text,dice_count smallint,dice_sides smallint,modifier_stat text,max_uses smallint,recharge text,required_level smallint,uses_remaining smallint)
language plpgsql stable security definer set search_path=''as $$
declare hero public.characters%rowtype;
begin
  if not public.is_dice_table_member(target_table_id)then raise exception'not a member';end if;
  select*into hero from public.characters where public.characters.id=target_character_id;
  if hero.id is null or not exists(select 1 from public.dice_table_members where table_id=target_table_id and character_id=hero.id)then raise exception'character not in room';end if;
  return query select skill.id,skill.slug,skill.name_th,skill.description_th,skill.action_type,skill.effect_type,skill.dice_count,skill.dice_sides,skill.modifier_stat,skill.max_uses,skill.recharge,skill.required_level,
    case when skill.max_uses=0 then null else coalesce(state.uses_remaining,skill.max_uses)end::smallint
  from public.skill_definitions skill left join public.character_room_skills state on state.table_id=target_table_id and state.character_id=hero.id and state.skill_id=skill.id
  where skill.class_id=hero.character_class and skill.required_level<=hero.level order by skill.sort_order,skill.id;
end;$$;

create or replace function public.use_character_skill(target_table_id uuid,target_character_id uuid,target_skill_id bigint)
returns jsonb language plpgsql security definer set search_path=''as $$
declare hero public.characters%rowtype;skill public.skill_definitions%rowtype;skill_state public.character_room_skills%rowtype;skill_use public.skill_uses%rowtype;roll_value integer:=0;modifier_value integer:=0;remaining smallint;summary text;
begin
  if not public.is_dice_table_actor(target_table_id)then raise exception'actor required';end if;
  select*into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception'character not found';end if;
  if not exists(select 1 from public.dice_table_members where table_id=target_table_id and user_id=auth.uid()and character_id=hero.id and role in('player','dm'))then raise exception'character not in room';end if;
  select*into skill from public.skill_definitions where id=target_skill_id and class_id=hero.character_class and required_level<=hero.level;if skill.id is null then raise exception'skill unavailable';end if;
  if skill.max_uses>0 then
    insert into public.character_room_skills(table_id,character_id,skill_id,uses_remaining)values(target_table_id,hero.id,skill.id,skill.max_uses)on conflict do nothing;
    update public.character_room_skills set uses_remaining=uses_remaining-1,updated_at=now()where table_id=target_table_id and character_id=hero.id and skill_id=skill.id and uses_remaining>0 returning*into skill_state;
    if skill_state.skill_id is null then raise exception'no uses remaining';end if;remaining:=skill_state.uses_remaining;
  end if;
  modifier_value:=case skill.modifier_stat when'strength'then floor((hero.strength-10)/2.0)when'dexterity'then floor((hero.dexterity-10)/2.0)when'constitution'then floor((hero.constitution-10)/2.0)when'intelligence'then floor((hero.intelligence-10)/2.0)when'wisdom'then floor((hero.wisdom-10)/2.0)when'charisma'then floor((hero.charisma-10)/2.0)else 0 end;
  if skill.dice_count>0 then for die in 1..skill.dice_count loop roll_value:=roll_value+floor(random()*skill.dice_sides)::integer+1;end loop;roll_value:=greatest(0,roll_value+modifier_value);summary:=skill.name_th||' · '||skill.dice_count||'d'||skill.dice_sides||case when modifier_value>=0 then' + 'else' - 'end||abs(modifier_value)||' = '||roll_value;else summary:=skill.name_th||' · เปิดใช้ผลของสกิลแล้ว';end if;
  insert into public.skill_uses(table_id,character_id,user_id,skill_id,character_name,skill_name,effect_type,roll_total,effect_summary)values(target_table_id,hero.id,auth.uid(),skill.id,hero.name,skill.name_th,skill.effect_type,case when skill.dice_count>0 then roll_value else null end,summary)returning*into skill_use;
  return jsonb_build_object('use',to_jsonb(skill_use),'uses_remaining',remaining);
end;$$;

create or replace function public.rest_room_skills(target_table_id uuid,rest_type text)
returns integer language plpgsql security definer set search_path=''as $$declare changed integer;begin
  if rest_type not in('short_rest','long_rest')then raise exception'invalid rest';end if;
  if not exists(select 1 from public.dice_table_members where table_id=target_table_id and user_id=auth.uid()and role='dm')then raise exception'dm required';end if;
  update public.character_room_skills state set uses_remaining=skill.max_uses,updated_at=now()from public.skill_definitions skill where state.table_id=target_table_id and state.skill_id=skill.id and skill.max_uses>0 and(rest_type='long_rest'or skill.recharge='short_rest');get diagnostics changed=row_count;return changed;
end;$$;
revoke all on function public.get_character_room_skills(uuid,uuid)from public;revoke all on function public.use_character_skill(uuid,uuid,bigint)from public;revoke all on function public.rest_room_skills(uuid,text)from public;
grant execute on function public.get_character_room_skills(uuid,uuid)to authenticated;grant execute on function public.use_character_skill(uuid,uuid,bigint)to authenticated;grant execute on function public.rest_room_skills(uuid,text)to authenticated;
alter publication supabase_realtime add table public.skill_uses;alter publication supabase_realtime add table public.character_room_skills;
