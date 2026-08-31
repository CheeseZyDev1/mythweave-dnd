"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { APPEARANCE_OPTIONS, CLASSES, DEFAULT_APPEARANCE, DEFAULT_STATS, RACES, STAT_KEYS, STAT_LABELS, type Appearance, type StatKey, type Stats } from "../../../lib/characters/catalog";
import { abilityModifier, finalStats, pointBuyUsed, startingHp } from "../../../lib/characters/rules";
import { CharacterAvatar } from "../character-avatar";

const STEP_LABELS = ["ตัวตนและเผ่า", "เส้นทางอาชีพ", "รูปลักษณ์", "ค่าสถานะ"];

export function CharacterCreator() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [race, setRace] = useState("human");
  const [characterClass, setCharacterClass] = useState("fighter");
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedRace = RACES.find((item) => item.id === race) ?? RACES[0];
  const selectedClass = CLASSES.find((item) => item.id === characterClass) ?? CLASSES[0];
  const used = pointBuyUsed(stats);
  const remaining = 27 - used;
  const totals = useMemo(() => finalStats(stats, race), [stats, race]);
  const hp = startingHp(characterClass, totals);

  function chooseRace(nextRace: string) {
    setRace(nextRace);
    if (nextRace === "goblin") setAppearance((current) => ({ ...current, skinTone: "moss" }));
    if (nextRace === "fallen") setAppearance((current) => ({ ...current, skinTone: "moon" }));
  }

  function changeAppearance<Key extends keyof Appearance>(key: Key, value: Appearance[Key]) {
    setAppearance((current) => ({ ...current, [key]: value }));
  }

  function changeStat(key: StatKey, direction: -1 | 1) {
    setStats((current) => {
      const nextValue = current[key] + direction;
      if (nextValue < 8 || nextValue > 15) return current;
      const next = { ...current, [key]: nextValue };
      return pointBuyUsed(next) <= 27 ? next : current;
    });
  }

  function nextStep() {
    setError("");
    if (step === 0 && (name.trim().length < 2 || name.trim().length > 24)) {
      setError("ตั้งชื่อตัวละครให้ยาว 2-24 ตัวอักษรก่อนเดินทางต่อ");
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  }

  async function createCharacter() {
    if (remaining !== 0) {
      setError(`ยังเหลือแต้มค่าสถานะ ${remaining} แต้ม`);
      return;
    }
    setSaving(true);
    setError("");
    const response = await fetch("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, race, characterClass, appearance, stats }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const messages: Record<string, string> = { character_limit: "บัญชีนี้มีตัวละครครบ 10 ตัวแล้ว", invalid_stats: "ค่าสถานะไม่ถูกต้อง", invalid_name: "ชื่อตัวละครมีอักขระที่ไม่รองรับ" };
      setError(messages[result.error] ?? "บันทึกตัวละครไม่สำเร็จ กรุณาลองใหม่");
      setSaving(false);
      return;
    }
    router.replace("/lobby?created=1");
    router.refresh();
  }

  return (
    <main className="creator-shell">
      <header className="creator-topbar">
        <Link href="/lobby">← กลับล็อบบี้</Link>
        <span>MYTHWEAVE · CHARACTER FORGE</span>
        <small>STEP {step + 1} / 4</small>
      </header>
      <div className="creator-progress">{STEP_LABELS.map((label, index) => <button className={index === step ? "active" : index < step ? "done" : ""} key={label} onClick={() => index <= step && setStep(index)} type="button"><i>{index < step ? "✓" : index + 1}</i><span>{label}</span></button>)}</div>
      <section className="creator-layout">
        <div className="creator-workbench">
          {step === 0 && <div className="creator-stage">
            <span className="creator-kicker">01 · ORIGIN</span><h1>ตั้งชื่อและเลือกสายเลือด</h1><p>เผ่าจะเพิ่มค่าสถานะและกำหนดจุดเริ่มต้นของเรื่องราวในอนาคต</p>
            <label className="creator-name"><span>ชื่อตัวละคร</span><input autoFocus maxLength={24} onChange={(event) => setName(event.target.value)} placeholder="เช่น Aria Nightbloom" value={name} /></label>
            <div className="race-grid">{RACES.map((item) => <button className={race === item.id ? "selected" : ""} key={item.id} onClick={() => chooseRace(item.id)} type="button"><b>{item.icon}</b><span><strong>{item.label}</strong><small>{item.tagline}</small></span><em>{Object.entries(item.bonuses).map(([key, value]) => `+${value} ${STAT_LABELS[key as StatKey].short}`).join(" · ")}</em></button>)}</div>
          </div>}
          {step === 1 && <div className="creator-stage">
            <span className="creator-kicker">02 · CALLING</span><h1>เลือกเส้นทางแห่งการต่อสู้</h1><p>คลาสกำหนดบทบาทในปาร์ตี้ พลังชีวิตเริ่มต้น และค่าสถานะหลัก</p>
            <div className="class-grid">{CLASSES.map((item) => <button className={characterClass === item.id ? "selected" : ""} key={item.id} onClick={() => setCharacterClass(item.id)} type="button" style={{ "--class-color": item.color } as React.CSSProperties}><b>{item.icon}</b><span><strong>{item.label}</strong><small>{item.role}</small><em>{item.description}</em></span><i>d{item.hitDie}</i></button>)}</div>
          </div>}
          {step === 2 && <div className="creator-stage">
            <span className="creator-kicker">03 · APPEARANCE</span><h1>สลักใบหน้าของตำนาน</h1><p>รูปลักษณ์นี้จะกลายเป็น portrait และไอคอนประจำตัวของคุณบนแผนที่</p>
            <div className="appearance-groups">
              <AppearanceChoices title="สีผิว" items={APPEARANCE_OPTIONS.skinTone} selected={appearance.skinTone} onSelect={(value) => changeAppearance("skinTone", value as Appearance["skinTone"])} colors />
              <AppearanceChoices title="ทรงผม" items={APPEARANCE_OPTIONS.hairStyle} selected={appearance.hairStyle} onSelect={(value) => changeAppearance("hairStyle", value as Appearance["hairStyle"])} />
              <AppearanceChoices title="สีผม" items={APPEARANCE_OPTIONS.hairColor} selected={appearance.hairColor} onSelect={(value) => changeAppearance("hairColor", value as Appearance["hairColor"])} colors />
              <AppearanceChoices title="โครงหน้า" items={APPEARANCE_OPTIONS.face} selected={appearance.face} onSelect={(value) => changeAppearance("face", value as Appearance["face"])} />
              <AppearanceChoices title="รูปร่าง" items={APPEARANCE_OPTIONS.body} selected={appearance.body} onSelect={(value) => changeAppearance("body", value as Appearance["body"])} />
            </div>
          </div>}
          {step === 3 && <div className="creator-stage">
            <span className="creator-kicker">04 · ATTRIBUTES</span><h1>แบ่งแต้มกำหนดชะตา</h1><p>ใช้แต้มทั้ง 27 แต้ม ค่าพื้นฐานสูงสุด 15 ก่อนรับโบนัสจากเผ่า</p>
            <div className={`point-budget ${remaining === 0 ? "complete" : ""}`}><span>แต้มคงเหลือ</span><strong>{remaining}</strong><small>/ 27</small></div>
            <div className="stats-builder">{STAT_KEYS.map((key) => { const bonus = totals[key] - stats[key]; const modifier = abilityModifier(totals[key]); return <article key={key}><div><b>{STAT_LABELS[key].short}</b><span>{STAT_LABELS[key].label}</span></div><button disabled={stats[key] <= 8} onClick={() => changeStat(key, -1)} type="button">−</button><strong>{stats[key]}</strong><button disabled={stats[key] >= 15 || pointBuyUsed({ ...stats, [key]: stats[key] + 1 }) > 27} onClick={() => changeStat(key, 1)} type="button">+</button><em>{bonus > 0 ? `+${bonus} เผ่า` : "—"}</em><i>รวม {totals[key]} ({modifier >= 0 ? "+" : ""}{modifier})</i></article>})}</div>
          </div>}
          {error && <div className="creator-error" role="alert">{error}</div>}
          <div className="creator-actions"><button disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))} type="button">ย้อนกลับ</button>{step < 3 ? <button className="primary" onClick={nextStep} type="button">ขั้นถัดไป →</button> : <button className="primary" disabled={saving || remaining !== 0} onClick={createCharacter} type="button">{saving ? "กำลังจารึก..." : "ยืนยันและสร้างตัวละคร"}</button>}</div>
        </div>
        <aside className="creator-preview">
          <div className="avatar-frame"><CharacterAvatar appearance={appearance} characterClass={characterClass} name={name || "ผู้ไร้นาม"} race={race} /></div>
          <span className="preview-kicker">LIVE PORTRAIT</span><h2>{name.trim() || "ผู้ไร้นาม"}</h2><p>{selectedRace.label} · {selectedClass.label}</p>
          <div className="preview-vitals"><span><small>HP เริ่มต้น</small><strong>{hp}</strong></span><span><small>บทบาท</small><strong>{selectedClass.role}</strong></span></div>
          <blockquote>{selectedRace.description}</blockquote>
        </aside>
      </section>
    </main>
  );
}

type Choice = { readonly id: string; readonly label: string; readonly color?: string };
function AppearanceChoices({ title, items, selected, onSelect, colors = false }: { title: string; items: readonly Choice[]; selected: string; onSelect: (value: string) => void; colors?: boolean }) {
  return <section><h3>{title}</h3><div className="appearance-options">{items.map((item) => <button aria-label={item.label} className={selected === item.id ? "selected" : ""} key={item.id} onClick={() => onSelect(item.id)} type="button">{colors && item.color ? <i style={{ background: item.color }} /> : item.label}<span>{colors ? item.label : ""}</span></button>)}</div></section>;
}
