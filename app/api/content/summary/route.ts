import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [common, uncommon, dialogue, quests, events] = await Promise.all([
    supabase.from("content_items").select("id", { count: "exact", head: true }).eq("rarity", "common"),
    supabase.from("content_items").select("id", { count: "exact", head: true }).eq("rarity", "uncommon"),
    supabase.from("dialogue_pool").select("id", { count: "exact", head: true }),
    supabase.from("quest_templates").select("id", { count: "exact", head: true }),
    supabase.from("event_templates").select("id", { count: "exact", head: true }),
  ]);
  if ([common, uncommon, dialogue, quests, events].some((result) => result.error)) return NextResponse.json({ error: "content_unavailable" }, { status: 500 });
  return NextResponse.json({ items: { common: common.count, uncommon: uncommon.count }, dialogue: dialogue.count, quests: quests.count, events: events.count });
}

