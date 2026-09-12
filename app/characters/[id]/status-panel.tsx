"use client";
import { useState } from "react";
type Template = {
  id: number;
  name_th: string;
  effect_type: string;
  description_th: string;
  default_duration: number;
  max_stacks: number;
};
type Effect = {
  id: string;
  template_id: number;
  name_th: string;
  effect_type: string;
  description_th: string;
  duration_remaining: number;
  stacks: number;
  source: string;
};

function statusEmoji(effect: {
  name_th: string;
  description_th: string;
  effect_type: string;
}) {
  const text = `${effect.name_th} ${effect.description_th}`.toLowerCase();
  if (/ไฟ|เพลิง|เผา|burn|flame/.test(text)) return "🔥";
  if (/พิษ|poison|venom/.test(text)) return "☠️";
  if (/เลือด|bleed/.test(text)) return "🩸";
  if (/น้ำแข็ง|แช่แข็ง|เยือก|frost|freeze/.test(text)) return "❄️";
  if (/ช็อต|สายฟ้า|ไฟฟ้า|shock|lightning/.test(text)) return "⚡";
  if (/มึน|สตัน|หลับ|stun|sleep/.test(text)) return "💫";
  if (/รักษา|ฟื้น|heal|regen/.test(text)) return "💚";
  if (/เกราะ|ป้องกัน|shield|armor/.test(text)) return "🛡️";
  if (/เร็ว|ว่องไว|speed|haste/.test(text)) return "💨";
  return effect.effect_type === "buff" ? "✨" : "⚠️";
}
export function StatusPanel({
  characterId,
  templates,
  initialEffects,
}: {
  characterId: string;
  templates: Template[];
  initialEffects: Effect[];
}) {
  const [effects, setEffects] = useState(initialEffects);
  const [selected, setSelected] = useState(templates[0]?.id ?? 0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function action(
    name: "apply" | "tick" | "remove",
    extra: Record<string, unknown> = {},
  ) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/status-effects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: name, characterId, ...extra }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error("อัปเดตสถานะไม่สำเร็จ");
      if (result.effect)
        setEffects((current) => [
          result.effect,
          ...current.filter((effect) => effect.id !== result.effect.id),
        ]);
      if (result.effects) setEffects(result.effects);
      if (result.removed)
        setEffects((current) =>
          current.filter((effect) => effect.id !== result.removed),
        );
      setMessage(
        name === "tick"
          ? "ผ่านไป 1 เทิร์น"
          : name === "apply"
            ? "เพิ่มสถานะแล้ว"
            : "ลบสถานะแล้ว",
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "อัปเดตสถานะไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="sheet-panel status-panel">
      <div className="sheet-section-title">
        <div>
          <small>BUFF · DEBUFF</small>
          <h2>Status Effects</h2>
        </div>
        <button
          className="sheet-add"
          onClick={() => action("tick")}
          disabled={busy || effects.length === 0}
        >
          จบเทิร์น −1 Duration
        </button>
      </div>
      <div className="status-add">
        <select
          value={selected}
          onChange={(event) => setSelected(Number(event.target.value))}
        >
          {templates.map((template) => (
            <option value={template.id} key={template.id}>
              {statusEmoji(template)} {template.name_th} ·{" "}
              {template.default_duration} เทิร์น
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            action("apply", { templateId: selected, source: "manual" })
          }
          disabled={busy || !selected}
        >
          เพิ่มสถานะ
        </button>
      </div>
      <div className="status-list">
        {effects.map((effect) => (
          <article className={effect.effect_type} key={effect.id}>
            <i aria-label={effect.effect_type === "buff" ? "บัฟ" : "ดีบัฟ"}>
              {statusEmoji(effect)}
            </i>
            <span>
              <strong>
                {effect.name_th}
                {effect.stacks > 1 ? ` ×${effect.stacks}` : ""}
              </strong>
              <small>{effect.description_th}</small>
            </span>
            <b>
              {effect.duration_remaining}
              <small>TURN</small>
            </b>
            <button
              onClick={() => action("remove", { effectId: effect.id })}
              disabled={busy}
            >
              ×
            </button>
          </article>
        ))}
        {effects.length === 0 && <div>🕊️ ไม่มี buff หรือ debuff</div>}
      </div>
      {message && <p>{message}</p>}
    </section>
  );
}
