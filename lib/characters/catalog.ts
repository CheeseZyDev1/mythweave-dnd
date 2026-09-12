export const STAT_KEYS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export const STAT_LABELS: Record<StatKey, { short: string; label: string }> = {
  strength: { short: "STR", label: "พละกำลัง" },
  dexterity: { short: "DEX", label: "ความคล่องตัว" },
  constitution: { short: "CON", label: "ความทนทาน" },
  intelligence: { short: "INT", label: "สติปัญญา" },
  wisdom: { short: "WIS", label: "ปัญญาญาณ" },
  charisma: { short: "CHA", label: "เสน่ห์" },
};

export const RACES = [
  { id: "human", label: "มนุษย์", icon: "✦", tagline: "ผู้ปรับตัวแห่งสี่อาณาจักร", description: "สมดุลและเรียนรู้ไว เหมาะกับทุกเส้นทาง", bonuses: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 } },
  { id: "elf", label: "เอลฟ์", icon: "♢", tagline: "สายเลือดแห่งพงไพร", description: "ว่องไว สายตาเฉียบคม และผูกพันกับเวทมนตร์", bonuses: { dexterity: 2, intelligence: 1 } },
  { id: "dwarf", label: "ดวอร์ฟ", icon: "◆", tagline: "ทายาทแห่งขุนเขา", description: "แข็งแกร่ง อดทน และเชี่ยวชาญงานช่าง", bonuses: { constitution: 2, strength: 1 } },
  { id: "half_orc", label: "ครึ่งออร์ค", icon: "▲", tagline: "หัวใจนักรบแห่งชายแดน", description: "พลังมหาศาลและยืนหยัดเมื่อคนอื่นล้มลง", bonuses: { strength: 2, constitution: 1 } },
  { id: "goblin", label: "ก็อบลิน", icon: "●", tagline: "นักเอาตัวรอดตัวจิ๋ว", description: "รวดเร็ว เจ้าเล่ห์ และสร้างทางหนีได้เสมอ", bonuses: { dexterity: 2, constitution: 1 } },
  { id: "fallen", label: "ผู้ตกจากแสง", icon: "☾", tagline: "เศษดาวจากสวรรค์", description: "พลังศักดิ์สิทธิ์ที่แตกร้าวและอดีตซึ่งถูกปิดบัง", bonuses: { charisma: 2, wisdom: 1 } },
  { id: "halfling", label: "ฮาล์ฟลิง", icon: "♧", tagline: "นักเดินทางหัวใจใหญ่", description: "ตัวเล็ก คล่องแคล่ว และมีโชคช่วยเมื่อสถานการณ์คับขัน", bonuses: { dexterity: 2, charisma: 1 } },
  { id: "tiefling", label: "ทีฟลิง", icon: "♈", tagline: "ทายาทเพลิงอเวจี", description: "มีเขาและสายเลือดอสูร แต่เป็นผู้เลือกเส้นทางของตนเอง", bonuses: { charisma: 2, intelligence: 1 } },
  { id: "dragonborn", label: "ดราก้อนบอร์น", icon: "◇", tagline: "โลหิตแห่งมังกร", description: "เกล็ดแข็งแกร่ง ลมหายใจธาตุ และศักดิ์ศรีที่ไม่ยอมแตกหัก", bonuses: { strength: 2, charisma: 1 } },
  { id: "gnome", label: "โนม", icon: "⚙", tagline: "นักคิดตัวจิ๋ว", description: "ช่างสงสัย เชี่ยวชาญกลไก ภาพลวงตา และเวทประยุกต์", bonuses: { intelligence: 2, dexterity: 1 } },
  { id: "beastkin", label: "บีสต์คิน", icon: "♞", tagline: "ผู้สืบเสียงเรียกแห่งป่า", description: "ผู้มีลักษณะสัตว์ ประสาทสัมผัสไวและเคลื่อนไหวตามสัญชาตญาณ", bonuses: { dexterity: 2, wisdom: 1 } },
  { id: "triton", label: "ไทรทัน", icon: "♆", tagline: "ผู้พิทักษ์มหาสมุทร", description: "หายใจใต้น้ำ อ่านกระแสน้ำ และแบกรับคำสัตย์จากนครใต้สมุทร", bonuses: { constitution: 2, wisdom: 1 } },
] as const;

