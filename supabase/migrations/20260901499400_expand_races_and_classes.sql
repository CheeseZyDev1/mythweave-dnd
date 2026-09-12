alter table public.characters drop constraint characters_race_check;
alter table public.characters add constraint characters_race_check check(race in('human','elf','dwarf','half_orc','goblin','fallen','halfling','tiefling','dragonborn','gnome','beastkin','triton'));
alter table public.race_lore drop constraint race_lore_race_id_check;
alter table public.race_lore add constraint race_lore_race_id_check check(race_id in('human','elf','dwarf','half_orc','goblin','fallen','halfling','tiefling','dragonborn','gnome','beastkin','triton'));

alter table public.characters drop constraint characters_character_class_check;
alter table public.characters add constraint characters_character_class_check check(character_class in('fighter','ranger','wizard','cleric','rogue','paladin','bard','druid','barbarian','monk','sorcerer','warlock','artificer','necromancer','spellblade','shaman','gunslinger','summoner','blood_hunter','lancer'));
alter table public.skill_definitions drop constraint skill_definitions_class_id_check;
alter table public.skill_definitions add constraint skill_definitions_class_id_check check(class_id in('fighter','ranger','wizard','cleric','rogue','paladin','bard','druid','barbarian','monk','sorcerer','warlock','artificer','necromancer','spellblade','shaman','gunslinger','summoner','blood_hunter','lancer','fusion'));

