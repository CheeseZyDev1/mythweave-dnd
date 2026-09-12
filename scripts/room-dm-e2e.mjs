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
        setAll: (items) => items.forEach(({ name, value }) => value ? jar.set(name, value) : jar.delete(name)),
      },
    }),
    cookie: () => [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; "),
  };
}

async function player(name) {
  const item = browser();
  const email = `room-dm-${name.toLowerCase()}-${suffix}@example.com`;
  const password = `Mythweave-${suffix}-9A`;
  const { data, error } = await item.client.auth.signUp({ email, password, options: { data: { display_name: name } } });
  if (error || !data.user || !data.session) throw error ?? new Error("No signup session");
  ids.push(data.user.id);
  return item;
}

async function post(client, path, body) {
  const response = await fetch(`${appUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: client.cookie() }, body: JSON.stringify(body) });
  return { response, body: await response.json() };
}

const host = await player("Host");
const guest = await player("Guest");
const { data: dimension } = await host.client.from("dimension_presets").select("id").eq("slug", "aetherra-prime").single();
const make = (client, name) => post(client, "/api/characters", { name, race: "human", characterClass: "fighter", dimensionId: dimension.id, stats: { strength: 14, dexterity: 13, constitution: 12, intelligence: 10, wisdom: 8, charisma: 8 }, appearance: { skinTone: "warm", hairStyle: "short", hairColor: "raven", face: "sharp", body: "balanced" } });
const hostCharacter = await make(host, "Room Captain");
const guestCharacter = await make(guest, "Room Guest");
const room = await post(host, "/api/dice/tables", { action: "create", characterId: hostCharacter.body.id, dmMode: "subscription" });
if (room.response.status !== 201 || room.body.dmMode !== "subscription") throw new Error("Configured room creation failed");
const forbidden = await post(guest, "/api/dice/tables", { action: "join", code: room.body.code, role: "dm", characterId: guestCharacter.body.id });
if (forbidden.response.status !== 400 || forbidden.body.error !== "invalid_role") throw new Error("Guest claimed DM role");
const joined = await post(guest, "/api/dice/tables", { action: "join", code: room.body.code, role: "player", characterId: guestCharacter.body.id });
if (joined.response.status !== 200) throw new Error(`Player join failed ${JSON.stringify(joined.body)}`);
const gateway = await fetch(`${appUrl}/dice`, { headers: { Cookie: host.cookie() } }).then(response => response.text());
const roomHtml = await fetch(`${appUrl}/dice?table=${room.body.tableId}`, { headers: { Cookie: host.cookie() } }).then(response => response.text());
if (!gateway.includes("3 SIMPLE STEPS") || !gateway.includes("DM คนจริง") || !gateway.includes("AI · SUB") || !gateway.includes("AI · API") || !roomHtml.includes("AI DM · SUB MODE") || !roomHtml.includes("อัปเดตล่าสุด + คัดลอก")) throw new Error("Room setup or subscription prompt UI missing");
console.log(JSON.stringify({ userIds: ids, guidedRoomSetup: true, humanDm: true, subscriptionDm: true, apiDm: true, hostOnlyDm: true, inviteJoin: true }));
