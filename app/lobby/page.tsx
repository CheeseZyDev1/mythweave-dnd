import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { LogoutButton } from "./logout-button";

export const metadata: Metadata = { title: "ล็อบบี้ — Mythweave" };

export default async function LobbyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const displayName = String(user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "Adventurer");

  return (
    <main className="lobby-shell">
      <header className="lobby-topbar"><span className="lobby-brand">MYTHWEAVE</span><LogoutButton /></header>
      <section className="lobby-content">
        <span className="lobby-kicker">ADVENTURER VERIFIED</span>
        <h1>ยินดีต้อนรับ<br />{displayName}</h1>
        <p>บัญชีของคุณพร้อมแล้ว ขั้นต่อไปคือสร้างตัวละคร เลือกเผ่าและอาชีพ ก่อนเข้าสู่ห้องผจญภัยกับเพื่อน</p>
        <div className="lobby-identity"><small>บัญชีที่กำลังใช้งาน</small><strong>{user.email}</strong></div>
        <div className="lobby-next">
          <article><span>01 · NEXT</span><h2>สร้างตัวละคร</h2><p>เลือกเผ่า คลาส ค่าสถานะ และรูปลักษณ์เริ่มต้น</p></article>
          <article><span>02 · PLANNED</span><h2>เลือกเซฟ</h2><p>เริ่มการผจญภัยใหม่หรือกลับไปยังเรื่องราวเดิม</p></article>
          <article><span>03 · PLANNED</span><h2>เข้าห้องปาร์ตี้</h2><p>ใช้รหัสห้องเพื่อพบเพื่อนอย่างปลอดภัย</p></article>
        </div>
      </section>
    </main>
  );
}
