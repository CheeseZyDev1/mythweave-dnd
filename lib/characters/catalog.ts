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
] as const;

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
} as const;

export type Appearance = {
  skinTone: (typeof APPEARANCE_OPTIONS.skinTone)[number]["id"];
  hairStyle: (typeof APPEARANCE_OPTIONS.hairStyle)[number]["id"];
  hairColor: (typeof APPEARANCE_OPTIONS.hairColor)[number]["id"];
  face: (typeof APPEARANCE_OPTIONS.face)[number]["id"];
  body: (typeof APPEARANCE_OPTIONS.body)[number]["id"];
};

export const DEFAULT_STATS: Stats = { strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 };
export const DEFAULT_APPEARANCE: Appearance = { skinTone: "warm", hairStyle: "short", hairColor: "raven", face: "soft", body: "balanced" };

export function findRace(id: string) { return RACES.find((race) => race.id === id); }
export function findClass(id: string) { return CLASSES.find((item) => item.id === id); }
