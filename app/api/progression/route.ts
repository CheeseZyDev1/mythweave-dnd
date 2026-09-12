import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null),
    action = String(body?.action ?? ""),
    characterId = String(body?.characterId ?? "");
  if (!UUID.test(characterId))
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  let result: { data: unknown; error: { message: string } | null };
  if (action === "fuse")
    result = await supabase.rpc("fuse_character_skills", {
      target_character_id: characterId,
      target_first_skill_id: Number(body.firstSkillId),
      target_second_skill_id: Number(body.secondSkillId),
    });
  else if (action === "bind_rune")
    result = await supabase.rpc("bind_skill_rune", {
      target_character_id: characterId,
      target_skill_id: Number(body.skillId),
      target_rune_id: Number(body.runeId),
    });
  else if (action === "search_runes")
    result = await supabase.rpc("search_rune_lore", {
      target_character_id: characterId,
    });
  else if (action === "study_rune")
    result = await supabase.rpc("study_rune_record", {
      target_character_id: characterId,
      target_language_id: String(body.languageId ?? ""),
    });
  else if (action === "train_profession")
    result = await supabase.rpc("train_character_profession", {
      target_character_id: characterId,
    });
  else return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  if (result.error) {
    const detail = result.error.message;
    const code = detail.includes("language required")
      ? "language_required"
      : detail.includes("record required")
        ? "record_required"
        : detail.includes("already studied")
          ? "already_studied"
          : detail.includes("cooldown")
            ? "cooldown"
            : detail.includes("different skills")
              ? "different_skills"
              : detail.includes("fusion limit")
                ? "fusion_limit"
                : detail.includes("level required")
                  ? "level_required"
                  : detail.includes("max rank")
                    ? "max_rank"
                    : "action_failed";
    return NextResponse.json(
      { error: code },
      { status: code === "action_failed" ? 500 : 409 },
    );
  }
  return NextResponse.json({ result: result.data }, { status: 201 });
}
