export type InitiativeEntry = {
  id: string;
  table_id: string;
  created_by: string;
  name: string;
  initiative: number;
  created_at: string;
};

export type InitiativeTracker = {
  table_id: string;
  current_entry_id: string | null;
  round_number: number;
  active: boolean;
  updated_at: string;
};