export const CLASSES = [
  { id: "fighter", label: "นักรบ", icon: "⚔", role: "แนวหน้า", description: "เชี่ยวชาญอาวุธ เกราะ และการต่อสู้ทุกสถานการณ์", hitDie: 10, primary: "strength" as StatKey, color: "#b55845" },
  { id: "ranger", label: "นักล่า", icon: "➶", role: "โจมตีระยะไกล", description: "ติดตามร่องรอย คุมพื้นที่ และเอาตัวรอดในแดนเถื่อน", hitDie: 10, primary: "dexterity" as StatKey, color: "#597f55" },
  { id: "wizard", label: "นักเวท", icon: "✧", role: "เวทโจมตี", description: "ศึกษาคัมภีร์และเปลี่ยนสนามรบด้วยคาถาอันทรงพลัง", hitDie: 6, primary: "intelligence" as StatKey, color: "#6168a7" },
  { id: "cleric", label: "นักบวช", icon: "✚", role: "รักษา/สนับสนุน", description: "นำพาพรจากเทพ ฟื้นฟูสหาย และขับไล่ความมืด", hitDie: 8, primary: "wisdom" as StatKey, color: "#c1a65a" },
  { id: "rogue", label: "โจร", icon: "⌁", role: "ลอบโจมตี", description: "เคลื่อนไหวในเงามืด ปลดกับดัก และโจมตีจุดตาย", hitDie: 8, primary: "dexterity" as StatKey, color: "#6c6578" },
  { id: "paladin", label: "พาลาดิน", icon: "♜", role: "ป้องกัน/ศักดิ์สิทธิ์", description: "อัศวินแห่งคำสัตย์ ปกป้องปาร์ตี้ด้วยเกราะและแสง", hitDie: 10, primary: "charisma" as StatKey, color: "#d1b66a" },
  { id: "bard", label: "กวี", icon: "♪", role: "สนับสนุน/ควบคุม", description: "ใช้ถ้อยคำ ดนตรี และมนตร์เสน่ห์เปลี่ยนชะตาการต่อสู้", hitDie: 8, primary: "charisma" as StatKey, color: "#9a587f" },
  { id: "druid", label: "ดรูอิด", icon: "❧", role: "ธรรมชาติ/แปลงร่าง", description: "เรียกพลังธรรมชาติ รักษาบาดแผล และแปลงกายเป็นสัตว์", hitDie: 8, primary: "wisdom" as StatKey, color: "#477a67" },
  { id: "barbarian", label: "เบอร์เซิร์กเกอร์", icon: "▲", role: "พลังโจมตี/รับความเสียหาย", description: "ใช้แรงโทสะและสัญชาตญาณดิบทะลวงแนวศัตรู", hitDie: 12, primary: "strength" as StatKey, color: "#a7473b" },
  { id: "monk", label: "นักพรต", icon: "☸", role: "จู่โจม/ควบคุม", description: "ฝึกกายและลมหายใจให้เคลื่อนไหวเหนือขีดจำกัด", hitDie: 8, primary: "dexterity" as StatKey, color: "#b58b4b" },
  { id: "sorcerer", label: "จอมเวทสายเลือด", icon: "✦", role: "เวทดิบ/ระเบิดพลัง", description: "ดึงมนตราจากสายเลือดโดยไม่ต้องพึ่งตำรา", hitDie: 6, primary: "charisma" as StatKey, color: "#9b4e82" },
  { id: "warlock", label: "ผู้ทำพันธสัญญา", icon: "☽", role: "คำสาป/เวทเงา", description: "ยืมพลังจากสิ่งลึกลับแลกกับพันธะที่ต้องรักษา", hitDie: 8, primary: "charisma" as StatKey, color: "#67518e" },
  { id: "artificer", label: "นักประดิษฐ์เวท", icon: "⚙", role: "อุปกรณ์/สนับสนุน", description: "หลอมเวทมนตร์เข้ากับกลไกและเครื่องมือสนามรบ", hitDie: 8, primary: "intelligence" as StatKey, color: "#537b83" },
  { id: "necromancer", label: "นักเวทวิญญาณ", icon: "☠", role: "วิญญาณ/ควบคุม", description: "ศึกษารอยต่อชีวิต ความตาย และความทรงจำตกค้าง", hitDie: 6, primary: "intelligence" as StatKey, color: "#596458" },
  { id: "spellblade", label: "ดาบเวท", icon: "⚔", role: "ประชิด/เวทมนตร์", description: "ประสานคมดาบกับอักขระเวทเพื่อเปลี่ยนรูปแบบโจมตีระหว่างต่อสู้", hitDie: 8, primary: "intelligence" as StatKey, color: "#627fb2" },
  { id: "shaman", label: "ชาแมน", icon: "☼", role: "วิญญาณ/สนับสนุน", description: "สื่อสารกับวิญญาณบรรพชนและเรียกพลังธาตุจากผืนโลก", hitDie: 8, primary: "wisdom" as StatKey, color: "#648461" },
  { id: "gunslinger", label: "มือปืนเวท", icon: "✹", role: "ยิงไกล/จังหวะ", description: "ใช้อาวุธยิงและกระสุนอาคม จู่โจมแม่นยำแต่ต้องบริหารจังหวะ", hitDie: 8, primary: "dexterity" as StatKey, color: "#91704e" },
  { id: "summoner", label: "ผู้อัญเชิญ", icon: "◎", role: "อัญเชิญ/ควบคุม", description: "ทำสัญญากับสิ่งมีชีวิตต่างมิติให้ช่วยโจมตี ป้องกัน และสำรวจ", hitDie: 6, primary: "intelligence" as StatKey, color: "#765b9c" },
  { id: "blood_hunter", label: "นักล่าโลหิต", icon: "♦", role: "ไล่ล่า/เสี่ยงพลังชีวิต", description: "ใช้พิธีโลหิตเสริมอาวุธเพื่อกำจัดอสูรที่นักล่าทั่วไปรับมือไม่ได้", hitDie: 10, primary: "dexterity" as StatKey, color: "#873e43" },
  { id: "lancer", label: "อัศวินหอก", icon: "↟", role: "ทะลวงแนว/ป้องกัน", description: "ควบคุมระยะด้วยหอกยาว พุ่งทะลวงและคุ้มกันแนวหลัง", hitDie: 10, primary: "strength" as StatKey, color: "#6d8190" },
] as const;

