import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const characterId = new URL(request.url).searchParams.get("character") ?? "";
  if (!UUID.test(characterId)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { data, error } = await supabase.rpc("get_or_create_village_event", { target_character_id: characterId });
  if (error) return NextResponse.json({ error: error.message.includes("not found") ? "not_found" : "event_failed" }, { status: error.message.includes("not found") ? 404 : 500 });
  return NextResponse.json({ event: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const characterId = String(body?.characterId ?? "");
  const eventId = String(body?.eventId ?? "");
  const action = String(body?.action ?? "");
  if (!UUID.test(characterId) || !UUID.test(eventId) || !["participate", "ignore"].includes(action)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { data, error } = await supabase.rpc("resolve_village_event", { target_character_id: characterId, target_event_id: eventId, target_action: action });
  if (error || !data) {
    const code = error?.message.includes("resolved") ? "already_resolved" : error?.message.includes("not found") ? "not_found" : "event_failed";
    return NextResponse.json({ error: code }, { status: code === "already_resolved" ? 409 : code === "not_found" ? 404 : 500 });
  }
  return NextResponse.json({ event: data });
}
