import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const characterId = String(body?.characterId ?? "");
  const itemId = Number(body?.itemId);
  if (!UUID.test(characterId) || !Number.isInteger(itemId) || itemId < 1) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { data, error } = await supabase.rpc("haggle_shop_item", {
    target_character_id: characterId,
    target_item_id: itemId,
  });
  if (error || !data) {
    const code = error?.message.includes("cooldown")
      ? "cooldown"
      : error?.message.includes("not found")
        ? "not_found"
        : "haggle_failed";
    return NextResponse.json(
      { error: code },
      { status: code === "cooldown" ? 409 : code === "not_found" ? 404 : 500 },
    );
  }
  return NextResponse.json({ haggle: data }, { status: 201 });
}
