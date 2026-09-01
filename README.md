# Mythweave D&D

เว็บโต๊ะ D&D ออนไลน์สำหรับกลุ่มเพื่อน 2–5 คน สร้างด้วย Next.js, Tailwind CSS และ Supabase บนแผนฟรี

เล่นออนไลน์: https://mythweave-dnd.vercel.app

## สถานะปัจจุบัน

- Next.js App Router + Tailwind CSS 4
- สมัครสมาชิก/เข้าสู่ระบบด้วย Supabase Auth
- Character Forge: เผ่า คลาส point-buy stats และรูปลักษณ์
- Character Sheet: HP, ability scores, derived stats และ inventory
- ห้องส่วนตัวด้วยรหัส พร้อม role Player / DM / Spectator
- ทอยเต๋า, Initiative, แชต, NPC dialogue และคำบรรยาย DM แบบ real-time
- Save/load ห้อง 3 slots พร้อม Quest, Wallet, Shop และ Status Effects
- Manual AI DM Console: สร้าง context ล่าสุดและเผยแพร่คำตอบ โดยไม่เสียค่า API
- Static content เริ่มต้น: item 65, dialogue 32, quest 30 และ event 15
- Row Level Security: ผู้เล่นอ่านและแก้ไขได้เฉพาะตัวละครของตนเอง
- Deploy อัตโนมัติจาก GitHub ไป Vercel

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

## ลำดับถัดไป

Phase 0–2 เสร็จแล้ว ลำดับถัดไปคือ Phase 3: ต่อราคา → NPC/Guild affinity → ทำอาหาร/ปรุงยา → procedural item และ monster
