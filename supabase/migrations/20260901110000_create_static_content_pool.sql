create table public.content_items (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name_th text not null,
  name_en text not null,
  rarity text not null check (rarity in ('common','uncommon','rare','epic','legendary','soulbound')),
  category text not null check (category in ('weapon','armor','consumable','tool','material','treasure')),
  base_value integer not null check (base_value >= 0),
  weight integer not null default 10 check (weight between 1 and 1000),
  tags text[] not null default '{}',
  properties jsonb not null default '{}',
  active boolean not null default true
);

create table public.dialogue_pool (
  id bigint generated always as identity primary key,
  context text not null check (context in ('greeting','farewell','shop','rumor','quest','weather','danger','tavern')),
  speaker_type text not null default 'generic',
  text_th text not null check (char_length(text_th) between 2 and 500),
  weight integer not null default 10 check (weight between 1 and 1000),
  tags text[] not null default '{}',
  active boolean not null default true
);

create table public.quest_templates (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title_th text not null,
  quest_type text not null check (quest_type in ('hunt','gather','delivery','escort','investigate','rescue')),
  description_th text not null,
  objective_template jsonb not null,
  reward_template jsonb not null,
  weight integer not null default 10 check (weight between 1 and 1000),
  tags text[] not null default '{}',
  active boolean not null default true
);

create table public.event_templates (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title_th text not null,
  event_type text not null check (event_type in ('social','danger','trade','mystery','weather','opportunity')),
  description_th text not null,
  choices jsonb not null default '[]',
  weight integer not null default 10 check (weight between 1 and 1000),
  tags text[] not null default '{}',
  active boolean not null default true
);

alter table public.content_items enable row level security;
alter table public.dialogue_pool enable row level security;
alter table public.quest_templates enable row level security;
alter table public.event_templates enable row level security;
create policy "Authenticated players can read items" on public.content_items for select to authenticated using (active);
create policy "Authenticated players can read dialogue" on public.dialogue_pool for select to authenticated using (active);
create policy "Authenticated players can read quest templates" on public.quest_templates for select to authenticated using (active);
create policy "Authenticated players can read event templates" on public.event_templates for select to authenticated using (active);

with common(name_th, name_en, category, tag) as (values
  ('ดาบเหล็กฝึกหัด','Training Iron Sword','weapon','melee'),('ขวานคนตัดไม้','Woodcutter Axe','weapon','melee'),('หอกยามเมือง','Watch Spear','weapon','reach'),('ธนูไม้ยู','Yew Shortbow','weapon','ranged'),('หน้าไม้พกพา','Hand Crossbow','weapon','ranged'),
  ('กระบองโอ๊ก','Oak Club','weapon','blunt'),('มีดเดินทาง','Traveller Knife','weapon','light'),('ไม้เท้านักศึกษา','Apprentice Staff','weapon','arcane'),('โล่ไม้เสริมเหล็ก','Ironbound Shield','armor','shield'),('เกราะหนังเย็บมือ','Stitched Leather','armor','light'),
  ('เสื้อเกราะโซ่เก่า','Worn Chain Shirt','armor','medium'),('หมวกยามทองแดง','Copper Watch Helm','armor','head'),('ถุงมือช่าง','Craftsman Gloves','armor','hands'),('รองเท้าเดินป่า','Trail Boots','armor','feet'),('ผ้าคลุมกันฝน','Raincloak','armor','cloak'),
  ('ยารักษาแผลเล็ก','Minor Healing Draught','consumable','healing'),('ผ้าพันแผลสะอาด','Clean Bandage','consumable','healing'),('ยาแก้พิษอ่อน','Mild Antidote','consumable','antidote'),('เสบียงเดินทาง','Trail Ration','consumable','food'),('น้ำมันตะเกียง','Lamp Oil','consumable','utility'),
  ('ระเบิดควันดิน','Clay Smoke Bomb','consumable','escape'),('ชอล์กนักสำรวจ','Explorer Chalk','tool','exploration'),('เชือกป่านยี่สิบเมตร','Hemp Rope','tool','exploration'),('ชุดจุดไฟ','Tinder Kit','tool','survival'),('ตะเกียงทองเหลือง','Brass Lantern','tool','light'),
  ('ชะแลงเหล็ก','Iron Crowbar','tool','strength'),('ชุดตกปลา','Fishing Kit','tool','food'),('เข็มทิศเก่า','Old Compass','tool','navigation'),('พลั่วสนาม','Field Shovel','tool','digging'),('ถุงนอนขนแกะ','Wool Bedroll','tool','camp'),
  ('สมุนไพรฟื้นแรง','Vigor Herb','material','alchemy'),('เห็ดเรืองแสง','Glowcap Mushroom','material','alchemy'),('แร่เหล็กดิบ','Raw Iron Ore','material','smithing'),('หนังหมาป่า','Wolf Pelt','material','leather'),('กิ่งไม้เงิน','Silverwood Twig','material','arcane'),
  ('เกลือดำ','Black Salt','material','cooking'),('ขนนกกริฟฟินอ่อน','Young Griffin Feather','material','crafting'),('ฟันก็อบลิน','Goblin Tooth','treasure','trophy'),('เหรียญโบราณสึก','Worn Ancient Coin','treasure','history'),('แก้วทะเลสีฟ้า','Blue Sea Glass','treasure','trinket')
)
insert into public.content_items(slug,name_th,name_en,rarity,category,base_value,weight,tags)
select 'common-'||row_number() over(), name_th,name_en,'common',category,4+(row_number() over()*2),20,array[tag,'starter'] from common;

