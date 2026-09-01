import { STAT_KEYS, type Stats } from "./catalog";

export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  note: string;
};

export function isValidSheetStats(value: unknown): value is Stats {
  if (!value || typeof value !== "object") return false;
  return STAT_KEYS.every((key) => {
    const score = (value as Record<string, unknown>)[key];
    return Number.isInteger(score) && Number(score) >= 1 && Number(score) <= 30;
  });
}

export function isValidInventory(value: unknown): value is InventoryItem[] {
  if (!Array.isArray(value) || value.length > 100) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const entry = item as Record<string, unknown>;
    return typeof entry.id === "string" && entry.id.length >= 1 && entry.id.length <= 80
      && typeof entry.name === "string" && entry.name.trim().length >= 1 && entry.name.trim().length <= 60
      && Number.isInteger(entry.quantity) && Number(entry.quantity) >= 1 && Number(entry.quantity) <= 999
      && typeof entry.note === "string" && entry.note.length <= 200;
  });
}

