import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const tableId = String(body?.tableId ?? "");
  const content = String(body?.content ?? "").trim();
  if (!UUID.test(tableId) || content.length < 1 || content.length > 500) return NextResponse.json({ error: "invalid_message" }, { status: 400 });

  const { data, error } = await supabase.rpc("send_room_message", { target_table_id: tableId, message_content: content }).single();
  if (error || !data) {
    const code = error?.message.includes("rate limited") ? "rate_limited" : error?.message.includes("not a member") ? "not_a_member" : "send_failed";
    return NextResponse.json({ error: code }, { status: code === "rate_limited" ? 429 : code === "not_a_member" ? 403 : 500 });
  }
  return NextResponse.json({ message: data }, { status: 201 });
}