export const PROFESSIONS=[
  {id:"chef",label:"เชฟ",icon:"♨",bonus:"ปรุงอาหารสำเร็จเพิ่ม 5–10%",description:"ดึงรสชาติและคุณค่าจากวัตถุดิบ"},
  {id:"chronicler",label:"นักจดบันทึก",icon:"✎",bonus:"ค้นพบความรู้เพิ่ม 5–10%",description:"เก็บรายละเอียดอสูร ภาษา และเบาะแส"},
  {id:"blacksmith",label:"ช่างตีเหล็ก",icon:"⚒",bonus:"ตีบวกอุปกรณ์เพิ่ม 5–10%",description:"เข้าใจโลหะ อาวุธ และชุดเกราะ"},
  {id:"alchemist",label:"นักเล่นแร่แปรธาตุ",icon:"⚗",bonus:"ปรุงยาเพิ่ม 5–10%",description:"ควบคุมสารสกัดและปฏิกิริยาเวท"},
  {id:"merchant",label:"พ่อค้า",icon:"¤",bonus:"ต่อรองราคาเพิ่ม 5–10%",description:"ประเมินราคาและรักษาความสัมพันธ์"},
  {id:"scout",label:"นักสอดแนม",icon:"⌖",bonus:"ลดความเสี่ยงเดินทาง 5–10%",description:"อ่านทาง ร่องรอย และภัยซุ่มซ่อน"},
  {id:"cartographer",label:"นักทำแผนที่",icon:"⌑",bonus:"ค้นพบจุดสำรวจเพิ่ม 5–10%",description:"บันทึกภูมิประเทศและเส้นทางลัด"},
  {id:"rune_scholar",label:"นักอักษรรูน",icon:"ᚱ",bonus:"เริ่มพร้อมความรู้ภาษารูน",description:"อ่านและประยุกต์อักขระโบราณกับสกิล"},
]as const;

const CLASS_LINKS=[['fighter','barbarian'],['fighter','paladin'],['fighter','ranger'],['fighter','lancer'],['fighter','spellblade'],['ranger','rogue'],['ranger','druid'],['ranger','gunslinger'],['ranger','blood_hunter'],['wizard','artificer'],['wizard','necromancer'],['wizard','spellblade'],['wizard','summoner'],['cleric','paladin'],['cleric','druid'],['cleric','shaman'],['rogue','bard'],['rogue','gunslinger'],['rogue','blood_hunter'],['paladin','warlock'],['paladin','lancer'],['bard','sorcerer'],['bard','summoner'],['druid','barbarian'],['druid','shaman'],['monk','rogue'],['monk','cleric'],['monk','lancer'],['sorcerer','warlock'],['sorcerer','summoner'],['artificer','rogue'],['artificer','gunslinger'],['artificer','spellblade'],['necromancer','warlock'],['necromancer','blood_hunter'],['shaman','summoner'],['spellblade','lancer']]as const;
export function compatibleSecondaryClasses(primary:string){return CLASSES.filter(candidate=>CLASS_LINKS.some(pair=>pair.includes(primary as never)&&pair.includes(candidate.id as never)))}

