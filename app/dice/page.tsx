import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import type { DiceRoll } from "../../lib/dice/types";
import { DiceTable } from "./dice-table";

export const metadata: Metadata = { title: "Realtime Dice — Mythweave" };

type Props = { searchParams: Promise<{ table?: string }> };

export default async function DicePage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { table: tableId } = await searchParams;
  let table: { id: string; code: string } | null = null;
  let rolls: DiceRoll[] = [];
  let members: { user_id: string; display_name: string }[] = [];
  if (tableId) {
    const { data } = await supabase.from("dice_tables").select("id,code").eq("id", tableId).maybeSingle();
    table = data;
    if (table) {
      const [{ data: rollData }, { data: memberData }] = await Promise.all([
        supabase.from("dice_rolls").select("*").eq("table_id", table.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("dice_table_members").select("user_id,display_name").eq("table_id", table.id).order("joined_at"),
      ]);
      rolls = (rollData ?? []).reverse() as DiceRoll[];
      members = memberData ?? [];
    }
  }

  return <DiceTable initialTable={table} initialRolls={rolls} members={members} currentUserId={user.id} invalidTable={Boolean(tableId && !table)} />;
}

