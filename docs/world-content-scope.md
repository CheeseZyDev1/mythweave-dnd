# Mythweave World Content Scope

เอกสารนี้เป็น source of truth สำหรับปริมาณเนื้อหาโลก หลังจาก Phase 0 และ Playable Core ใน Phase 1 ผ่านการ playtest แล้ว ห้ามเริ่มสร้างทุกอาณาจักรพร้อมกัน

## Milestone แรก: Vertical Slice

- 1 ทวีป แต่เปิดเล่นเพียง 1 อาณาจักร
- 1 เมืองใหญ่ที่ใช้ fast travel ได้
- 3 หมู่บ้านที่เดินทางด้วยรถม้าหรือกริฟฟิน
- 1 signature dungeon ที่ผูกกับ main story
- 2 wilderness zones สำหรับ random encounter
- 5-6 เผ่า โดยแต่ละเผ่ามี innate ability pool 3-5 แบบและ starting zone
- 6-8 combat classes และ 4-6 crafting professions
- NPC มีชื่อ 15-25 คนในเมืองใหญ่ และ 5-8 คนต่อหมู่บ้าน
- Item ชุดแรกเน้น Common/Uncommon ก่อน ส่วน Legendary ผูกกับ boss หรือ quest เท่านั้น
- Monster ชุดแรกประกอบด้วย common 10-15 ชนิด, dungeon-specific 5-8 ชนิด และ boss 1 ตัว
- Main quests สำหรับ arc แรก พร้อม side-quest templates ที่เปลี่ยน target/location ได้
- 3-4 guild/factions แต่เปิดระบบ affinity เท่าที่จำเป็นสำหรับ vertical slice
- Dimension แรกต้องเล่นได้สมบูรณ์ก่อนเริ่มมิติที่ 2-3

## เป้าหมายเมื่อขยายครบมิติแรก

| หมวด | ขอบเขตเป้าหมาย |
| --- | --- |
| Continent | 1 |
| Kingdom | 4 |
| Major City | ประมาณ 5 รวม |
| Small Town | ประมาณ 15 รวม |
| Dungeon | ประมาณ 5 รวม |
| Wilderness Zone | ประมาณ 8 รวม |
| Playable Race | 5-6 |
| Innate Ability | ประมาณ 20-25 |
| Combat Class | 6-8 |
| Crafting Profession | 4-6 |
| Item | ประมาณ 100-140 |
| Monster | ประมาณ 40-60 |
| Main Quest | 15-20 |
| Side Quest Template | 30-50 |
| Hidden Quest Chain | 5-8 |
| Town Event Template | 15-20 |
| Guild/Faction | 3-4 |
| Dimension | 2-3 หลังมิติแรกสมบูรณ์ |

## Item Budget

| Tier | จำนวนเริ่มต้น |
| --- | ---: |
| Common | 40-60 |
| Uncommon | 25-35 |
| Rare | 15-20 |
| Epic | 8-12 |
| Legendary | 3-5 |
| Soulbound | 5-8 |

## Monster Budget

| ประเภท | จำนวนเริ่มต้น |
| --- | ---: |
| Common / Solo-compatible | 10-15 |
| Dungeon-specific | 5-8 ต่อ dungeon |
| Dungeon Boss | 1 ต่อ dungeon |
| World Boss | 1-2 |

## Quest Budget

| ประเภท | จำนวนเริ่มต้น |
| --- | ---: |
| Main Story | 15-20 |
| Side Quest Template | 30-50 |
| Hidden/Rumor Chain | 5-8 สาย สายละ 2-3 เบาะแส |
| Village/Town Event | 15-20 templates |

## กฎการผลิต Content

1. ทำ gameplay loop ของอาณาจักรแรกให้เล่นจบก่อนขยายพื้นที่
2. สร้าง static pools ที่นำกลับมาใช้ซ้ำได้ก่อน content เฉพาะพื้นที่
3. เพิ่ม legendary items, bosses และ main quests ทีละอาณาจักร
4. สร้างมิติใหม่หลังมิติแรกผ่าน playtest และมีระบบครบเท่านั้น
5. ตัวเลขทั้งหมดเป็น budget ไม่ใช่ข้อบังคับให้สร้างครบก่อนเปิดทดสอบ

## ลำดับการนำไปใช้กับ Roadmap

- Phase 1: เตรียม schema หลักสำหรับ character, room และ save โดยไม่ seed content จำนวนมาก
- Phase 2: สร้าง static pools สำหรับ item, dialogue, quest และ event ของอาณาจักรแรก
- Phase 3: เติม economy, affinity, crafting และ procedural content ภายใน budget
- Phase 4: เปิดแผนที่ vertical slice และระบบเดินทาง
- Phase 5: เติม lore, bestiary และ hidden quest chains
- Dimension 2-3: เริ่มหลัง Phase 9 และมิติแรกสมบูรณ์เท่านั้น
