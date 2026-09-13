import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const appUrl = process.env.TEST_APP_URL ?? "http://127.0.0.1:3212";
if (!url || !key) throw new Error("Missing test environment");
const ids = [];
const suffix = crypto.randomUUID().replaceAll("-", "");

function browser() {
  const jar = new Map();
  return {
    client: createBrowserClient(url, key, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (items) =>
          items.forEach(({ name, value }) =>
            value ? jar.set(name, value) : jar.delete(name),
          ),
      },
    }),
    cookie: () =>
      [...jar]
        .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
        .join("; "),
  };
}

async function player(name) {
  const item = browser();
  const email = `room-dm-${name.toLowerCase()}-${suffix}@example.com`;
  const password = `Mythweave-${suffix}-9A`;
  const { data, error } = await item.client.auth.signUp({
    email,
    password,
    options: { data: { display_name: name } },
  });
  if (error || !data.user || !data.session)
    throw error ?? new Error("No signup session");
  ids.push(data.user.id);
  return item;
}

async function post(client, path, body) {
  const response = await fetch(`${appUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: client.cookie() },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

const host = await player("Host");
const guest = await player("Guest");
const { data: dimension } = await host.client
  .from("dimension_presets")
  .select("id")
  .eq("slug", "aetherra-prime")
  .single();
const make = (client, name) =>
  post(client, "/api/characters", {
    name,
    race: "human",
    characterClass: "fighter",
    dimensionId: dimension.id,
    stats: {
      strength: 14,
      dexterity: 13,
      constitution: 12,
      intelligence: 10,
      wisdom: 8,
      charisma: 8,
    },
    appearance: {
      skinTone: "warm",
      hairStyle: "short",
      hairColor: "raven",
      face: "sharp",
      body: "balanced",
    },
  });
const hostCharacter = await make(host, "Room Captain");
const hostAlternate = await make(host, "Room Scout");
const guestCharacter = await make(guest, "Room Guest");
const room = await post(host, "/api/dice/tables", {
  action: "create",
  characterId: hostCharacter.body.id,
  dmMode: "subscription",
});
if (room.response.status !== 201 || room.body.dmMode !== "subscription")
  throw new Error("Configured room creation failed");
const selectedAlternate = await post(host, "/api/dice/tables", {
  action: "select_character",
  tableId: room.body.tableId,
  characterId: hostAlternate.body.id,
});
if (!selectedAlternate.response.ok)
  throw new Error("Room member could not select another owned character");
const { data: selectedMember } = await host.client
  .from("dice_table_members")
  .select("character_id")
  .eq("table_id", room.body.tableId)
  .eq("user_id", (await host.client.auth.getUser()).data.user.id)
  .single();
if (selectedMember.character_id !== hostAlternate.body.id)
  throw new Error("Selected room character did not persist");
const foreignSelection = await post(guest, "/api/dice/tables", {
  action: "select_character",
  tableId: room.body.tableId,
  characterId: hostAlternate.body.id,
});
if (foreignSelection.response.status !== 404)
  throw new Error("Another account selected a character it does not own");
const restoredHost = await post(host, "/api/dice/tables", {
  action: "select_character",
  tableId: room.body.tableId,
  characterId: hostCharacter.body.id,
});
if (!restoredHost.response.ok)
  throw new Error("Room member could not restore their original character");
const forbidden = await post(guest, "/api/dice/tables", {
  action: "join",
  code: room.body.code,
  role: "dm",
  characterId: guestCharacter.body.id,
});
if (
  forbidden.response.status !== 400 ||
  forbidden.body.error !== "invalid_role"
)
  throw new Error("Guest claimed DM role");
const joined = await post(guest, "/api/dice/tables", {
  action: "join",
  code: room.body.code,
  role: "player",
  characterId: guestCharacter.body.id,
});
if (joined.response.status !== 200)
  throw new Error(`Player join failed ${JSON.stringify(joined.body)}`);
const lobbyHtml = await fetch(`${appUrl}/lobby`, {
  headers: { Cookie: host.cookie() },
}).then((response) => response.text());
if (
  !lobbyHtml.includes("ห้องที่เคยเข้าร่วม") ||
  !lobbyHtml.includes(room.body.code) ||
  !lobbyHtml.includes("Host") ||
  !lobbyHtml.includes("Guest")
)
  throw new Error("Private member room list missing from lobby");
const narration = await post(host, "/api/dm/manual", {
  tableId: room.body.tableId,
  narration: "เสียงใบไม้ไหวเตือนว่ามีบางสิ่งกำลังเข้ามาใกล้",
});
if (narration.response.status !== 201)
  throw new Error(`Narration publish failed ${JSON.stringify(narration.body)}`);
const gateway = await fetch(`${appUrl}/dice`, {
  headers: { Cookie: host.cookie() },
}).then((response) => response.text());
const roomHtml = await fetch(`${appUrl}/dice?table=${room.body.tableId}`, {
  headers: { Cookie: host.cookie() },
}).then((response) => response.text());
if (
  !gateway.includes("3 SIMPLE STEPS") ||
  !gateway.includes("DM คนจริง") ||
  !gateway.includes("AI · SUB") ||
  !gateway.includes("AI · API") ||
  !roomHtml.includes("AI DM · SUB MODE") ||
  !roomHtml.includes("อัปเดตล่าสุด + คัดลอก") ||
  !roomHtml.includes("เสียงผู้บรรยาย") ||
  !roomHtml.includes("เปิดอ่านอัตโนมัติ")
)
  throw new Error(
    "Room setup, subscription prompt, or narration voice UI missing",
  );
console.log(
  JSON.stringify({
    userIds: ids,
    guidedRoomSetup: true,
    lobbyRoomActions: true,
    privateMemberRoomList: true,
    humanDm: true,
    subscriptionDm: true,
    apiDm: true,
    narrationVoice: true,
    hostOnlyDm: true,
    inviteJoin: true,
  }),
);
