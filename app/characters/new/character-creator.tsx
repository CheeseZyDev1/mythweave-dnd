"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  APPEARANCE_OPTIONS,
  CLASSES,
  compatibleSecondaryClasses,
  DEFAULT_APPEARANCE,
  DEFAULT_STATS,
  PROFESSIONS,
  RACES,
  STAT_KEYS,
  STAT_LABELS,
  type Appearance,
  type StatKey,
  type Stats,
} from "../../../lib/characters/catalog";
import {
  abilityModifier,
  finalStats,
  pointBuyUsed,
  STARTING_POINT_BUDGET,
  STARTING_STAT_MAX,
  startingHp,
} from "../../../lib/characters/rules";
import { CharacterAvatar } from "../character-avatar";

const STEP_LABELS = ["ตัวตนและเผ่า", "เส้นทางอาชีพ", "รูปลักษณ์", "ค่าสถานะ"];
type CreatedCharacter = {
  id: string;
  starterItems: Array<{
    quantity: number;
    content_items: { name_th: string; category: string; rarity: string };
  }>;
  starterSkills: Array<{
    id: number;
    name_th: string;
    description_th: string;
    effect_type: string;
  }>;
  divineBlessing: {
    tier: number;
    name_th: string;
    deity_th: string;
    description_th: string;
  } | null;
};

