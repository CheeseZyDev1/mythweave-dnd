import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = ["talk", "gift", "help", "insult"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const characterId = String(body?.characterId ?? "");
  const npcId = Number(body?.npcId);
  const action = String(body?.action ?? "");
  if (!UUID.test(characterId) || !Number.isInteger(npcId) || npcId < 1 || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { data, error } = await supabase.rpc("interact_with_npc", {
    target_character_id: characterId,
    target_npc_id: npcId,
    target_action: action,
  });
  if (error || !data) {
    const code = error?.message.includes("cooldown")
      ? "cooldown"
      : error?.message.includes("insufficient funds")
        ? "insufficient_funds"
        : error?.message.includes("not found")
          ? "not_found"
          : "interaction_failed";
    return NextResponse.json({ error: code }, { status: code === "cooldown" || code === "insufficient_funds" ? 409 : code === "not_found" ? 404 : 500 });
  }
  return NextResponse.json({ affinity: data }, { status: 201 });
}
