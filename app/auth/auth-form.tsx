"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type Mode = "login" | "signup";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "error" | "success"; text: string } | null>(null);

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setNotice(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const displayName = String(form.get("displayName") ?? "").trim();

    if (password.length < 8) {
      setNotice({ type: "error", text: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
      setLoading(false);
      return;
    }

    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setNotice({ type: "error", text: "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองอีกครั้ง" });
        setLoading(false);
        return;
      }
    } else {
      if (displayName.length < 2 || displayName.length > 24) {
        setNotice({ type: "error", text: "ชื่อผู้เล่นต้องยาว 2-24 ตัวอักษร" });
        setLoading(false);
        return;
      }

      const redirectTo = `${window.location.origin}/auth/callback?next=/lobby`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo, data: { display_name: displayName } },
      });

      if (error) {
        setNotice({ type: "error", text: error.message === "User already registered" ? "อีเมลนี้ถูกใช้งานแล้ว" : "สมัครไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองใหม่" });
        setLoading(false);
        return;
      }

      if (!data.session) {
        setNotice({ type: "success", text: "ส่งลิงก์ยืนยันแล้ว กรุณาตรวจอีเมลก่อนเข้าสู่ระบบ" });
        setLoading(false);
        return;
      }
    }

    router.replace("/lobby");
    router.refresh();
  }

  return (
    <div className="auth-card">
      <span className="auth-kicker">PLAYER ACCESS</span>
      <h2>{mode === "login" ? "กลับสู่การผจญภัย" : "สร้างบัญชีผู้เล่น"}</h2>
      <p className="auth-subtitle">ข้อมูลการเล่นจะผูกกับบัญชีนี้และบันทึกไว้อัตโนมัติ</p>
      <div className="auth-tabs" role="tablist" aria-label="เลือกรูปแบบเข้าสู่ระบบ">
        <button className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")} role="tab" type="button">เข้าสู่ระบบ</button>
        <button className={mode === "signup" ? "active" : ""} onClick={() => changeMode("signup")} role="tab" type="button">สมัครสมาชิก</button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        {mode === "signup" && <label className="auth-field"><span>ชื่อผู้เล่น</span><input autoComplete="nickname" maxLength={24} name="displayName" placeholder="ชื่อที่เพื่อนจะเห็น" required /></label>}
        <label className="auth-field"><span>อีเมล</span><input autoComplete="email" name="email" placeholder="adventurer@example.com" required type="email" /></label>
        <label className="auth-field"><span>รหัสผ่าน</span><input autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} name="password" placeholder="อย่างน้อย 8 ตัวอักษร" required type="password" /></label>
        <button className="auth-submit" disabled={loading} type="submit">{loading ? "กำลังเปิดประตู..." : mode === "login" ? "เข้าสู่ Mythweave" : "สร้างบัญชี"}</button>
      </form>
      <div aria-live="polite" className={`auth-note ${notice?.type ?? ""}`}>{notice?.text ?? "ใช้บัญชีนี้สำหรับตัวละคร ห้อง และเซฟเกมทั้งหมดของคุณ"}</div>
      <p className="auth-legal">การสมัครหมายถึงคุณยอมรับว่าจะใช้ห้องเล่นอย่างสุภาพต่อสมาชิกปาร์ตี้คนอื่น</p>
    </div>
  );
}
