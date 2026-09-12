import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ — Mythweave" };

async function isGoogleEnabled(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return false;
  try{const response=await fetch(`${url}/auth/v1/settings`,{headers:{apikey:key},cache:"no-store"});if(!response.ok)return false;const settings=await response.json()as{external?:{google?:boolean}};return Boolean(settings.external?.google)}catch{return false}
}

export default async function AuthPage() {
  const googleEnabled=await isGoogleEnabled();
  return (
    <main className="auth-shell">
      <section className="auth-art">
        <div className="auth-art-copy">
          <Link href="/">MYTHWEAVE</Link>
          <h1>ทุกตำนาน<br />เริ่มจากผู้ผจญภัย</h1>
          <p>สร้างบัญชีครั้งเดียว แล้วกลับมาเล่นตัวละคร ห้อง และเรื่องราวเดิมต่อได้จากทุกที่</p>
        </div>
      </section>
      <section className="auth-panel"><AuthForm googleEnabled={googleEnabled}/></section>
    </main>
  );
}
