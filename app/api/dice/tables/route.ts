import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");
  const displayName = String(
    user.user_metadata?.display_name ??
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split("@")[0] ??
      "Adventurer",
  )
    .trim()
    .slice(0, 40);
  const requestedCharacterId = String(body?.characterId ?? "");
  const [
    { data: ownedCharacters },
    { data: lifeProfiles },
    { data: activeSolo },
  ] = await Promise.all([
    supabase
      .from("characters")
      .select("id,dimension_id")
      .order("created_at", { ascending: false }),
    supabase.from("character_life_profiles").select("character_id,status"),
    supabase
      .from("solo_adventures")
      .select("character_id")
      .eq("status", "active")
      .maybeSingle(),
  ]);
  const aliveIds = new Set(
    lifeProfiles
      ?.filter((profile) => profile.status === "alive")
      .map((profile) => profile.character_id) ?? [],
  );
  const requestedOwned =
    ownedCharacters?.some(
      (character) => character.id === requestedCharacterId,
    ) ?? false;
  if (
    requestedCharacterId &&
    requestedOwned &&
    !aliveIds.has(requestedCharacterId)
  )
    return NextResponse.json(
      { error: "character_unavailable" },
      { status: 409 },
    );
  let characterId = requestedOwned
    ? requestedCharacterId
    : (ownedCharacters?.find((character) => aliveIds.has(character.id))?.id ??
      null);
  let isGhost = false;
  if (activeSolo) {
    const { data: life } = await supabase
      .from("solo_life_states")
      .select("status")
      .eq("character_id", activeSolo.character_id)
      .maybeSingle();
    isGhost = life?.status === "dead";
    if (isGhost) characterId = activeSolo.character_id;
  }

  if (action === "create") {
    if (activeSolo)
      return NextResponse.json({ error: "solo_mode_active" }, { status: 409 });
    if (!characterId)
      return NextResponse.json(
        { error: "character_required" },
        { status: 409 },
      );
    const dmMode = String(body?.dmMode ?? "human");
    if (!["human", "subscription", "api"].includes(dmMode))
      return NextResponse.json({ error: "invalid_dm_mode" }, { status: 400 });
    const { data, error } = await supabase
      .rpc("create_configured_dimension_dice_table", {
        member_name: displayName,
        target_character_id: characterId,
        target_dm_mode: dmMode,
      })
      .single<{ table_id: string; table_code: string }>();
    if (error || !data) {
      const detail = error?.message ?? "";
      const errorCode = detail.includes("character unavailable")
        ? "character_unavailable"
        : detail.includes("solo mode forbids rooms")
          ? "solo_mode_active"
          : "create_failed";
      return NextResponse.json(
        { error: errorCode },
        { status: errorCode === "create_failed" ? 500 : 409 },
      );
    }
    return NextResponse.json(
      {
        tableId: data.table_id,
        code: data.table_code,
        characterId,
        dimensionId: ownedCharacters?.find((item) => item.id === characterId)
          ?.dimension_id,
        dmMode,
      },
      { status: 201 },
    );
  }

  if (action === "join") {
    const code = String(body?.code ?? "")
      .trim()
      .toUpperCase();
    const role = String(body?.role ?? "player").toLowerCase();
    if (!/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(code))
      return NextResponse.json({ error: "invalid_code" }, { status: 400 });
    if (!["player", "spectator"].includes(role))
      return NextResponse.json({ error: "invalid_role" }, { status: 400 });
    if (activeSolo && !isGhost)
      return NextResponse.json({ error: "solo_mode_active" }, { status: 409 });
    if (isGhost && role !== "spectator")
      return NextResponse.json(
        { error: "ghost_spectator_only" },
        { status: 409 },
      );
    const { data, error } = await supabase
      .rpc("join_dimension_dice_table", {
        invite_code: code,
        member_name: displayName,
        requested_role: role,
        target_character_id: characterId,
      })
      .single<{ table_id: string; table_code: string }>();
    if (error || !data) {
      const detail = error?.message ?? "";
      const errorCode = detail.includes("dimension mismatch")
        ? "dimension_mismatch"
        : detail.includes("ghost spectator only")
          ? "ghost_spectator_only"
          : detail.includes("solo mode forbids rooms")
            ? "solo_mode_active"
            : "table_not_found";
      return NextResponse.json(
        { error: errorCode },
        { status: errorCode === "table_not_found" ? 404 : 409 },
      );
    }
    return NextResponse.json({
      tableId: data.table_id,
      code: data.table_code,
      ghost: isGhost,
      characterId,
    });
  }

  if (action === "select_character") {
    const tableId = String(body?.tableId ?? "");
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        tableId,
      )
    ) {
      return NextResponse.json({ error: "invalid_table" }, { status: 400 });
    }
    if (!requestedCharacterId || !requestedOwned) {
      return NextResponse.json(
        { error: "character_not_found" },
        { status: 404 },
      );
    }
    const { error } = await supabase.rpc("link_dice_member_character", {
      target_table_id: tableId,
      target_character_id: requestedCharacterId,
    });
    if (error) {
      const detail = error.message ?? "";
      const errorCode = detail.includes("dimension mismatch")
        ? "dimension_mismatch"
        : detail.includes("not a member")
          ? "not_a_member"
          : detail.includes("character not found")
            ? "character_not_found"
            : "select_character_failed";
      return NextResponse.json(
        { error: errorCode },
        { status: errorCode === "not_a_member" ? 403 : 409 },
      );
    }
    return NextResponse.json({ tableId, characterId: requestedCharacterId });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
