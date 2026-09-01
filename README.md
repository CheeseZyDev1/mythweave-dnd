# Mythweave D&D

เว็บโต๊ะ D&D ออนไลน์สำหรับกลุ่มเพื่อน 2–5 คน สร้างด้วย Next.js, Tailwind CSS และ Supabase บนแผนฟรี

เล่นออนไลน์: https://mythweave-dnd.vercel.app

## สถานะปัจจุบัน

- Next.js App Router + Tailwind CSS 4
- สมัครสมาชิก/เข้าสู่ระบบด้วย Supabase Auth
- Character Forge: เผ่า คลาส point-buy stats และรูปลักษณ์
- Character Sheet: HP, ability scores, derived stats และ inventory
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

ทำตาม Phase 1 ทีละรายการ: Dice Roller real-time → Initiative Tracker → Room code/roles → Chat → Save/load room state จากนั้นจึงเริ่มระบบโลกตาม content scope
