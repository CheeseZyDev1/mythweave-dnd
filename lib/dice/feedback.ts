import type { DiceRoll } from "./types";

export type RollTier = "doom" | "poor" | "neutral" | "good" | "critical";

export const ROLL_FEEDBACK: Record<
  RollTier,
  { emoji: string; label: string; message: string }
> = {
  doom: { emoji: "☠️", label: "หายนะ", message: "เทพแห่งเต๋าหันหลังให้…" },
  poor: { emoji: "😵", label: "พลาดหนัก", message: "โชคยังไม่เข้าข้าง" },
  neutral: { emoji: "🎲", label: "ผลทั่วไป", message: "ชะตายังพลิกได้" },
  good: { emoji: "✨", label: "ผลดี", message: "โชคเริ่มเข้าข้างแล้ว" },
  critical: {
    emoji: "🌟",
    label: "คริติคอล!",
    message: "เหล่าเทพกำลังจับตามอง!",
  },
};

export function getRollTier(
  roll: Pick<DiceRoll, "dice_count" | "dice_sides" | "rolls">,
): RollTier {
  const rawTotal = roll.rolls.reduce((sum, value) => sum + value, 0);
  const maximum = Math.max(1, roll.dice_count * roll.dice_sides);
  const ratio = rawTotal / maximum;
  const isSingleD20 = roll.dice_count === 1 && roll.dice_sides === 20;

  if ((isSingleD20 && rawTotal === 1) || ratio <= 0.15) return "doom";
  if ((isSingleD20 && rawTotal === 20) || ratio >= 0.9) return "critical";
  if (ratio <= 0.35) return "poor";
  if (ratio >= 0.7) return "good";
  return "neutral";
}