export function CharacterCreator({
  dimensions,
}: {
  dimensions: Array<{
    id: string;
    slug: string;
    name_th: string;
    difficulty_label_th: string;
    accent_color: string;
  }>;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [dimensionId, setDimensionId] = useState(dimensions[0]?.id ?? "");
  const [race, setRace] = useState("human");
  const [characterClass, setCharacterClass] = useState("fighter");
  const [secondaryClass, setSecondaryClass] = useState("");
  const [profession, setProfession] = useState("chronicler");
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedCharacter | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedRace = RACES.find((item) => item.id === race) ?? RACES[0];
  const selectedClass =
    CLASSES.find((item) => item.id === characterClass) ?? CLASSES[0];
  const selectedSecondary = CLASSES.find((item) => item.id === secondaryClass);
  const secondaryOptions = compatibleSecondaryClasses(characterClass);
  const selectedProfession =
    PROFESSIONS.find((item) => item.id === profession) ?? PROFESSIONS[0];
  const used = pointBuyUsed(stats);
  const remaining = STARTING_POINT_BUDGET - used;
  const totals = useMemo(() => finalStats(stats, race), [stats, race]);
  const hp = startingHp(characterClass, totals);
  const portraitPrompt = useMemo(() => {
    const skin = APPEARANCE_OPTIONS.skinTone.find(
      (item) => item.id === appearance.skinTone,
    )?.label;
    const hairStyle = APPEARANCE_OPTIONS.hairStyle.find(
      (item) => item.id === appearance.hairStyle,
    )?.label;
    const hairColor = APPEARANCE_OPTIONS.hairColor.find(
      (item) => item.id === appearance.hairColor,
    )?.label;
    const face = APPEARANCE_OPTIONS.face.find(
      (item) => item.id === appearance.face,
    )?.label;
    const body = APPEARANCE_OPTIONS.body.find(
      (item) => item.id === appearance.body,
    )?.label;
    return `Create a premium dark-fantasy RPG character portrait for ${name.trim() || "an unnamed adventurer"}, a ${selectedRace.label} ${selectedClass.label}${selectedSecondary ? ` / ${selectedSecondary.label}` : ""}, with the life profession ${selectedProfession.label}. ${skin} skin tone, ${hairStyle} hairstyle, ${hairColor} hair, ${face} facial structure, ${body} build. ${selectedClass.description}. Cinematic painterly realism, intricate fantasy costume appropriate to both class and profession, expressive face, dramatic rim lighting, atmospheric ${appearance.portraitBackdrop ?? "forest"} background, centered single character, vertical 3:4 composition, sharp readable silhouette suitable for a tabletop token, high detail. No text, no logo, no watermark, no extra people, no cropped head or hands.`;
  }, [
    appearance,
    name,
    selectedClass,
    selectedProfession,
    selectedRace,
    selectedSecondary,
  ]);

  function chooseRace(nextRace: string) {
    setRace(nextRace);
    if (nextRace === "goblin")
      setAppearance((current) => ({ ...current, skinTone: "moss" }));
    if (nextRace === "fallen")
      setAppearance((current) => ({ ...current, skinTone: "moon" }));
  }

  function changeAppearance<Key extends keyof Appearance>(
    key: Key,
    value: Appearance[Key],
  ) {
    setAppearance((current) => ({ ...current, [key]: value }));
  }

  function changeStat(key: StatKey, direction: -1 | 1) {
    setStats((current) => {
      const nextValue = current[key] + direction;
      if (nextValue < 8 || nextValue > STARTING_STAT_MAX) return current;
      const next = { ...current, [key]: nextValue };
      return pointBuyUsed(next) <= 27 ? next : current;
    });
  }

  function randomAppearance() {
    const pick = <T,>(items: readonly T[]) =>
      items[Math.floor(Math.random() * items.length)];
    setAppearance({
      skinTone: pick(APPEARANCE_OPTIONS.skinTone).id,
      hairStyle: pick(APPEARANCE_OPTIONS.hairStyle).id,
      hairColor: pick(APPEARANCE_OPTIONS.hairColor).id,
      face: pick(APPEARANCE_OPTIONS.face).id,
      body: pick(APPEARANCE_OPTIONS.body).id,
      portraitBackdrop: pick(APPEARANCE_OPTIONS.portraitBackdrop).id,
      portraitFrame: pick(APPEARANCE_OPTIONS.portraitFrame).id,
      portraitSigil: pick(APPEARANCE_OPTIONS.portraitSigil).id,
    });
  }

  function randomCharacter() {
    const pick = <T,>(items: readonly T[]) =>
      items[Math.floor(Math.random() * items.length)];
    const first = [
        "Astra",
        "Kael",
        "Lyra",
        "Nox",
        "Orin",
        "Mira",
        "Tarin",
        "Vela",
      ],
      last = [
        "Dawnfall",
        "Runebloom",
        "Ashward",
        "Moonveil",
        "Wildstep",
        "Goldleaf",
      ];
    const nextRace = pick(RACES),
      nextClass = pick(CLASSES),
      nextProfession = pick(PROFESSIONS),
      links = compatibleSecondaryClasses(nextClass.id);
    const shuffled = STAT_KEYS.filter((key) => key !== nextClass.primary).sort(
        () => Math.random() - 0.5,
      ),
      values = [13, 12, 9, 9, 8];
    const nextStats = { ...DEFAULT_STATS };
    nextStats[nextClass.primary] = 14;
    shuffled.forEach((key, index) => (nextStats[key] = values[index]));
    setName(`${pick(first)} ${pick(last)}`);
    chooseRace(nextRace.id);
    setCharacterClass(nextClass.id);
    setSecondaryClass(
      links.length && Math.random() < 0.6 ? pick(links).id : "",
    );
    setProfession(nextProfession.id);
    setStats(nextStats);
    randomAppearance();
    setError("");
  }

  function nextStep() {
    setError("");
    if (step === 0 && (name.trim().length < 2 || name.trim().length > 24)) {
      setError("ตั้งชื่อตัวละครให้ยาว 2-24 ตัวอักษรก่อนเดินทางต่อ");
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  }

  function completePointBuy(current: Stats) {
    const next = { ...current };
    const priorities = [
      selectedClass.primary,
      "constitution",
      "dexterity",
      "wisdom",
      "intelligence",
      "charisma",
      "strength",
    ] as StatKey[];
    while (pointBuyUsed(next) < STARTING_POINT_BUDGET) {
      const key = priorities.find(
        (candidate) =>
          next[candidate] < STARTING_STAT_MAX &&
          pointBuyUsed({ ...next, [candidate]: next[candidate] + 1 }) <=
            STARTING_POINT_BUDGET,
      );
      if (!key) break;
      next[key] += 1;
    }
    return next;
  }

  async function createCharacter() {
    const submittedStats = remaining > 0 ? completePointBuy(stats) : stats;
    if (pointBuyUsed(submittedStats) !== STARTING_POINT_BUDGET)
      return setError("จัดค่าสถานะไม่สำเร็จ กรุณากดสุ่มตัวละครแล้วลองใหม่");
    if (submittedStats !== stats) setStats(submittedStats);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          name,
          race,
          characterClass,
          secondaryClass: secondaryClass || null,
          profession,
          appearance,
          stats: submittedStats,
          dimensionId,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const messages: Record<string, string> = {
          unauthorized:
            "เซสชัน Guest หมดอายุ กรุณากลับไปเข้า Guest ใหม่อีกครั้ง",
          character_limit: "บัญชีนี้มีตัวละครครบ 10 ตัวแล้ว",
          invalid_stats: "ค่าสถานะไม่ถูกต้อง",
          invalid_name: "ชื่อตัวละครมีอักขระที่ไม่รองรับ",
          invalid_dimension: "มิติที่เลือกไม่พร้อมใช้งาน กรุณาโหลดหน้าใหม่",
          calling_failed: "จารึกอาชีพไม่สำเร็จ กรุณาลองอีกครั้ง",
        };
        throw new Error(
          messages[result.error] ?? "บันทึกตัวละครไม่สำเร็จ กรุณาลองใหม่",
        );
      }
      setCreated(result as CreatedCharacter);
    } catch (caught) {
      setError(
        caught instanceof DOMException && caught.name === "TimeoutError"
          ? "การจารึกใช้เวลานานเกินไป กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง"
          : caught instanceof Error
            ? caught.message
            : "บันทึกตัวละครไม่สำเร็จ กรุณาลองใหม่",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="creator-shell">
      {created && (
        <div className="creator-complete" role="dialog" aria-modal="true">
          <section>
            <small>CHARACTER AWAKENED</small>
            <h2>{name} พร้อมออกเดินทางแล้ว</h2>
            <p>ระบบสุ่มชุดกำเนิดและสกิลประจำตัวให้เรียบร้อย</p>
            {created.divineBlessing && (
              <article
                className={`birth-blessing tier-${created.divineBlessing.tier}`}
              >
                <small>
                  DIVINE BLESSING · TIER {created.divineBlessing.tier}
                </small>
                <h3>{created.divineBlessing.name_th}</h3>
                <b>{created.divineBlessing.deity_th}</b>
                <p>{created.divineBlessing.description_th}</p>
              </article>
            )}
            <div className="birth-loadout">
              <article>
                <b>ไอเทมแรกเกิด</b>
                {created.starterItems.map((entry, index) => (
                  <span key={index}>
                    {entry.content_items.name_th} ×{entry.quantity}
                  </span>
                ))}
              </article>
              <article>
                <b>สกิลที่ติดตัว</b>
                {created.starterSkills.map((skill) => (
                  <span key={skill.id}>{skill.name_th}</span>
                ))}
              </article>
            </div>
            <label className="portrait-prompt">
              <b>Prompt สำหรับสร้างภาพด้วย AI</b>
              <textarea readOnly value={portraitPrompt} />
            </label>
            <div className="complete-actions">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(portraitPrompt);
                  setCopied(true);
                }}
              >
                {copied ? "คัดลอกแล้ว ✓" : "คัดลอก Prompt"}
              </button>
              <button
                className="primary"
                onClick={() => {
                  router.replace(`/characters/${created.id}`);
                  router.refresh();
                }}
              >
                ไปอัปโหลดรูปตัวละคร →
              </button>
            </div>
          </section>
        </div>
      )}
      <header className="creator-topbar">
        <Link href="/lobby">← กลับล็อบบี้</Link>
        <span>MYTHWEAVE · CHARACTER FORGE</span>
        <small>STEP {step + 1} / 4</small>
      </header>
      <div className="creator-progress">
        {STEP_LABELS.map((label, index) => (
          <button
            className={index === step ? "active" : index < step ? "done" : ""}
            key={label}
            onClick={() => index <= step && setStep(index)}
            type="button"
          >
            <i>{index < step ? "✓" : index + 1}</i>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <section className="creator-layout">
        <div className="creator-workbench">
          {step === 0 && (
            <div className="creator-stage">
              <span className="creator-kicker">01 · ORIGIN</span>
              <h1>ตั้งชื่อและเลือกสายเลือด</h1>
              <p>เผ่าจะเพิ่มค่าสถานะและกำหนดจุดเริ่มต้นของเรื่องราวในอนาคต</p>
              <button
                className="random-character"
                onClick={randomCharacter}
                type="button"
              >
                ⚄ สุ่มตัวละครครบชุดให้ฉัน
              </button>
              <label className="creator-name">
                <span>ชื่อตัวละคร</span>
                <input
                  autoFocus
                  maxLength={24}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="เช่น Aria Nightbloom"
                  value={name}
                />
              </label>
              <label className="creator-name">
                <span>มิติประจำตัว · เปลี่ยนข้ามมิติไม่ได้</span>
                <select
                  value={dimensionId}
                  onChange={(event) => setDimensionId(event.target.value)}
                >
                  {dimensions.map((dimension) => (
                    <option value={dimension.id} key={dimension.id}>
                      {dimension.name_th} · {dimension.difficulty_label_th}
                    </option>
                  ))}
                </select>
              </label>
              <div className="race-grid">
                {RACES.map((item) => (
                  <button
                    className={race === item.id ? "selected" : ""}
                    key={item.id}
                    onClick={() => chooseRace(item.id)}
                    type="button"
                  >
                    <b>{item.icon}</b>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.tagline}</small>
                    </span>
                    <em>
                      {Object.entries(item.bonuses)
                        .map(
                          ([key, value]) =>
                            `+${value} ${STAT_LABELS[key as StatKey].short}`,
                        )
                        .join(" · ")}
                    </em>
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="creator-stage">
              <span className="creator-kicker">02 · CALLING</span>
              <h1>เลือกเส้นทางแห่งการต่อสู้</h1>
              <p>คลาสกำหนดบทบาทในปาร์ตี้ พลังชีวิตเริ่มต้น และค่าสถานะหลัก</p>
              <div className="class-grid">
                {CLASSES.map((item) => (
                  <button
                    className={characterClass === item.id ? "selected" : ""}
                    key={item.id}
                    onClick={() => {
                      setCharacterClass(item.id);
                      setSecondaryClass("");
                    }}
                    type="button"
                    style={
                      { "--class-color": item.color } as React.CSSProperties
                    }
                  >
                    <b>{item.icon}</b>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.role}</small>
                      <em>{item.description}</em>
                    </span>
                    <i>d{item.hitDie}</i>
                  </button>
                ))}
              </div>
              <section className="calling-builder">
                <div>
                  <small>OPTIONAL MULTICLASS</small>
                  <h2>ผสมสายต่อสู้ที่เข้ากันได้</h2>
                  <p>
                    ได้รับสกิลเริ่มต้นจากคลาสรอง 1 สกิล โดย HP
                    และตัวตนหลักยังยึดคลาสแรก
                  </p>
                </div>
                <select
                  value={secondaryClass}
                  onChange={(event) => setSecondaryClass(event.target.value)}
                >
                  <option value="">ไม่เลือกคลาสรอง</option>
                  {secondaryOptions.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.icon} {item.label} · {item.role}
                    </option>
                  ))}
                </select>
              </section>
              <section className="profession-builder">
                <div>
                  <small>LIFE PROFESSION</small>
                  <h2>เลือกวิชาชีพประจำชีวิต</h2>
                  <p>โบนัสเริ่มต้น 5% และเติบโตได้ถึง 10% ตามระดับความถนัด</p>
                </div>
                <div>
                  {PROFESSIONS.map((item) => (
                    <button
                      className={profession === item.id ? "selected" : ""}
                      onClick={() => setProfession(item.id)}
                      key={item.id}
                      type="button"
                    >
                      <b>{item.icon}</b>
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                        <em>{item.bonus}</em>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}
          {step === 2 && (
            <div className="creator-stage">
              <span className="creator-kicker">03 · APPEARANCE</span>
              <h1>สลักใบหน้าของตำนาน</h1>
              <p>
                รูปลักษณ์นี้จะกลายเป็น portrait และไอคอนประจำตัวของคุณบนแผนที่
              </p>
              <button
                className="random-appearance"
                onClick={randomAppearance}
                type="button"
              >
                ✦ สุ่มรูปลักษณ์ทั้งหมด
              </button>
              <div className="appearance-groups">
                <AppearanceChoices
                  title="สีผิว"
                  items={APPEARANCE_OPTIONS.skinTone}
                  selected={appearance.skinTone}
                  onSelect={(value) =>
                    changeAppearance(
                      "skinTone",
                      value as Appearance["skinTone"],
                    )
                  }
                  colors
                />
                <AppearanceChoices
                  title="ทรงผม"
                  items={APPEARANCE_OPTIONS.hairStyle}
                  selected={appearance.hairStyle}
                  onSelect={(value) =>
                    changeAppearance(
                      "hairStyle",
                      value as Appearance["hairStyle"],
                    )
                  }
                />
                <AppearanceChoices
                  title="สีผม"
                  items={APPEARANCE_OPTIONS.hairColor}
                  selected={appearance.hairColor}
                  onSelect={(value) =>
                    changeAppearance(
                      "hairColor",
                      value as Appearance["hairColor"],
                    )
                  }
                  colors
                />
                <AppearanceChoices
                  title="โครงหน้า"
                  items={APPEARANCE_OPTIONS.face}
                  selected={appearance.face}
                  onSelect={(value) =>
                    changeAppearance("face", value as Appearance["face"])
                  }
                />
                <AppearanceChoices
                  title="รูปร่าง"
                  items={APPEARANCE_OPTIONS.body}
                  selected={appearance.body}
                  onSelect={(value) =>
                    changeAppearance("body", value as Appearance["body"])
                  }
                />
                <AppearanceChoices
                  title="ฉากหลัง Portrait"
                  items={APPEARANCE_OPTIONS.portraitBackdrop}
                  selected={appearance.portraitBackdrop ?? "forest"}
                  onSelect={(value) =>
                    changeAppearance(
                      "portraitBackdrop",
                      value as NonNullable<Appearance["portraitBackdrop"]>,
                    )
                  }
                />
                <AppearanceChoices
                  title="กรอบ Portrait"
                  items={APPEARANCE_OPTIONS.portraitFrame}
                  selected={appearance.portraitFrame ?? "gold"}
                  onSelect={(value) =>
                    changeAppearance(
                      "portraitFrame",
                      value as NonNullable<Appearance["portraitFrame"]>,
                    )
                  }
                />
                <AppearanceChoices
                  title="ตราประจำตัว"
                  items={APPEARANCE_OPTIONS.portraitSigil}
                  selected={appearance.portraitSigil ?? "class"}
                  onSelect={(value) =>
                    changeAppearance(
                      "portraitSigil",
                      value as NonNullable<Appearance["portraitSigil"]>,
                    )
                  }
                />
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="creator-stage">
              <span className="creator-kicker">04 · ATTRIBUTES</span>
              <h1>แบ่งแต้มกำหนดชะตา</h1>
              <p>
                ใช้แต้มทั้ง {STARTING_POINT_BUDGET} แต้ม ค่าพื้นฐานสูงสุด{" "}
                {STARTING_STAT_MAX} ก่อนรับโบนัสจากเผ่า
                เพื่อให้เริ่มต้นแบบนักผจญภัยมือใหม่และเติบโตระหว่างเล่น ·
                เมื่อเกิด ระบบจะสุ่มอาวุธ อุปกรณ์ และ 3 สกิลให้ทันที
              </p>
              <div
                className={`point-budget ${remaining === 0 ? "complete" : ""}`}
              >
                <span>แต้มคงเหลือ</span>
                <strong>{remaining}</strong>
                <small>/ {STARTING_POINT_BUDGET}</small>
              </div>
              <div className="stats-builder">
                {STAT_KEYS.map((key) => {
                  const bonus = totals[key] - stats[key];
                  const modifier = abilityModifier(totals[key]);
                  return (
                    <article key={key}>
                      <div>
                        <b>{STAT_LABELS[key].short}</b>
                        <span>{STAT_LABELS[key].label}</span>
                      </div>
                      <button
                        disabled={stats[key] <= 8}
                        onClick={() => changeStat(key, -1)}
                        type="button"
                      >
                        −
                      </button>
                      <strong>{stats[key]}</strong>
                      <button
                        disabled={
                          stats[key] >= STARTING_STAT_MAX ||
                          pointBuyUsed({ ...stats, [key]: stats[key] + 1 }) >
                            STARTING_POINT_BUDGET
                        }
                        onClick={() => changeStat(key, 1)}
                        type="button"
                      >
                        +
                      </button>
                      <em>{bonus > 0 ? `+${bonus} เผ่า` : "—"}</em>
                      <i>
                        รวม {totals[key]} ({modifier >= 0 ? "+" : ""}
                        {modifier})
                      </i>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
          {error && (
            <div className="creator-error" role="alert">
              {error}
            </div>
          )}
          <div className="creator-actions">
            <button
              disabled={step === 0}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              type="button"
            >
              ย้อนกลับ
            </button>
            {step < 3 ? (
              <button className="primary" onClick={nextStep} type="button">
                ขั้นถัดไป →
              </button>
            ) : (
              <button
                className="primary"
                disabled={saving}
                onClick={createCharacter}
                type="button"
              >
                {saving
                  ? "กำลังจารึก..."
                  : remaining > 0
                    ? `จารึกและจัด ${remaining} แต้มที่เหลือให้อัตโนมัติ`
                    : "ยืนยันและสร้างตัวละคร"}
              </button>
            )}
          </div>
        </div>
        <aside className="creator-preview">
          <div className="avatar-frame">
            <CharacterAvatar
              appearance={appearance}
              characterClass={characterClass}
              name={name || "ผู้ไร้นาม"}
              race={race}
            />
          </div>
          <span className="preview-kicker">LIVE PORTRAIT</span>
          <h2>{name.trim() || "ผู้ไร้นาม"}</h2>
          <p>
            {selectedRace.label} · {selectedClass.label}
            {selectedSecondary ? ` / ${selectedSecondary.label}` : ""}
          </p>
          <small className="preview-profession">
            {selectedProfession.icon} {selectedProfession.label} ·{" "}
            {selectedProfession.bonus}
          </small>
          <div className="preview-vitals">
            <span>
              <small>HP เริ่มต้น</small>
              <strong>{hp}</strong>
            </span>
            <span>
              <small>บทบาท</small>
              <strong>{selectedClass.role}</strong>
            </span>
          </div>
          <blockquote>{selectedRace.description}</blockquote>
        </aside>
      </section>
    </main>
  );
}

type Choice = {
  readonly id: string;
  readonly label: string;
  readonly color?: string;
};
function AppearanceChoices({
  title,
  items,
  selected,
  onSelect,
  colors = false,
}: {
  title: string;
  items: readonly Choice[];
  selected: string;
  onSelect: (value: string) => void;
  colors?: boolean;
}) {
  return (
    <section>
      <h3>{title}</h3>
      <div className="appearance-options">
        {items.map((item) => (
          <button
            aria-label={item.label}
            className={selected === item.id ? "selected" : ""}
            key={item.id}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            {colors && item.color ? (
              <i style={{ background: item.color }} />
            ) : (
              item.label
            )}
            <span>{colors ? item.label : ""}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
