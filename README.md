# Mythweave D&D

เว็บโต๊ะ D&D ออนไลน์สำหรับกลุ่มเพื่อน 2–5 คน สร้างด้วย Next.js, Tailwind CSS และ Supabase บนแผนฟรี

เล่นออนไลน์: https://mythweave-dnd.vercel.app

## สถานะปัจจุบัน

Roadmap Phase 0–12 เสร็จและ deploy แล้ว ฟีเจอร์หลักประกอบด้วย:

- Next.js App Router, Tailwind CSS 4, Supabase Auth/Database/Realtime และ Vercel
- Character Forge/Sheet, Portrait Studio, เผ่า คลาส innate ability, inventory, wallet และ status
- ห้องส่วนตัวด้วยรหัสและ role Player / DM / Spectator พร้อม save/load, chat, dice และ initiative แบบ real-time
- World map, การเดินทางหลายรูปแบบ, กลางวัน/กลางคืน, อากาศ, NPC schedule และ random encounter
- Quest, shop/trade, haggling, crafting, procedural item/monster, faction, guild และ Codex/Bestiary
- Solo/ghost/companion, death/permadeath, persistent party, player trade และ party voting
- Timing combat, environmental interaction, pet/companion, shared World Boss และ Admin God Mode
- Dimension presets, stamina/fatigue, RNG mode, achievements, dungeon generator และ Interactive VTT/fog of war
- Session recap, safe rollback, Dice Chronicle, customizable theme, Howler audio mixer และ Framer Motion
- Row Level Security และ server-authoritative transaction สำหรับข้อมูลสำคัญ

ขอบเขตเนื้อหาโลกอยู่ที่ [`docs/world-content-scope.md`](docs/world-content-scope.md)

## เปิดบนเครื่อง

ต้องมี Node.js 22 จากนั้นสร้าง `.env.local` ตาม `.env.example` แล้วรัน:

```powershell
npm install
npm run dev
```

เปิด `http://localhost:3000`

## ตรวจสอบก่อน deploy

```powershell
npm run lint
npm run build
```

Supabase migrations อยู่ใน `supabase/migrations` และใช้คำสั่งนี้กับ project ที่ link แล้ว:

```powershell
npx supabase db push --linked
```

## สถานะ Roadmap

Phase 0–12 เสร็จครบแล้ว ขั้นถัดไปคือ playtest กับผู้เล่นจริง 2–5 คน แล้วเก็บ feedback เพื่อจัดลำดับ balance/content expansion รอบใหม่