export const APPEARANCE_OPTIONS = {
  skinTone: [
    { id: "porcelain", label: "งาช้าง", color: "#e7c5aa" },
    { id: "warm", label: "อุ่น", color: "#c88f69" },
    { id: "bronze", label: "บรอนซ์", color: "#996343" },
    { id: "deep", label: "เข้ม", color: "#65412f" },
    { id: "moss", label: "มอส", color: "#71815f" },
    { id: "moon", label: "แสงจันทร์", color: "#aeb5c5" },
  ],
  hairStyle: [
    { id: "short", label: "สั้นนักเดินทาง" },
    { id: "long", label: "ยาวพริ้ว" },
    { id: "braid", label: "ถักเปียนักรบ" },
    { id: "mohawk", label: "โมฮอว์ก" },
    { id: "bald", label: "ไร้เส้นผม" },
  ],
  hairColor: [
    { id: "raven", label: "ดำกา", color: "#171c1c" },
    { id: "chestnut", label: "เกาลัด", color: "#6f4330" },
    { id: "gold", label: "ทอง", color: "#c69a50" },
    { id: "silver", label: "เงิน", color: "#b9c0c2" },
    { id: "ember", label: "เพลิง", color: "#9b4534" },
    { id: "violet", label: "ม่วงราตรี", color: "#514165" },
  ],
  face: [
    { id: "soft", label: "อ่อนโยน" },
    { id: "sharp", label: "คมเข้ม" },
    { id: "round", label: "กลมมน" },
  ],
  body: [
    { id: "slim", label: "เพรียว" },
    { id: "balanced", label: "สมส่วน" },
    { id: "broad", label: "กำยำ" },
  ],
  portraitBackdrop: [
    { id: "forest", label: "พงไพร" }, { id: "ember", label: "เปลวเพลิง" }, { id: "astral", label: "ดาราจักร" }, { id: "royal", label: "ราชสำนัก" },
  ],
  portraitFrame: [
    { id: "gold", label: "ทองโบราณ" }, { id: "thorn", label: "เถาหนาม" }, { id: "arcane", label: "รูนเวท" },
  ],
  portraitSigil: [
    { id: "class", label: "ตราอาชีพ" }, { id: "moon", label: "จันทรา" }, { id: "flame", label: "อัคคี" }, { id: "leaf", label: "พฤกษา" }, { id: "crown", label: "มงกุฎ" },
  ],
} as const;

export type Appearance = {
  skinTone: (typeof APPEARANCE_OPTIONS.skinTone)[number]["id"];
  hairStyle: (typeof APPEARANCE_OPTIONS.hairStyle)[number]["id"];
  hairColor: (typeof APPEARANCE_OPTIONS.hairColor)[number]["id"];
  face: (typeof APPEARANCE_OPTIONS.face)[number]["id"];
  body: (typeof APPEARANCE_OPTIONS.body)[number]["id"];
  portraitBackdrop?: (typeof APPEARANCE_OPTIONS.portraitBackdrop)[number]["id"];
  portraitFrame?: (typeof APPEARANCE_OPTIONS.portraitFrame)[number]["id"];
  portraitSigil?: (typeof APPEARANCE_OPTIONS.portraitSigil)[number]["id"];
  customPortraitPath?: string;
};

export const DEFAULT_STATS: Stats = { strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 };
export const DEFAULT_APPEARANCE: Appearance = { skinTone: "warm", hairStyle: "short", hairColor: "raven", face: "soft", body: "balanced",portraitBackdrop:"forest",portraitFrame:"gold",portraitSigil:"class" };

export function findRace(id: string) { return RACES.find((race) => race.id === id); }
export function findClass(id: string) { return CLASSES.find((item) => item.id === id); }
export function findProfession(id:string){return PROFESSIONS.find(item=>item.id===id)}
export function isCompatibleClass(primary:string,secondary:string){return compatibleSecondaryClasses(primary).some(item=>item.id===secondary)}