insert into public.race_lore(race_id,name_th,title_th,summary_th,origin_th,culture_th,homeland_th,beliefs_th,relations_th,motto_th,starting_location_id,accent_color,sigil)
select lore.race_id,lore.name_th,lore.title_th,lore.summary_th,lore.origin_th,lore.culture_th,lore.homeland_th,lore.beliefs_th,lore.relations_th,lore.motto_th,location.id,lore.accent,lore.sigil
from(values
('halfling','ฮาล์ฟลิง','ผู้พกบ้านไว้ในหัวใจ','นักเดินทางตัวเล็กผู้มีโชค ความกล้า และเครือข่ายมิตรภาพเหนือพรมแดน','บรรพชนล่องเรือตามแม่น้ำจนตั้งชุมชนบนเนินเขา ทุกครอบครัวจึงเล่าเส้นทางของตนผ่านสูตรอาหาร','มื้ออาหารร่วมกันคือคำสัญญา แขกที่นั่งโต๊ะเดียวกันจะได้รับการปกป้อง','ริเวอร์เรสต์และหมู่บ้านริมทาง','โชคจะมาหาผู้แบ่งขนมชิ้นสุดท้าย','เข้ากับมนุษย์และก็อบลินได้ดี แต่ไม่ชอบผู้ใช้อำนาจข่มคนเล็ก','ทางไกลสั้นลงเมื่อมีเพื่อน','riverrest','#c79f62','♧'),
('tiefling','ทีฟลิง','ผู้เลือกเหนือสายเลือด','ทายาทอเวจีผู้ปฏิเสธให้กำเนิดตัดสินความดีชั่วของตน','พันธสัญญาโบราณทิ้งเขา หาง และประกายไฟไว้ในสายเลือดหลายตระกูล','ชื่อที่เลือกเองสำคัญกว่าชื่อเกิด พวกเขาเก็บคำมั่นอย่างเคร่งครัด','อัมบราวาลและชุมชนรอบสุสานเสียงกระซิบ','การกระทำคือคำตอบต่อคำสาป','เข้าใจผู้ตกจากแสงและผู้ทำพันธสัญญา แต่มักถูกเมืองใหญ่หวาดระแวง','ไฟของข้า ข้าเป็นผู้กำหนด','whispervault','#b35e68','♈'),
('dragonborn','ดราก้อนบอร์น','ทายาทลมหายใจธาตุ','นักรบเกล็ดมังกรผู้ให้ค่าสัจจะ ชื่อเสียง และความรับผิดชอบต่อเผ่าพันธุ์','เกิดจากไข่มังกรที่รับประกายวิญญาณมนุษย์ในยุคสงครามเพลิง','ตระกูลบันทึกชัยชนะและความผิดพลาดบนแผ่นโลหะเพื่อให้รุ่นหลังเรียนรู้','ทุ่งเถ้าและป้อมภูเขาไฟแห่งโซลคารา','พลังที่ไร้การควบคุมคือความพ่ายแพ้','เคารพดวอร์ฟและพาลาดิน มักแข่งขันกับครึ่งออร์คอย่างเป็นมิตร','คำสัตย์แข็งกว่าเกล็ด','ashen-barrens','#b86f4f','◇'),
('gnome','โนม','ผู้ตั้งคำถามกับทุกกลไก','นักประดิษฐ์ตัวจิ๋วผู้เห็นโลกเป็นปริศนาที่ควรถอดประกอบอย่างระมัดระวัง','ตำนานกล่าวว่าโนมก้าวออกจากเฟืองนาฬิกาเรือนแรกเมื่อมันเดินครบหนึ่งล้านรอบ','เวิร์กช็อปคือบ้าน งานทดลองล้มเหลวที่บันทึกดีมีค่าเท่างานสำเร็จ','สโตนพาสและนครช่างแห่งฟรอสต์ไฮม์','ทุกสิ่งอธิบายได้ แม้คำอธิบายอาจมีเวทมนตร์','ร่วมงานกับดวอร์ฟและก็อบลินดี ชอบถกเถียงกับนักเวท','ถ้ายังไม่พัง แปลว่ายังศึกษาไม่พอ','stonepass','#7ba7a1','⚙'),
('beastkin','บีสต์คิน','ผู้ฟังชีพจรแดนเถื่อน','ชนเผ่าผู้มีหู หาง หรือกรงเล็บของสัตว์และประสาทสัมผัสเหนือคนเมือง','วิญญาณสัตว์โบราณแบ่งเศษหัวใจให้ผู้หลงทางในป่า ลูกหลานจึงถือกำเนิดระหว่างสองธรรมชาติ','ฝูงถูกเลือกด้วยความไว้ใจ ไม่จำกัดสายเลือด และทุกคนต้องเรียนรู้การตามรอย','พงไพรเวอร์แดนต์','สัญชาตญาณคือคำเตือน ไม่ใช่คำสั่ง','สนิทกับเอลฟ์ ดรูอิด และเรนเจอร์ ระวังนายพรานที่เห็นตนเป็นสัตว์','จงจำกลิ่นของบ้าน','verdant-reach','#769b68','♞'),
('triton','ไทรทัน','ผู้เฝ้าประตูใต้คลื่น','ชาวสมุทรผู้ควบคุมกระแสน้ำและปกป้องโลกบกจากสิ่งที่หลับอยู่ใต้ทะเล','นครใต้สมุทรสร้างขึ้นรอบประตูหินซึ่งผนึกอสูรน้ำลึกมาหลายพันปี','ทุกคนเรียนการเดินเรือ การร้องเพลงกระแส และหน้าที่เฝ้ายาม','ซอลต์เมียร์และชายฝั่งเวย์ลอรา','ทะเลจดจำทุกสิ่งที่ถูกโยนทิ้ง','ไว้ใจชาวประมงและผู้รักษาทะเล แต่ไม่ชอบพ่อค้าที่ล่าสัตว์น้ำหายาก','กระแสเปลี่ยน แต่คำสัตย์ไม่เปลี่ยน','saltmere','#5f9eb1','♆')
)lore(race_id,name_th,title_th,summary_th,origin_th,culture_th,homeland_th,beliefs_th,relations_th,motto_th,location_slug,accent,sigil)
join public.world_locations location on location.slug=lore.location_slug
on conflict(race_id)do nothing;

