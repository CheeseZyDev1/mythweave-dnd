export const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;

export type DiceRoll = {
  id: string;
  table_id: string;
  user_id: string;
  roller_name: string;
  dice_count: number;
  dice_sides: number;
  modifier: number;
  rolls: number[];
  total: number;
  created_at: string;
};