with uncommon(name_th,name_en,category,tag) as (values
  ('ดาบเพลิงริบหรี่','Emberedge','weapon','fire'),('คันธนูลมเหนือ','Northwind Bow','weapon','ranged'),('ค้อนเสียงสะท้อน','Echo Hammer','weapon','thunder'),('กริชเงาจันทร์','Moonshadow Dagger','weapon','stealth'),('หอกคลื่นคราม','Tide Spear','weapon','water'),
  ('โล่ตราหมาป่า','Wolfcrest Shield','armor','guard'),('เกราะหนังใบไม้','Leafhide Armor','armor','nature'),('ผ้าคลุมนักลอบเร้น','Sneakcloak','armor','stealth'),('รองเท้าก้าวเบา','Softstep Boots','armor','movement'),('แหวนเกราะแก้ว','Glassguard Ring','armor','ward'),
  ('ยารักษาแผลเข้มข้น','Greater Healing Draught','consumable','healing'),('น้ำยาเดินบนน้ำ','Waterwalk Tonic','consumable','travel'),('ผงแสงดาว','Starlight Powder','consumable','light'),('อาหารนักรบ','Warrior Stew','consumable','food'),('ยาต้านความหนาว','Frostward Elixir','consumable','cold'),
  ('ชุดกุญแจเงียบ','Silent Lockpicks','tool','thievery'),('กล้องส่องทางไกลพับได้','Folding Spyglass','tool','scouting'),('แผนที่หมึกมีชีวิต','Living Ink Map','tool','navigation'),('เต็นท์พับเวท','Arcane Fold Tent','tool','camp'),('ระฆังเตือนภัย','Warning Bell','tool','alarm'),
  ('ผลึกมานาสีคราม','Azure Mana Crystal','material','arcane'),('เหล็กดาวชิ้นเล็ก','Star Iron Shard','material','smithing'),('หัวใจไม้โบราณ','Ancient Heartwood','material','nature'),('ไหมแมงมุมเงิน','Silver Spider Silk','material','weaving'),('ไข่มุกหมอก','Mist Pearl','treasure','mystery')
)
insert into public.content_items(slug,name_th,name_en,rarity,category,base_value,weight,tags)
select 'uncommon-'||row_number() over(),name_th,name_en,'uncommon',category,55+(row_number() over()*5),10,array[tag] from uncommon;

