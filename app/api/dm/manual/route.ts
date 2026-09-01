import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const {data:activeSolo}=await supabase.from("solo_adventures").select("id").eq("status","active").maybeSingle();if(activeSolo)return NextResponse.json({error:"solo_no_dm"},{status:409});

  const tableId = new URL(request.url).searchParams.get("tableId") ?? "";
  if (!UUID.test(tableId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data: ownMember } = await supabase
    .from("dice_table_members")
    .select("role")
    .eq("table_id", tableId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (ownMember?.role !== "dm") {
    return NextResponse.json({ error: "dm_required" }, { status: 403 });
  }

  const [
    { data: members },
    { data: rolls },
    { data: tracker },
    { data: entries },
    { data: messages },
    { data: npcHistory },
  ] = await Promise.all([
    supabase
      .from("dice_table_members")
      .select("display_name,role")
      .eq("table_id", tableId)
      .order("joined_at"),
    supabase
      .from("dice_rolls")
      .select("roller_name,dice_count,dice_sides,total")
      .eq("table_id", tableId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("initiative_trackers")
      .select("current_entry_id,round_number,active")
      .eq("table_id", tableId)
      .maybeSingle(),
    supabase
      .from("initiative_entries")
      .select("id,name")
      .eq("table_id", tableId),
    supabase
      .from("room_messages")
      .select("sender_name,content")
      .eq("table_id", tableId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("npc_dialogue_history")
      .select("npc_name,text_th")
      .eq("table_id", tableId)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const currentTurn = entries?.find(
    (entry) => entry.id === tracker?.current_entry_id,
  )?.name;
  const prompt = [
    "คุณคือ Dungeon Master ของเกม D&D ภาษาไทย เขียนฉากต่อไปให้กระชับ สนุก และเสนอทางเลือก 3 ทาง",
    `สมาชิก: ${members?.map((member) => `${member.display_name} (${member.role})`).join(", ") || "ไม่มี"}`,
    `Initiative: ${tracker?.active ? `รอบ ${tracker.round_number} · ถึงตา ${currentTurn ?? "ไม่ทราบ"}` : "ยังไม่เริ่ม"}`,
    `ผลเต๋าล่าสุด:\n${rolls?.map((roll) => `${roll.roller_name}: ${roll.dice_count}d${roll.dice_sides} = ${roll.total}`).join("\n") || "ไม่มี"}`,
    `แชตล่าสุด:\n${messages?.map((message) => `${message.sender_name}: ${message.content}`).join("\n") || "ไม่มี"}`,
    `บท NPC ล่าสุด:\n${npcHistory?.map((line) => `${line.npc_name}: ${line.text_th}`).join("\n") || "ไม่มี"}`,
    "ตอบเฉพาะคำบรรยายฉากและตัวเลือก ห้ามตัดสินใจแทนผู้เล่น",
  ].join("\n\n");

  return NextResponse.json({ prompt });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const {data:activeSolo}=await supabase.from("solo_adventures").select("id").eq("status","active").maybeSingle();if(activeSolo)return NextResponse.json({error:"solo_no_dm"},{status:409});

  const body = await request.json().catch(() => null);
  const tableId = String(body?.tableId ?? "");
  const narration = String(body?.narration ?? "").trim();
  if (
    !UUID.test(tableId) ||
    narration.length < 1 ||
    narration.length > 5000
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data, error } = await supabase
    .rpc("publish_dm_narration", {
      target_table_id: tableId,
      target_narration: narration,
    })
    .single();
  if (error || !data) {
    const forbidden = error?.message.includes("dm required");
    return NextResponse.json(
      { error: forbidden ? "dm_required" : "publish_failed" },
      { status: forbidden ? 403 : 500 },
    );
  }
  return NextResponse.json({ narration: data }, { status: 201 });
}