insert into public.innate_abilities(race_id,slug,name_th,description_th,activation,effect_key,effect_value,usage_rule_th)values
('halfling','halfling-lucky-step','ก้าวหลบด้วยโชค','อุบัติเหตุมักคลาดจากตัวคุณเพียงเส้นผม','reaction','danger_reroll',1,'แก้ผลพลาดร้ายแรงได้หนึ่งครั้งต่อ long rest'),
('halfling','halfling-brave-heart','หัวใจใหญ่กว่าตัว','ความกลัวไม่อาจหยุดคุณเมื่อเพื่อนตกอยู่ในอันตราย','passive','fear_resist',2,'เพิ่ม +2 เมื่อต้านทานความกลัว'),
('halfling','halfling-shared-meal','อาหารแบ่งปัน','การแบ่งอาหารช่วยให้ทั้งกลุ่มฟื้นแรง','rest','party_heal',10,'เพื่อนร่วมพักฟื้น HP เพิ่ม 10%'),
('tiefling','tiefling-hellspark','ประกายอเวจี','เรียกเปลวไฟจากสายเลือดมาเผาศัตรู','action','fire_damage',4,'สร้าง fire damage 4 หนึ่งครั้งต่อ short rest'),
('tiefling','tiefling-dark-sight','ตาแห่งรัตติกาล','มองเห็นร่องรอยความร้อนในความมืด','passive','darkvision',20,'มองเห็นในความมืด 20 เมตร'),
('tiefling','tiefling-pact-sense','สัมผัสพันธสัญญา','รู้สึกได้เมื่อคำสาบานเหนือธรรมชาติอยู่ใกล้','passive','pact_detection',1,'DM เปิดเผยว่ามีพันธสัญญาเวทในฉาก'),
('dragonborn','dragonborn-breath','ลมหายใจธาตุ','ปลดปล่อยพลังธาตุประจำสายเลือดเป็นแนวกว้าง','action','breath_damage',6,'สร้าง damage 1d6 หนึ่งครั้งต่อ short rest'),
('dragonborn','dragonborn-scales','เกล็ดมังกร','เกล็ดแข็งช่วยลดบาดแผลจากการโจมตี','passive','armor_bonus',1,'เพิ่ม AC 1 เมื่อไม่สวมเกราะหนัก'),
('dragonborn','dragonborn-presence','บารมีมังกร','เสียงคำรามทำให้ผู้ลังเลต้องหยุดฟัง','action','intimidation_bonus',2,'เพิ่ม +2 Intimidation หนึ่งฉาก'),
('gnome','gnome-quick-fix','ซ่อมฉุกเฉิน','แก้กลไกหรืออุปกรณ์เสียหายด้วยของใกล้มือ','action','repair',1,'ซ่อมอุปกรณ์หนึ่งชิ้นต่อ short rest'),
('gnome','gnome-illusion-spark','ภาพลวงตาจิ๋ว','สร้างภาพหรือเสียงเล็ก ๆ เพื่อเบี่ยงความสนใจ','action','minor_illusion',1,'สร้างภาพลวงตาขนาดเล็กได้เสมอ'),
('gnome','gnome-analysis','วิเคราะห์จุดบกพร่อง','มองเห็นโครงสร้างและจุดอ่อนของสิ่งประดิษฐ์','passive','construct_bonus',2,'เพิ่ม +2 ต่อการตรวจสอบกลไกและ construct'),
('beastkin','beastkin-scent','กลิ่นตามรอย','จดจำกลิ่นของสิ่งมีชีวิตและติดตามได้','passive','tracking_bonus',2,'เพิ่ม +2 Survival เมื่อตามรอย'),
('beastkin','beastkin-pounce','พุ่งตะครุบ','ระเบิดความเร็วเข้าประชิดเป้าหมาย','action','movement',6,'เคลื่อนเพิ่ม 6 เมตรหนึ่งครั้งต่อ combat'),
('beastkin','beastkin-warning','ขนลุกเตือนภัย','สัญชาตญาณตอบสนองก่อนกับดักทำงาน','reaction','trap_warning',1,'รับคำเตือนก่อนกับดักหนึ่งครั้งต่อ short rest'),
('triton','triton-waterbreath','ลมหายใจสมุทร','หายใจและเคลื่อนไหวใต้น้ำได้เป็นธรรมชาติ','passive','water_adaptation',1,'ไม่มีโทษจากการหายใจหรือเคลื่อนที่ใต้น้ำ'),
('triton','triton-tidecall','เรียกกระแสน้ำ','ผลักหรือดึงเป้าหมายด้วยมวลน้ำ','action','water_push',3,'เคลื่อนเป้าหมาย 3 เมตรหนึ่งครั้งต่อ short rest'),
('triton','triton-deep-ward','เกราะแห่งน้ำลึก','แรงดันสมุทรห่อหุ้มร่างเพื่อลดความเสียหาย','reaction','damage_reduction',3,'ลด damage 3 หนึ่งครั้งต่อ short rest')
on conflict(slug)do nothing;