insert into public.dialogue_pool(context,speaker_type,text_th,weight,tags)
select contexts[(n-1)%8+1], speakers[(n-1)%6+1], lines[n], 8+((n*7)%13), array[contexts[(n-1)%8+1]]
from (select array['greeting','farewell','shop','rumor','quest','weather','danger','tavern']::text[] contexts,
array['villager','merchant','guard','traveller','innkeeper','scholar']::text[] speakers,
array[
'ยินดีต้อนรับ นักเดินทาง เตาผิงยังอุ่นและข่าวลือยังสดใหม่','ถนนตะวันออกปลอดภัยกว่าปกติ แต่ไม่มีใครรู้ว่าจะนานแค่ไหน','หากมองหาของใช้เดินทาง ข้ามีของที่ผ่านการทดสอบแล้ว','เมื่อคืนมีแสงประหลาดลอยเหนือหอคอยร้าง','หัวหน้าหมู่บ้านกำลังหาคนที่ไม่กลัวเสียงจากใต้บ่อน้ำ','เมฆสีม่วงหมายถึงฝนเวทมนตร์ อย่าอยู่กลางแจ้งนาน','รอยเท้าชุดนี้ไม่ใช่ของหมาป่า และมันเดินด้วยสองขา','โต๊ะมุมในเป็นของนักเล่านิทาน ถ้าเลี้ยงเหล้าเขาจะยอมพูด',
'ขอให้แสงโคมพาเจ้ากลับมาโดยปลอดภัย','คาราวานจากเหนือยังมาไม่ถึง ราคาจึงสูงขึ้นเล็กน้อย','ข้ารับซื้อสมุนไพรสด แต่ไม่เอาของที่ขึ้นตามสุสาน','เด็กเลี้ยงแกะสาบานว่าได้ยินภูเขาเรียกชื่อเขา','มีหีบยาต้องส่งถึงป้อมก่อนพระอาทิตย์ตก','ลมเปลี่ยนทิศแล้ว พรุ่งนี้อาจมีหมอกหนาจัด','ยามพบลูกธนูสีดำปักอยู่บนประตูเมืองเมื่อรุ่งสาง','เพลงเก่าบทนั้นห้ามร้องหลังเที่ยงคืน จำไว้ให้ดี',
'เจ้าดูเหมือนคนที่ผ่านทางไกลมา นั่งพักก่อนเถิด','ประตูเมืองจะปิดเมื่อระฆังดังสามครั้ง','สินค้าชิ้นนี้แพงเพราะช่างผู้ทำหายตัวไปแล้ว','ใต้สะพานหินมีประตูที่ปรากฏเฉพาะคืนเดือนดับ','หญิงชราที่ชายป่าต้องการคนตามหาหลานชาย','กลิ่นฝนแรงเช่นนี้ พายุคงมาถึงก่อนค่ำ','อย่าจุดไฟสีเขียวในป่า มันเรียกสิ่งที่ไม่ควรตื่น','มีคนจ่ายเหรียญทองเพื่อถามว่าใครเดินทางไปตะวันตก',
'ข้าเคยเห็นตราแบบนั้นในหนังสือของกิลด์เก่า','เดินทางดี ๆ และอย่าเชื่อป้ายบอกทางที่เขียนด้วยหมึกแดง','ถ้าซื้อหลายชิ้น ข้าจะแถมถุงผ้ากันน้ำให้','นักขุดพบระฆังใต้ดิน ทั้งที่ไม่มีวิหารอยู่แถวนั้น','นายช่างต้องการแร่จากถ้ำ แต่คนงานไม่มีใครกล้ากลับไป','อากาศเงียบเกินไป นกทั้งหมดบินหนีไปทางใต้แล้ว','หน่วยลาดตระเวนขาดการติดต่อใกล้แนวต้นสนดำ','คืนนี้มีการแข่งขันทอยเต๋า รางวัลคือแผนที่ที่ไม่มีชื่อ'
]::text[] lines) seed cross join generate_series(1,32) n;

insert into public.quest_templates(slug,title_th,quest_type,description_th,objective_template,reward_template,weight,tags)
select 'side-'||n,
  (array['รอยเท้าในหมอก','เสบียงที่หายไป','เสียงจากบ่อน้ำ','จดหมายไม่ถึงมือ','สมุนไพรใต้แสงจันทร์','ผู้คุ้มกันคนสุดท้าย'])[(n-1)%6+1]||' #'||n,
  (array['hunt','gather','investigate','delivery','gather','escort'])[(n-1)%6+1],
  (array['ตามล่าภัยที่คุกคามเส้นทางการค้า','รวบรวมสิ่งของที่ชาวบ้านต้องการก่อนหมดเวลา','สืบหาต้นเหตุของเหตุการณ์ผิดปกติ','นำของสำคัญไปส่งยังจุดหมายอย่างปลอดภัย','ค้นหาวัตถุดิบหายากในพื้นที่อันตราย','คุ้มกันผู้ว่าจ้างผ่านเส้นทางที่มีศัตรู'])[(n-1)%6+1],
  jsonb_build_object('target_count',2+(n%5),'location_tag',(array['forest','road','village','ruins','hills'])[(n-1)%5+1]),
  jsonb_build_object('gold',20+n*3,'xp',40+n*5), 8+(n%8), array['side','repeatable']
from generate_series(1,30) n;

insert into public.event_templates(slug,title_th,event_type,description_th,choices,weight,tags)
select 'town-event-'||n,
  (array['ตลาดยามค่ำ','ระฆังเตือนภัย','พ่อค้าหลงทาง','เด็กกับแผนที่','ฝนดาวตก','การดวลกลางลาน'])[(n-1)%6+1]||' #'||n,
  (array['trade','danger','social','mystery','weather','opportunity'])[(n-1)%6+1],
  (array['ร้านค้าพิเศษเปิดเพียงคืนนี้','เสียงระฆังดังขึ้นและชาวเมืองวิ่งหาที่หลบ','คาราวานต้องการผู้นำทางด่วน','เด็กคนหนึ่งถือแผนที่ซึ่งไม่ควรมีอยู่','ท้องฟ้าส่องแสงและเวทมนตร์แปรปรวน','นักสู้ท้องถิ่นท้าทายผู้มาเยือน'])[(n-1)%6+1],
  jsonb_build_array(jsonb_build_object('label','เข้าร่วม','effect','engage'),jsonb_build_object('label','สังเกตการณ์','effect','observe'),jsonb_build_object('label','เดินจากไป','effect','leave')),
  7+(n%9), array['town','random']
from generate_series(1,15) n;
