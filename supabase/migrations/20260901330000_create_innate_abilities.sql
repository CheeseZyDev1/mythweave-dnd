create table public.innate_abilities(
  id bigint generated always as identity primary key,
  race_id text not null references public.race_lore(race_id),
  slug text not null unique,
  name_th text not null,
  description_th text not null,
  activation text not null check(activation in('passive','action','reaction','rest')),
  effect_key text not null,
  effect_value integer not null check(effect_value between 1 and 100),
  usage_rule_th text not null,
  active boolean not null default true,
  unique(race_id,name_th)
);
create table public.character_innate_abilities(
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ability_id bigint not null references public.innate_abilities(id),
  assigned_at timestamptz not null default now()
);
alter table public.innate_abilities enable row level security;
alter table public.character_innate_abilities enable row level security;
create policy "Players can read innate ability pool" on public.innate_abilities for select to authenticated using(active);
create policy "Players can read their innate ability" on public.character_innate_abilities for select to authenticated using(user_id=auth.uid());

insert into public.innate_abilities(race_id,slug,name_th,description_th,activation,effect_key,effect_value,usage_rule_th)values
('human','human-adaptive-training','เรียนรู้ฉับไว','เมื่อเผชิญงานที่ไม่ถนัด คุณดึงประสบการณ์ใกล้เคียงมาช่วยได้','passive','untrained_bonus',1,'เพิ่ม +1 แก่การทดสอบทักษะที่ไม่มี proficiency'),
('human','human-second-wind','ลมหายใจที่สอง','ความมุ่งมั่นทำให้คุณลุกขึ้นได้ในช่วงที่ผู้อื่นยอมแพ้','rest','heal_percent',15,'ฟื้น HP 15% หนึ่งครั้งต่อ long rest'),
('human','human-common-ground','สะพานแห่งผู้คน','คุณอ่านบรรยากาศของกลุ่มต่างวัฒนธรรมและหาจุดร่วมได้รวดเร็ว','passive','social_bonus',2,'เพิ่ม +2 แก่การเจรจาครั้งแรกกับ faction ใหม่'),
('human','human-defy-fate','ฝืนคำพยากรณ์','เมื่อชะตาตัดสินให้พลาด คุณมีโอกาสเขียนผลลัพธ์ใหม่','reaction','reroll_count',1,'ทอย d20 ใหม่ได้หนึ่งครั้งต่อ session'),
('elf','elf-moonstep','ย่างก้าวจันทรา','ฝีเท้าของคุณเบาราวแสงจันทร์บนใบไม้','passive','stealth_bonus',2,'เพิ่ม +2 Stealth ในป่าหรือเวลากลางคืน'),
('elf','elf-keen-senses','ประสาทสัมผัสพงไพร','เสียงใบไม้ผิดจังหวะหรือกลิ่นโลหะในลมไม่อาจหลบคุณได้','passive','perception_bonus',2,'เพิ่ม +2 Passive Perception'),
('elf','elf-verdant-whisper','เสียงกระซิบสีเขียว','คุณสื่อความตั้งใจง่าย ๆ กับพืชและสัตว์ขนาดเล็กได้','action','nature_insight',1,'ถามธรรมชาติรอบตัวได้หนึ่งคำถามต่อ short rest'),
('elf','elf-trance-recall','ความทรงจำแห่งภวังค์','ระหว่างสมาธิ คุณสัมผัสเศษความทรงจำของบรรพชน','rest','lore_hint',1,'รับเบาะแส lore เพิ่มหนึ่งชิ้นหลัง long rest'),
('dwarf','dwarf-stoneblood','โลหิตศิลา','ร่างกายที่ผูกกับหินต้านพิษและความอ่อนล้าได้ดี','passive','poison_resistance',25,'ลดระยะเวลา poison และ fatigue 25%'),
('dwarf','dwarf-forge-memory','ความจำแห่งเตาหลอม','เพียงตรวจรอยค้อน คุณก็มองเห็นเรื่องราวของสิ่งของที่ถูกสร้าง','action','item_identify',1,'ระบุคุณสมบัติ mundane item ได้โดยไม่เสียค่าใช้จ่าย'),
('dwarf','dwarf-rooted-stance','ยืนหยัดดั่งผา','เมื่อปักเท้าลงพื้น แรงกระแทกยากจะผลักคุณออกจากตำแหน่ง','reaction','forced_move_resist',1,'ปฏิเสธ forced movement หนึ่งครั้งต่อ combat'),
('dwarf','dwarf-deep-sight','ดวงตาใต้พิภพ','ความมืดในอุโมงค์เผยรูปทรงและรอยแร่แก่คุณ','passive','darkvision_range',18,'มองเห็นในความมืดได้ไกล 18 เมตร'),
('half_orc','orc-relentless-heart','หัวใจไม่ยอมล้ม','ความเจ็บปวดรุนแรงปลุกสายเลือดนักรบให้ยืนหยัดอีกครั้ง','reaction','death_guard_hp',1,'เมื่อลดเหลือ 0 HP ให้เหลือ 1 HP หนึ่งครั้งต่อ long rest'),
('half_orc','orc-war-cry','เสียงคำรามแนวหน้า','เสียงของคุณทำให้สหายรวบรวมความกล้าและศัตรูลังเล','action','party_attack_bonus',1,'สหายในระยะใกล้ได้ +1 การโจมตีหนึ่งรอบต่อ combat'),
('half_orc','orc-ash-walker','ผู้เดินบนเถ้า','ความร้อนและควันของชายแดนไม่อาจหยุดยั้งคุณง่าย ๆ','passive','fire_resistance',15,'ลดความเสียหายไฟ 15%'),
('half_orc','orc-blood-challenge','คำท้าแห่งสายเลือด','คุณท้าศัตรูที่แข็งแกร่งที่สุดและเติบโตจากการเผชิญหน้า','passive','boss_damage_bonus',2,'เพิ่ม +2 damage ต่อศัตรูระดับ boss'),
('goblin','goblin-nimble-escape','ช่องว่างเพียงพอ','ไม่มีวงล้อมใดไร้รอยแยกสำหรับคนที่มองต่ำพอ','reaction','disengage_count',1,'ถอนตัวจากศัตรูโดยไม่ถูกโจมตีสวนหนึ่งครั้งต่อ combat'),
('goblin','goblin-scrap-savant','อัจฉริยะเศษเหล็ก','คุณประกอบของไร้ค่าให้กลายเป็นเครื่องมือชั่วคราวได้','rest','temporary_tool',1,'สร้างเครื่องมือชั่วคราวหนึ่งชิ้นต่อ short rest'),
('goblin','goblin-lucky-scrounge','มือค้นของนำโชค','กองขยะมักซ่อนสิ่งที่คนตัวใหญ่เดินผ่านไป','passive','common_loot_bonus',10,'เพิ่มโอกาสพบ common material 10%'),
('goblin','goblin-tunnel-rat','หนูแห่งอุโมงค์','ทางแคบ ความมืด และกับดักหยาบคือสนามเด็กเล่นของคุณ','passive','trap_bonus',2,'เพิ่ม +2 ตรวจหาและปลดกับดักใน dungeon'),
('fallen','fallen-fractured-halo','วงแสงแตกร้าว','เศษแสงเหนือศีรษะตอบสนองเมื่อความมืดเข้าใกล้','passive','undead_warning',1,'รับสัญญาณเตือนเมื่อ undead อยู่ในพื้นที่เดียวกัน'),
('fallen','fallen-radiant-scar','บาดแผลเรืองรอง','คุณเปลี่ยนความเจ็บปวดเป็นประกายศักดิ์สิทธิ์ที่โต้กลับผู้ทำร้าย','reaction','radiant_retaliation',3,'สร้าง radiant damage 3 เมื่อถูกโจมตี หนึ่งครั้งต่อ combat'),
('fallen','fallen-memory-echo','เสียงสะท้อนที่ถูกลบ','สถานที่เก่าแก่กระตุ้นภาพอดีตซึ่งไม่ใช่ความทรงจำของมนุษย์','action','secret_lore_hint',1,'เปิดเบาะแสลับหนึ่งชิ้นในสถานที่โบราณ'),
('fallen','fallen-dusk-wings','ปีกยามสนธยา','เงาปีกที่มองไม่เห็นชะลอการตกและพาคุณข้ามช่องว่าง','reaction','fall_reduction',20,'ลดระยะตกเสมือนสั้นลง 20 เมตร');

create or replace function public.assign_character_innate_ability()
returns trigger language plpgsql security definer set search_path='' as $$
declare chosen public.innate_abilities%rowtype;
begin
  select * into chosen from public.innate_abilities where race_id=new.race and active order by random() limit 1;
  if chosen.id is null then raise exception 'innate ability pool missing for race';end if;
  insert into public.character_innate_abilities(character_id,user_id,ability_id)values(new.id,new.user_id,chosen.id);
  return new;
end;$$;
create trigger characters_assign_innate_ability after insert on public.characters for each row execute function public.assign_character_innate_ability();

insert into public.character_innate_abilities(character_id,user_id,ability_id)
select character.id,character.user_id,chosen.id from public.characters character
join lateral(select ability.id from public.innate_abilities ability where ability.race_id=character.race and ability.active order by md5(character.id::text||ability.slug) limit 1)chosen on true
on conflict(character_id)do nothing;
