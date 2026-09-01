import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import type { DiceRoll } from "../../lib/dice/types";
import type {
  InitiativeEntry,
  InitiativeTracker,
} from "../../lib/initiative/types";
import type { RoomMessage } from "../../lib/chat/types";
import type { RoomSave } from "../../lib/room-saves/types";
import { DiceTable } from "./dice-table";

export const metadata: Metadata = { title: "Realtime Dice — Mythweave" };

type Props = { searchParams: Promise<{ table?: string }> };

export default async function DicePage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { table: tableId } = await searchParams;
  let table: { id: string; code: string } | null = null;
  let rolls: DiceRoll[] = [];
  let members: { user_id: string; display_name: string; role: string }[] = [];
  let initiativeEntries: InitiativeEntry[] = [];
  let initiativeTracker: InitiativeTracker | null = null;
  let messages: RoomMessage[] = [];
  let saves: RoomSave[] = [];
  if (tableId) {
    const { data } = await supabase
      .from("dice_tables")
      .select("id,code")
      .eq("id", tableId)
      .maybeSingle();
    table = data;
    if (table) {
      const [
        { data: rollData },
        { data: memberData },
        { data: entryData },
        { data: trackerData },
        { data: messageData },
        { data: saveData },
      ] = await Promise.all([
        supabase
          .from("dice_rolls")
          .select("*")
          .eq("table_id", table.id)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("dice_table_members")
          .select("user_id,display_name,role")
          .eq("table_id", table.id)
          .order("joined_at"),
        supabase
          .from("initiative_entries")
          .select("*")
          .eq("table_id", table.id)
          .order("initiative", { ascending: false }),
        supabase
          .from("initiative_trackers")
          .select("*")
          .eq("table_id", table.id)
          .maybeSingle(),
        supabase
          .from("room_messages")
          .select("*")
          .eq("table_id", table.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("room_saves").select("id,table_id,slot,save_name,entry_count,round_number,created_by,created_at,updated_at").eq("table_id", table.id).order("slot"),
      ]);
      rolls = (rollData ?? []).reverse() as DiceRoll[];
      members = memberData ?? [];
      initiativeEntries = (entryData ?? []) as InitiativeEntry[];
      initiativeTracker = trackerData as InitiativeTracker | null;
      messages = ((messageData ?? []) as RoomMessage[]).reverse();
      saves = (saveData ?? []) as RoomSave[];
    }
  }

  return (
    <DiceTable
      initialTable={table}
      initialRolls={rolls}
      members={members}
      currentUserId={user.id}
      invalidTable={Boolean(tableId && !table)}
      initialInitiativeEntries={initiativeEntries}
      initialInitiativeTracker={initiativeTracker}
      initialMessages={messages}
      initialSaves={saves}
    />
  );
}
