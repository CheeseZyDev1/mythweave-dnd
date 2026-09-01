export type WorldTimePhase = "dawn" | "day" | "dusk" | "night";

const PHASE_LABELS: Record<WorldTimePhase, string> = {
  dawn: "รุ่งสาง",
  day: "กลางวัน",
  dusk: "โพล้เพล้",
  night: "กลางคืน",
};

export function getWorldTime(elapsedHours: number) {
  const safeHours = Math.max(0, Math.floor(elapsedHours));
  const absoluteHours = 8 + safeHours;
  const hour = absoluteHours % 24;
  const day = Math.floor(absoluteHours / 24) + 1;
  const phase: WorldTimePhase = hour >= 5 && hour < 8 ? "dawn" : hour >= 8 && hour < 18 ? "day" : hour >= 18 && hour < 21 ? "dusk" : "night";
  return { day, hour, phase, label: PHASE_LABELS[phase], clock: `${String(hour).padStart(2, "0")}:00` };
}
