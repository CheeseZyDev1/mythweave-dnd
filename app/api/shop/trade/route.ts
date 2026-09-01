import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");
  const characterId = String(body?.characterId ?? "");
  const itemId = Number(body?.itemId);
  const quantity = Number(body?.quantity);
  if (
    !["buy", "sell"].includes(action) ||
    !UUID.test(characterId) ||
    !Number.isInteger(itemId) ||
    itemId < 1 ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 99
  )
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const fn = action === "buy" ? "buy_shop_item" : "sell_shop_item";
  const { data, error } = await supabase.rpc(fn, {
    target_character_id: characterId,
    target_item_id: itemId,
    target_quantity: quantity,
  });
  if (error || !data) {
    const code = error?.message.includes("insufficient funds")
      ? "insufficient_funds"
      : error?.message.includes("insufficient items")
        ? "insufficient_items"
        : error?.message.includes("not found")
          ? "not_found"
          : "trade_failed";
    return NextResponse.json(
      { error: code },
      {
        status: code.startsWith("insufficient")
          ? 409
          : code === "not_found"
            ? 404
            : 500,
      },
    );
  }
  return NextResponse.json({ trade: data });
}
