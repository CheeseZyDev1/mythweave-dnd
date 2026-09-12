"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type Mode = "login" | "signup";

export function AuthForm({googleEnabled}:{googleEnabled:boolean}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "error" | "success"; text: string } | null>(null);

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setNotice(null);
  }

  async function signInWithGoogle() {
    if(!googleEnabled)return;
    setLoading(true);
    setNotice(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=/lobby`;
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) {
      setNotice({ type: "error", text: error.message.toLowerCase().includes("provider") ? "Google Login ยังรอการเชื่อมกุญแจ Google Cloud ของเจ้าของเว็บ" : "เปิด Google Login ไม่สำเร็จ กรุณาลองอีกครั้ง" });
      setLoading(false);
    }
  }

  async function playAsGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice(null);
    const displayName = String(new FormData(event.currentTarget).get("guestName") ?? "").trim();
    if (displayName.length < 2 || displayName.length > 24) {
      setNotice({ type: "error", text: "ชื่อผู้เล่นต้องยาว 2-24 ตัวอักษร" });
      setLoading(false);
      return;
    }
    const { error } = await createClient().auth.signInAnonymously({ options: { data: { display_name: displayName } } });
    if (error) {
      setNotice({ type: "error", text: "เข้าเล่นแบบ Guest ไม่สำเร็จ กรุณาลองอีกครั้ง" });
      setLoading(false);
      return;
    }
    router.replace("/lobby");
    router.refresh();
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
      <p className="auth-subtitle">เลือกทางเข้าที่สะดวก แล้วเริ่มสร้างตัวละครได้ทันที</p>
      <button className="auth-google" disabled={loading||!googleEnabled} onClick={signInWithGoogle} type="button"><i aria-hidden="true">G</i><span>{googleEnabled?"เล่นต่อด้วย Google":"Google Login · รอเชื่อม Google Cloud"}</span></button>
      <div className="auth-divider"><span>หรือเข้าเกมทันที</span></div>
      <form className="auth-guest" onSubmit={playAsGuest}>
        <label className="auth-field"><span>ชื่อผู้เล่น Guest</span><input autoComplete="nickname" maxLength={24} minLength={2} name="guestName" placeholder="ชื่อที่เพื่อนจะเห็น" required /></label>
        <button disabled={loading} type="submit">{loading ? "กำลังเปิดประตู..." : "เล่นแบบ Guest →"}</button>
      </form>
      <p className="auth-guest-warning">⚠ Guest เล่นและเซฟได้บนเบราว์เซอร์นี้ แต่อย่าออกจากระบบหรือล้างข้อมูลก่อนผูกบัญชีถาวร</p>
      <details className="auth-classic"><summary>เข้าสู่ระบบด้วยอีเมล</summary>
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
      </details>
      <div aria-live="polite" className={`auth-note ${notice?.type ?? ""}`}>{notice?.text ?? "ใช้บัญชีนี้สำหรับตัวละคร ห้อง และเซฟเกมทั้งหมดของคุณ"}</div>
      <p className="auth-legal">การสมัครหมายถึงคุณยอมรับว่าจะใช้ห้องเล่นอย่างสุภาพต่อสมาชิกปาร์ตี้คนอื่น</p>
    </div>
  );
}
