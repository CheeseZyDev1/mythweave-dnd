import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ — Mythweave" };

export default function AuthPage() {
  return (
    <main className="auth-shell">
      <section className="auth-art">
        <div className="auth-art-copy">
          <Link href="/">MYTHWEAVE</Link>
          <h1>ทุกตำนาน<br />เริ่มจากผู้ผจญภัย</h1>
          <p>สร้างบัญชีครั้งเดียว แล้วกลับมาเล่นตัวละคร ห้อง และเรื่องราวเดิมต่อได้จากทุกที่</p>
        </div>
      </section>
      <section className="auth-panel"><AuthForm /></section>
    </main>
  );
}