insert into public.skill_definitions(slug,class_id,name_th,description_th,action_type,effect_type,dice_count,dice_sides,modifier_stat,max_uses,recharge,required_level,sort_order)values
('spellblade-arc-slash','spellblade','คมดาบอาคม','ฟันพร้อมปล่อยคลื่นเวทจากปลายดาบ','action','damage',1,8,'intelligence',0,'at_will',1,1),
('spellblade-phase-guard','spellblade','เกราะเปลี่ยนภพ','เลื่อนร่างออกจากแนวโจมตีชั่วพริบตา','reaction','buff',1,6,'intelligence',2,'short_rest',1,2),
('spellblade-rune-charge','spellblade','จารึกคมอาวุธ','เปลี่ยนธาตุของการโจมตีครั้งถัดไป','bonus','buff',0,null,'intelligence',2,'short_rest',1,3),
('shaman-spirit-spear','shaman','หอกวิญญาณ','ส่งวิญญาณนักล่าพุ่งผ่านเกราะศัตรู','action','damage',1,8,'wisdom',0,'at_will',1,1),
('shaman-ancestor-mend','shaman','บรรพชนเยียวยา','เรียกมือของบรรพชนมาประคองผู้บาดเจ็บ','action','heal',1,8,'wisdom',2,'short_rest',1,2),
('shaman-storm-totem','shaman','โทเทมพายุ','ตั้งเสาวิญญาณควบคุมพื้นที่ด้วยลมและสายฟ้า','action','buff',0,null,'wisdom',1,'long_rest',1,3),
('gunslinger-quickshot','gunslinger','ยิงไว','ชักอาวุธยิงก่อนศัตรูตั้งตัว','action','damage',1,8,'dexterity',0,'at_will',1,1),
('gunslinger-ricochet','gunslinger','กระสุนสะท้อน','คำนวณมุมให้กระสุนกระเด้งโจมตีเป้าหมายรอง','action','damage',2,4,'dexterity',2,'short_rest',1,2),
('gunslinger-smoke-round','gunslinger','กระสุนม่านควัน','สร้างม่านควันบดบังแนวโจมตี','bonus','utility',0,null,'dexterity',2,'short_rest',1,3),
('summoner-aether-claw','summoner','กรงเล็บอัญเชิญ','เปิดช่องมิติให้กรงเล็บของคู่สัญญาโจมตี','action','damage',1,10,'intelligence',0,'at_will',1,1),
('summoner-guardian-call','summoner','เรียกผู้พิทักษ์','อัญเชิญวิญญาณมารับการโจมตีแทนสหาย','reaction','buff',1,6,'intelligence',2,'short_rest',1,2),
('summoner-gate-swap','summoner','สลับผ่านประตู','สลับตำแหน่งสมาชิกปาร์ตี้ผ่านช่องมิติสั้น ๆ','bonus','utility',0,null,'intelligence',1,'long_rest',1,3),
('blood-hunter-crimson-edge','blood_hunter','คมโลหิต','สละพลังชีวิตเล็กน้อยเพื่อเพิ่มพลังอาวุธ','action','damage',1,10,'dexterity',0,'at_will',1,1),
('blood-hunter-monster-brand','blood_hunter','ตราอสูร','ทำเครื่องหมายเผยร่องรอยและขัดการหลบหนี','bonus','buff',0,null,'wisdom',2,'short_rest',1,2),
('blood-hunter-purge','blood_hunter','ชำระพิษโลหิต','ใช้พิธีต้านพิษ คำสาป หรือการควบคุม','reaction','heal',1,6,'constitution',1,'long_rest',1,3),
('lancer-driving-thrust','lancer','หอกทะลวง','พุ่งแทงจากระยะได้เปรียบและผลักแนวศัตรู','action','damage',1,10,'strength',0,'at_will',1,1),
('lancer-intercept','lancer','สกัดแนวโจมตี','เคลื่อนเข้ารับการโจมตีแทนสมาชิกแนวหลัง','reaction','buff',0,null,'constitution',2,'short_rest',1,2),
('lancer-sky-vault','lancer','ทะยานเหนือแนวรบ','ใช้ด้ามหอกส่งตัวข้ามสิ่งกีดขวาง','bonus','utility',0,null,'dexterity',2,'short_rest',1,3)
on conflict(slug)do nothing;

