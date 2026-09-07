import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const characterId = String(body?.characterId ?? "");
  if (!UUID.test(characterId)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { data, error } = await supabase.rpc("mark_solo_diligence", { target_character_id: characterId });
  if (error || !data) {
    const detail = error?.message ?? "";
    const code = detail.includes("already marked today") ? "already_marked_today" : detail.includes("character dead") ? "character_dead" : detail.includes("solo not active") ? "solo_not_active" : detail.includes("wilderness required") ? "wilderness_required" : detail.includes("not found") ? "not_found" : "diligence_failed";
    return NextResponse.json({ error: code }, { status: ["already_marked_today", "character_dead", "solo_not_active", "wilderness_required"].includes(code) ? 409 : code === "not_found" ? 404 : 500 });
  }
  return NextResponse.json({ diligence: data }, { status: 201 });
}
