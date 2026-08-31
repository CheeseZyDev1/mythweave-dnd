import { CLASSES, DEFAULT_STATS, RACES, STAT_KEYS, type Appearance, type Stats } from "./catalog";

const COSTS: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export function pointBuyUsed(stats: Stats) {
  return STAT_KEYS.reduce((total, key) => total + (COSTS[stats[key]] ?? 99), 0);
}

export function finalStats(baseStats: Stats, raceId: string): Stats {
  const race = RACES.find((item) => item.id === raceId);
  return STAT_KEYS.reduce((result, key) => {
    result[key] = baseStats[key] + Number(race?.bonuses[key as keyof typeof race.bonuses] ?? 0);
    return result;
  }, { ...DEFAULT_STATS });
}

export function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

export function startingHp(characterClass: string, stats: Stats) {
  const selectedClass = CLASSES.find((item) => item.id === characterClass);
  return Math.max(1, Number(selectedClass?.hitDie ?? 8) + abilityModifier(stats.constitution));
}

export function isValidStats(value: unknown): value is Stats {
  if (!value || typeof value !== "object") return false;
  return STAT_KEYS.every((key) => Number.isInteger((value as Stats)[key]) && (value as Stats)[key] >= 8 && (value as Stats)[key] <= 15) && pointBuyUsed(value as Stats) === 27;
}

export function isValidAppearance(value: unknown): value is Appearance {
  if (!value || typeof value !== "object") return false;
  const appearance = value as Record<string, unknown>;
  const allowed = {
    skinTone: ["porcelain", "warm", "bronze", "deep", "moss", "moon"],
    hairStyle: ["short", "long", "braid", "mohawk", "bald"],
    hairColor: ["raven", "chestnut", "gold", "silver", "ember", "violet"],
    face: ["soft", "sharp", "round"],
    body: ["slim", "balanced", "broad"],
  };
  return Object.entries(allowed).every(([key, values]) => values.includes(String(appearance[key])));
}
