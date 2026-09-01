import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const characterId = String(body?.characterId ?? "");
  const action = String(body?.action ?? "start");
  if (!UUID.test(characterId) || !["start", "resolve"].includes(action)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  let data;
  let error;
  if (action === "resolve") {
    const journeyId = String(body?.journeyId ?? "");
    if (!UUID.test(journeyId)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    ({ data, error } = await supabase.rpc("resolve_travel_encounter", { target_character_id: characterId, target_journey_id: journeyId }));
  } else {
    const locationId = Number(body?.locationId);
    const mode = String(body?.mode ?? "fast_travel");
    if (!Number.isInteger(locationId) || locationId < 1 || !["fast_travel", "carriage", "griffin"].includes(mode)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const fn = mode === "fast_travel" ? "fast_travel_character" : "travel_character_route";
    const params = mode === "fast_travel" ? { target_character_id: characterId, target_location_id: locationId } : { target_character_id: characterId, target_location_id: locationId, target_mode: mode };
    ({ data, error } = await supabase.rpc(fn, params));
  }
  if (error || !data) {
    const detail = error?.message ?? "";
    const code = detail.includes("already there") ? "already_there" : detail.includes("journey active") ? "journey_active" : detail.includes("insufficient food") ? "insufficient_food" : detail.includes("insufficient funds") ? "insufficient_funds" : detail.includes("unavailable") ? "unavailable" : detail.includes("not found") ? "not_found" : "travel_failed";
    return NextResponse.json({ error: code }, { status: ["already_there", "journey_active", "unavailable", "insufficient_food", "insufficient_funds"].includes(code) ? 409 : code === "not_found" ? 404 : 500 });
  }
  return NextResponse.json({ travel: data });
}
