export type RoomMessage = {
  id: string;
  table_id: string;
  user_id: string;
  sender_name: string;
  sender_role: "player" | "dm" | "spectator";
  content: string;
  created_at: string;
};

