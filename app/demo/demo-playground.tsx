"use client";
import Link from "next/link";
import { useState } from "react";
import {
  getRollTier,
  ROLL_FEEDBACK,
  type RollTier,
} from "../../lib/dice/feedback";
const runes = [
  { id: "flame", mark: "ᚲ", name: "รูนประกายเพลิง", language: "อักษรฟูธาร์ก" },
  { id: "ward", mark: "ᛉ", name: "รูนกำแพงพฤกษา", language: "อักษรซิลวาน" },
  { id: "echo", mark: "ᛞ", name: "รูนเสียงสะท้อน", language: "อักษรซิลวาน" },
];
export function DemoPlayground() {
  const [die, setDie] = useState(20),
    [rolling, setRolling] = useState(false),
    [rollTier, setRollTier] = useState<RollTier | null>(null),
    [enemyHp, setEnemyHp] = useState(32),
    [attacker, setAttacker] = useState<"hero" | "enemy" | null>(null),
    [records, setRecords] = useState<string[]>([]),
    [known, setKnown] = useState<string[]>([]),
    [log, setLog] = useState(
      "เลือกทดลองระบบใดระบบหนึ่งได้เลย ข้อมูลหน้านี้จะไม่ถูกบันทึก",
    );
  function roll() {
    setRolling(true);
    setRollTier(null);
    let ticks = 0;
    const timer = window.setInterval(() => {
      const result = 1 + Math.floor(Math.random() * 20);
      setDie(result);
      if (++ticks > 8) {
        window.clearInterval(timer);
        const tier = getRollTier({
          dice_count: 1,
          dice_sides: 20,
          rolls: [result],
        });
        const feedback = ROLL_FEEDBACK[tier];
        setRollTier(tier);
        setRolling(false);
        window.dispatchEvent(
          new CustomEvent("mythweave:dice-sfx", { detail: { tier } }),
        );
        setLog(
          `${feedback.emoji} ทอยได้ ${result} · ${feedback.label} — ${feedback.message}`,
        );
      }
    }, 55);
  }
  function attack(side: "hero" | "enemy") {
    setAttacker(side);
    window.setTimeout(() => {
      if (side === "hero") {
        const damage = 4 + Math.floor(Math.random() * 7);
        setEnemyHp((hp) => Math.max(0, hp - damage));
        setLog(
          `ดาบวายุโจมตี ${damage} ดาเมจ · ในเกมจริง DM ยังแทรกเหตุการณ์สำคัญได้`,
        );
      } else setLog("โกเลมหินสวนกลับ แต่เกราะลดความเสียหายบางส่วน");
      setAttacker(null);
    }, 340);
  }
  function discover() {
    const available = runes.filter((rune) => !records.includes(rune.language));
    if (!available.length) {
      setLog("พบบันทึกครบทุกภาษาสำหรับ Demo แล้ว");
      return;
    }
    const rune = available[Math.floor(Math.random() * available.length)];
    setRecords((current) => [...current, rune.language]);
    setLog(`พบบันทึกภาษา ${rune.language} — ยังใช้รูนไม่ได้จนกว่าจะกดศึกษา`);
  }
  function study(language: string) {
    setKnown((current) =>
      current.includes(language) ? current : [...current, language],
    );
    setLog(`ศึกษาบันทึกสำเร็จ ตอนนี้อ่าน ${language} และใช้รูนภาษานี้ได้แล้ว`);
  }
  return (
    <main className="demo-shell">
      <header>
        <Link href="/">← หน้าแรก</Link>
        <b>MYTHWEAVE · TRY BEFORE YOU JOIN</b>
        <span>ไม่ต้องล็อกอิน · ไม่สร้างเซฟ</span>
      </header>
      <section className="demo-hero">
        <small>INTERACTIVE PREVIEW</small>
        <h1>ลองสัมผัสโลกก่อนออกเดินทาง</h1>
        <p>
          สนามทดลองขนาดเล็กสำหรับผู้ที่สนใจ ลองทอยเต๋า การต่อสู้แบบมีจังหวะ
          และกฎการเรียนรูน โดยไม่กระทบข้อมูลเกมจริง
        </p>
        <Link className="demo-join" href="/auth">
          พร้อมแล้ว — เข้าเล่นจริง →
        </Link>
      </section>
      <section className="demo-grid">
        <article className="demo-card">
          <header>
            <small>REAL-TIME DICE</small>
            <span>d20</span>
          </header>
          <h2>ทดลองทอยเต๋า</h2>
          <div className="demo-dice">
            <div
              className={`dice-cast demo-dice-cast ${rollTier ?? "neutral"} ${rolling ? "rolling" : "settled"}`}
            >
              <i className="dice-trail" aria-hidden="true" />
              <b className="animated-die">
                <span>{die}</span>
              </b>
              {rollTier && !rolling && (
                <strong
                  className="roll-emote"
                  aria-label={ROLL_FEEDBACK[rollTier].label}
                >
                  {ROLL_FEEDBACK[rollTier].emoji}
                </strong>
              )}
            </div>
            <button disabled={rolling} onClick={roll}>
              ทอย d20
            </button>
          </div>
          <p>🎲 มีเสียงแยกตามระดับผลทอย · กด ♫ มุมจอเพื่อเปิดและปรับเสียง</p>
        </article>
        <article className="demo-card">
          <header>
            <small>RUNE KNOWLEDGE</small>
            <span>{known.length} ภาษา</span>
          </header>
          <h2>ค้นพบก่อน จึงเรียนรู้</h2>
          <button onClick={discover}>สำรวจหาบันทึกรูน</button>
          <div className="demo-runes">
            {runes.map((rune) => (
              <button
                className={known.includes(rune.language) ? "known" : ""}
                disabled={
                  !records.includes(rune.language) ||
                  known.includes(rune.language)
                }
                key={rune.id}
                onClick={() => study(rune.language)}
              >
                <b>{rune.mark}</b>
                <span>{rune.name}</span>
                <small>
                  {known.includes(rune.language)
                    ? "อ่านออกแล้ว"
                    : records.includes(rune.language)
                      ? "พบบันทึก · กดเพื่อศึกษา"
                      : "ยังไม่พบความรู้"}
                </small>
              </button>
            ))}
          </div>
        </article>
        <article className="demo-card wide">
          <header>
            <small>TIMING COMBAT</small>
            <span>ฉากจำลอง</span>
          </header>
          <h2>สนามต่อสู้สองฝั่ง</h2>
          <div className="demo-fighters">
            <div
              className={`demo-fighter ${attacker === "hero" ? "attack" : ""}`}
            >
              <i>🧙</i>
              <b>นักเวทฝึกหัด</b>
              <button
                disabled={attacker !== null || enemyHp === 0}
                onClick={() => attack("hero")}
              >
                ใช้สกิลโจมตี
              </button>
            </div>
            <b>VS</b>
            <div
              className={`demo-fighter enemy ${attacker === "enemy" ? "attack" : ""}`}
            >
              <i>🗿</i>
              <b>โกเลมหิน · {enemyHp}/32 HP</b>
              <div className="demo-hp">
                <span style={{ width: `${(enemyHp / 32) * 100}%` }} />
              </div>
              <button
                disabled={attacker !== null || enemyHp === 0}
                onClick={() => attack("enemy")}
              >
                จำลองศัตรูโจมตี
              </button>
            </div>
          </div>
        </article>
        <article className="demo-card wide">
          <header>
            <small>EVENT LOG</small>
          </header>
          <div className="demo-log" aria-live="polite">
            {enemyHp === 0
              ? "โกเลมหินพ่ายแพ้ — สนามทดลองพร้อมเริ่มใหม่เมื่อรีเฟรชหน้า"
              : log}
          </div>
        </article>
      </section>
    </main>
  );
}
