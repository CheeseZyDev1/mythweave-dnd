"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { findClass } from "../../lib/characters/catalog";
type Skill = {
  id: number;
  name_th: string;
  description_th: string;
  effect_type: string;
  source_kind: string;
};
type Rune = {
  id: number;
  name_th: string;
  language_id: string;
  effect_type: string;
  bonus_value: number;
  description_th: string;
  rarity: string;
};
type Language = {
  id: string;
  name_th: string;
  rarity: string;
  description_th: string;
  learned_via: string;
  source_note: string | null;
};
type RuneRecord={language_id:string;discovered_at:string;studied_at:string|null;language:Omit<Language,"learned_via"|"source_note">};
export function ProgressionWorkshop({
  character,
  calling,
  skills,
  languages,
  records,
  ownedRunes,
  runes,
  bindings,
  lastSearch,
}: {
  character: {
    id: string;
    name: string;
    level: number;
    character_class: string;
  };
  calling: {
    secondary_class: string | null;
    profession_rank: number;
    profession: {
      id: string;
      name_th: string;
      icon: string;
      description_th: string;
      bonus_label_th: string;
    } | null;
  } | null;
  skills: Skill[];
  languages: Language[];
  records: RuneRecord[];
  ownedRunes: Array<{ rune_id: number; quantity: number; rune: Rune }>;
  runes: Rune[];
  bindings: Array<{ skill_id: number; rune_id: number }>;
  lastSearch: {
    created_at: string;
    result_type: string;
    result_name: string | null;
  } | null;
}) {
  const [first, setFirst] = useState(String(skills[0]?.id ?? "")),
    [second, setSecond] = useState(String(skills[1]?.id ?? "")),
    [skillId, setSkillId] = useState(String(skills[0]?.id ?? "")),
    [runeId, setRuneId] = useState(String(ownedRunes[0]?.rune_id ?? "")),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState("");
  const known = new Set(languages.map((item) => item.id));
  const usableRunes = ownedRunes.filter((item) =>
    known.has(item.rune.language_id),
  );
  const nextRank =
    calling?.profession_rank === 1
      ? 5
      : calling?.profession_rank === 2
        ? 10
        : null;
  const cooldown = lastSearch
    ? Math.max(
        0,
        new Date(lastSearch.created_at).getTime() + 6 * 3600000 - Date.now(),
      )
    : 0;
  const bound = useMemo(
    () => new Map(bindings.map((item) => [item.skill_id, item.rune_id])),
    [bindings],
  );
  async function act(action: string, payload: Record<string, unknown> = {}) {
    setBusy(action);
    setMessage("");
    try {
      const response = await fetch("/api/progression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, characterId: character.id, ...payload }),
      });
      const body = await response.json();
      if (!response.ok) {
        const errors: Record<string, string> = {
          language_required: "ยังอ่านภาษาของรูนนี้ไม่ออก",
          cooldown: "ค้นหาร่องรอยรูนได้ทุก 6 ชั่วโมง",
          different_skills: "ต้องเลือกคนละสกิล",
          fusion_limit: "สร้างสกิลผสมครบ 6 สกิลแล้ว",
          level_required: `ต้องถึงเลเวล ${nextRank ?? 10} ก่อนเพิ่มความถนัด`,
          max_rank: "ความถนัดสูงสุดแล้ว",
        };
        throw new Error(errors[body.error] ?? "ดำเนินการไม่สำเร็จ");
      }
      if (action === "search_runes")
        setMessage(
          body.result.type === "nothing"
            ? "พบเพียงเศษรอยสลักที่อ่านไม่ได้ — ลองใหม่ภายหลัง"
            : `ค้นพบ ${body.result.name}`,
        );
      else setMessage("สำเร็จ · กำลังอัปเดตหน้าความสามารถ");
      window.setTimeout(() => location.reload(), 550);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }
  return (
    <main className="progression-shell">
      <header>
        <Link href={`/characters/${character.id}`}>← Character Sheet</Link>
        <span>MYTHWEAVE · CALLINGS & RUNES</span>
        <i>{character.name}</i>
      </header>
      <section className="progression-hero">
        <small>BUILD · CRAFT · DECIPHER</small>
        <h1>เส้นทางและศาสตร์ประยุกต์</h1>
        <p>
          คลาสรองไม่แทนที่ตัวตนหลัก อาชีพชีวิตเติบโตตามเลเวล
          และรูนใช้ได้ต่อเมื่ออ่านภาษาของมันออก
        </p>
      </section>
      {message && <p className="progression-message">{message}</p>}
      <section className="calling-overview">
        <article>
          <small>PRIMARY CALLING</small>
          <b>
            {findClass(character.character_class)?.icon}{" "}
            {findClass(character.character_class)?.label}
          </b>
          <span>คลาสหลัก · Level {character.level}</span>
        </article>
        <article>
          <small>SECONDARY CALLING</small>
          <b>
            {calling?.secondary_class
              ? `${findClass(calling.secondary_class)?.icon} ${findClass(calling.secondary_class)?.label}`
              : "ไม่ได้ผสมคลาส"}
          </b>
          <span>
            {calling?.secondary_class
              ? "ได้รับ 1 สกิลข้ามสาย"
              : "เลือกได้ตอนสร้างตัวละคร"}
          </span>
        </article>
        <article>
          <small>LIFE PROFESSION</small>
          <b>
            {calling?.profession?.icon}{" "}
            {calling?.profession?.name_th ?? "ยังไม่มี"}
          </b>
          <span>
            {calling?.profession?.bonus_label_th} +
            {(calling?.profession_rank ?? 1) === 1
              ? 5
              : (calling?.profession_rank ?? 1) === 2
                ? 7
                : 10}
            % · Rank {calling?.profession_rank ?? 1}
          </span>
          {calling && (
            <button
              disabled={
                busy !== "" ||
                nextRank === null ||
                character.level < (nextRank ?? 99)
              }
              onClick={() => act("train_profession")}
            >
              {nextRank === null
                ? "ชำนาญสูงสุด"
                : `ฝึกขั้นถัดไป · Lv.${nextRank}`}
            </button>
          )}
        </article>
      </section>
      <section className="progression-grid">
        <article className="fusion-lab">
          <header>
            <small>SKILL FUSION</small>
            <h2>หลอมกระบวนท่า</h2>
          </header>
          <p>
            รวมแก่นของสองสกิลเป็นสกิลเฉพาะตัว ใช้ได้ 1
            ครั้งต่อการพักสั้นและปรากฏในห้องต่อสู้ทันที
          </p>
          <select
            value={first}
            onChange={(event) => setFirst(event.target.value)}
          >
            {skills.map((skill) => (
              <option value={skill.id} key={skill.id}>
                {skill.name_th} · {skill.effect_type}
              </option>
            ))}
          </select>
          <b>×</b>
          <select
            value={second}
            onChange={(event) => setSecond(event.target.value)}
          >
            {skills.map((skill) => (
              <option value={skill.id} key={skill.id}>
                {skill.name_th} · {skill.effect_type}
              </option>
            ))}
          </select>
          <button
            disabled={busy !== "" || !first || !second || first === second}
            onClick={() =>
              act("fuse", {
                firstSkillId: Number(first),
                secondSkillId: Number(second),
              })
            }
          >
            หลอมเป็นสกิลใหม่
          </button>
          <div>
            {skills
              .filter((skill) => skill.source_kind === "fusion")
              .map((skill) => (
                <span key={skill.id}>
                  <strong>{skill.name_th}</strong>
                  <small>{skill.description_th}</small>
                </span>
              ))}
          </div>
        </article>
        <article className="rune-lab">
          <header>
            <small>RUNIC APPLICATION</small>
            <h2>โต๊ะประยุกต์รูน</h2>
          </header>
          <p>
            รูนอาจถูกพบแม้อ่านไม่ออก
            แต่จะผูกกับสกิลไม่ได้จนกว่าจะเรียนภาษาที่เกี่ยวข้อง
          </p>
          <div className="language-list">
            {languages.map((language) => (
              <span key={language.id}>
                <b>{language.name_th}</b>
                <small>{language.learned_via === "formal_training" ? "เรียนจากสำนัก" : language.learned_via === "rune_record" ? "ถอดความจากบันทึก" : "ความรู้เดิม"} · {language.rarity}</small>
              </span>
            ))}
            {!languages.length && (
              <i>ยังไม่รู้ภาษารูน — มีโอกาสพบจากการสำรวจ</i>
            )}
          </div>
          {records.some(record=>!record.studied_at)&&<div className="rune-records">{records.filter(record=>!record.studied_at).map(record=><article key={record.language_id}><b>บันทึก {record.language.name_th}</b><small>พบแล้ว แต่ต้องศึกษาก่อนจึงจะอ่านและใช้รูนได้</small><button disabled={busy!==""}onClick={()=>act("study_rune",{languageId:record.language_id})}>ศึกษาบันทึก</button></article>)}</div>}
          <button
            disabled={busy !== "" || cooldown > 0}
            onClick={() => act("search_runes")}
          >
            {cooldown > 0 ? "ค้นหาได้อีกครั้งภายหลัง" : "สำรวจหาร่องรอยรูน"}
          </button>
          <div className="rune-bind">
            <select
              value={skillId}
              onChange={(event) => setSkillId(event.target.value)}
            >
              {skills.map((skill) => (
                <option value={skill.id} key={skill.id}>
                  {skill.name_th}
                  {bound.has(skill.id) ? " · มีรูนแล้ว" : ""}
                </option>
              ))}
            </select>
            <select
              value={runeId}
              onChange={(event) => setRuneId(event.target.value)}
            >
              <option value="">เลือกรูนที่อ่านออก</option>
              {usableRunes.map((item) => (
                <option value={item.rune_id} key={item.rune_id}>
                  {item.rune.name_th} +{item.rune.bonus_value}
                </option>
              ))}
            </select>
            <button
              disabled={busy !== "" || !skillId || !runeId}
              onClick={() =>
                act("bind_rune", {
                  skillId: Number(skillId),
                  runeId: Number(runeId),
                })
              }
            >
              ผูกรูนกับสกิล
            </button>
          </div>
          <div className="rune-catalog">
            {runes.map((rune) => {
              const owned = ownedRunes.find((item) => item.rune_id === rune.id);
              return (
                <span
                  className={
                    owned
                      ? known.has(rune.language_id)
                        ? "usable"
                        : "locked"
                      : "unknown"
                  }
                  key={rune.id}
                >
                  <b>{owned ? rune.name_th : "รูนที่ยังไม่ค้นพบ"}</b>
                  <small>
                    {owned
                      ? known.has(rune.language_id)
                        ? `${rune.description_th} · มี ${owned.quantity}`
                        : "พบแล้ว แต่ยังอ่านภาษาไม่ออก"
                      : rune.rarity}
                  </small>
                </span>
              );
            })}
          </div>
        </article>
      </section>
    </main>
  );
}
