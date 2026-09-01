import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const characterId = new URL(request.url).searchParams.get("character") ?? "";
  if (!UUID.test(characterId)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { data, error } = await supabase.rpc("get_character_weather", { target_character_id: characterId });
  if (error || !data) return NextResponse.json({ error: error?.message.includes("not found") ? "not_found" : "weather_failed" }, { status: error?.message.includes("not found") ? 404 : 500 });
  return NextResponse.json({ weather: data });
}