insert into public.multiclass_compatibility(primary_class,secondary_class,reason_th)values
('fighter','lancer','พื้นฐานอาวุธหนักและการคุมแนว'),('fighter','spellblade','ต่อยอดวิชาอาวุธด้วยเวท'),('ranger','gunslinger','การเล็งและต่อสู้ระยะไกล'),('ranger','blood_hunter','การตามรอยอสูรและเอาตัวรอด'),('wizard','spellblade','ประยุกต์ทฤษฎีเวทกับอาวุธ'),('wizard','summoner','เวทมิติและพันธสัญญาอัญเชิญ'),('cleric','shaman','การเยียวยาและสื่อสารวิญญาณ'),('rogue','gunslinger','ความแม่นยำและจังหวะฉวยโอกาส'),('rogue','blood_hunter','ลอบล่าและโจมตีจุดอ่อน'),('paladin','lancer','เกราะหนักและการปกป้องแนวหลัง'),('bard','summoner','เรียกพลังผ่านเสียงและสัญญา'),('druid','shaman','ธรรมชาติและวิญญาณผืนดิน'),('monk','lancer','การควบคุมระยะและสมดุลร่างกาย'),('sorcerer','summoner','พลังเวทโดยกำเนิดกับสิ่งอัญเชิญ'),('artificer','gunslinger','กลไกอาวุธและกระสุนอาคม'),('artificer','spellblade','อักขระเวทบนอุปกรณ์'),('necromancer','blood_hunter','ความรู้กายวิภาคและพลังชีวิต'),('shaman','summoner','การเรียกวิญญาณต่างภพ'),('spellblade','lancer','การโจมตีประชิดและควบคุมแนว')
on conflict do nothing;
insert into public.multiclass_compatibility(primary_class,secondary_class,reason_th)
select secondary_class,primary_class,reason_th from public.multiclass_compatibility where primary_class in('fighter','ranger','wizard','cleric','rogue','paladin','bard','druid','monk','sorcerer','artificer','necromancer','shaman','spellblade')and secondary_class in('spellblade','shaman','gunslinger','summoner','blood_hunter','lancer')on conflict do nothing;

create or replace function public.apply_new_class_basic_attack()returns trigger language plpgsql security definer set search_path=''as $$
declare hero public.characters%rowtype;primary_stat integer;
begin
 select*into hero from public.characters where id=new.character_id;
 if hero.character_class not in('barbarian','monk','sorcerer','warlock','artificer','necromancer','spellblade','shaman','gunslinger','summoner','blood_hunter','lancer')then return new;end if;
 primary_stat:=case hero.character_class when'barbarian'then hero.strength when'monk'then hero.dexterity when'sorcerer'then hero.charisma when'warlock'then hero.charisma when'shaman'then hero.wisdom when'gunslinger'then hero.dexterity when'blood_hunter'then hero.dexterity when'lancer'then hero.strength else hero.intelligence end;
 new.base_damage:=greatest(2,2+hero.level+floor(primary_stat/4)::integer);
 new.damage_type:=case hero.character_class when'monk'then'bludgeoning'when'sorcerer'then'fire'when'warlock'then'psychic'when'artificer'then'lightning'when'necromancer'then'cold'when'spellblade'then'force'when'shaman'then'lightning'when'gunslinger'then'piercing'when'summoner'then'force'when'blood_hunter'then'necrotic'when'lancer'then'piercing'else'slashing'end;
 return new;
end;$$;
