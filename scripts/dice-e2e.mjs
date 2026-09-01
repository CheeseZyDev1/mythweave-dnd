import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.TEST_APP_URL ?? "http://127.0.0.1:3210";
if (!url || !publishableKey || !serviceRoleKey) throw new Error("Missing Supabase test environment variables.");

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = crypto.randomUUID().replaceAll("-", "");
const password = `Mythweave-${suffix}-9A`;
const users = [];
const browserClients = [];

function browserClient() {
  const cookieJar = new Map();
  const client = createBrowserClient(url, publishableKey, {
    cookies: {
      getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
      setAll: (items) => items.forEach(({ name, value }) => value ? cookieJar.set(name, value) : cookieJar.delete(name)),
    },
  });
  return { client, cookie: () => [...cookieJar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; ") };
}

async function createPlayer(label) {
  const emailSlug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const email = `mythweave-dice-${emailSlug}-${suffix}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: label } });
  if (error || !data.user) throw error ?? new Error("Could not create test user.");
  users.push(data.user.id);
  const browser = browserClient();
  browserClients.push(browser.client);
  const { data: loginData, error: loginError } = await browser.client.auth.signInWithPassword({ email, password });
  if (loginError || !loginData.session) throw loginError ?? new Error("Test user login did not return a session.");
  browser.client.realtime.setAuth(loginData.session.access_token);
  return browser;
}

try {
  const host = await createPlayer("Dice Host");
  const guest = await createPlayer("Dice Guest");

  const createResponse = await fetch(`${appUrl}/api/dice/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: host.cookie() },
    body: JSON.stringify({ action: "create" }),
  });
  const created = await createResponse.json();
  if (createResponse.status !== 201 || !created.tableId || !/^[A-F0-9]{4}(?:-[A-F0-9]{4}){2}$/.test(created.code)) throw new Error(`Create table failed: ${createResponse.status} ${JSON.stringify(created)}`);

  const joinResponse = await fetch(`${appUrl}/api/dice/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: guest.cookie() },
    body: JSON.stringify({ action: "join", code: created.code }),
  });
  if (!joinResponse.ok) {
    const responseBody = await joinResponse.text();
    const { error: rpcError } = await guest.client.rpc("join_dice_table", { invite_code: created.code, member_name: "Dice Guest" }).single();
    throw new Error(`Join table failed: ${joinResponse.status} ${responseBody}; RPC: ${rpcError?.message ?? "unknown"}`);
  }

  let eventResolve;
  let eventReject;
  const realtimeEvent = new Promise((resolve, reject) => { eventResolve = resolve; eventReject = reject; });
  const channel = guest.client.channel(`e2e-${suffix}`).on("postgres_changes", {
    event: "INSERT", schema: "public", table: "dice_rolls", filter: `table_id=eq.${created.tableId}`,
  }, (payload) => eventResolve(payload.new));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Realtime subscription timed out.")), 10000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") { clearTimeout(timer); resolve(); }
      if (status === "CHANNEL_ERROR") { clearTimeout(timer); reject(new Error("Realtime channel error.")); }
    });
  });

  const eventTimer = setTimeout(() => eventReject(new Error("Guest did not receive the dice roll in realtime.")), 10000);
  const rollResponse = await fetch(`${appUrl}/api/dice/roll`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: host.cookie() },
    body: JSON.stringify({ tableId: created.tableId, diceCount: 2, diceSides: 20, modifier: 3 }),
  });
  const rollBody = await rollResponse.json();
  if (rollResponse.status !== 201 || !rollBody.roll) throw new Error(`Roll failed: ${rollResponse.status} ${JSON.stringify(rollBody)}`);
  const received = await realtimeEvent;
  clearTimeout(eventTimer);
  if (received.id !== rollBody.roll.id || received.total !== received.rolls.reduce((sum, value) => sum + value, 0) + 3) throw new Error("Realtime result did not match the server result.");

  const invalidResponse = await fetch(`${appUrl}/api/dice/roll`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: host.cookie() },
    body: JSON.stringify({ tableId: created.tableId, diceCount: 1, diceSides: 7, modifier: 0 }),
  });
  if (invalidResponse.status !== 400) throw new Error("Invalid dice type was not rejected.");

  async function initiativeAction(player, action, extra = {}) {
    const response = await fetch(`${appUrl}/api/initiative`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: player.cookie() },
      body: JSON.stringify({ action, tableId: created.tableId, ...extra }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`Initiative ${action} failed: ${response.status} ${JSON.stringify(body)}`);
    return body;
  }

  const hostEntry = await initiativeAction(host, "add", { name: "Aria", initiative: 18 });
  const guestEntry = await initiativeAction(guest, "add", { name: "Goblin", initiative: 12 });
  if (!hostEntry.entry?.id || !guestEntry.entry?.id) throw new Error("Initiative entries were not created.");

  let initiativeResolve;
  let initiativeReject;
  const initiativeEvent = new Promise((resolve, reject) => { initiativeResolve = resolve; initiativeReject = reject; });
  const initiativeChannel = guest.client.channel(`initiative-e2e-${suffix}`).on("postgres_changes", {
    event: "UPDATE", schema: "public", table: "initiative_trackers", filter: `table_id=eq.${created.tableId}`,
  }, (payload) => initiativeResolve(payload.new));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Initiative subscription timed out.")), 10000);
    initiativeChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") { clearTimeout(timer); resolve(); }
      if (status === "CHANNEL_ERROR") { clearTimeout(timer); reject(new Error("Initiative channel error.")); }
    });
  });
  const initiativeTimer = setTimeout(() => initiativeReject(new Error("Guest did not receive initiative state.")), 10000);
  const firstTurn = await initiativeAction(host, "next");
  const receivedInitiative = await initiativeEvent;
  clearTimeout(initiativeTimer);
  if (firstTurn.tracker.current_entry_id !== hostEntry.entry.id || receivedInitiative.current_entry_id !== hostEntry.entry.id || firstTurn.tracker.round_number !== 1) throw new Error("Initiative did not start with the highest roll.");
  const secondTurn = await initiativeAction(guest, "next");
  const nextRound = await initiativeAction(host, "next");
  if (secondTurn.tracker.current_entry_id !== guestEntry.entry.id || nextRound.tracker.current_entry_id !== hostEntry.entry.id || nextRound.tracker.round_number !== 2) throw new Error("Initiative order or round advancement is incorrect.");

  const { data: guestRolls, error: guestReadError } = await guest.client.from("dice_rolls").select("id").eq("table_id", created.tableId);
  if (guestReadError || guestRolls.length !== 1) throw guestReadError ?? new Error("Member could not read shared rolls.");
  const outsider = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { data: publicRolls, error: publicReadError } = await outsider.from("dice_rolls").select("id").eq("table_id", created.tableId);
  if (publicReadError || publicRolls.length !== 0) throw publicReadError ?? new Error("RLS exposed rolls to the public.");
  const { data: publicInitiative, error: publicInitiativeError } = await outsider.from("initiative_entries").select("id").eq("table_id", created.tableId);
  if (publicInitiativeError || publicInitiative.length !== 0) throw publicInitiativeError ?? new Error("RLS exposed initiative entries to the public.");

  await guest.client.removeChannel(channel);
  await guest.client.removeChannel(initiativeChannel);
  console.log(JSON.stringify({ privateTable: true, inviteJoin: true, serverRoll: true, realtimeToGuest: true, invalidDiceRejected: true, initiativeOrder: true, initiativeRealtime: true, roundAdvance: true, memberRead: true, publicDenied: true, total: received.total }));
} finally {
  for (const client of browserClients) client.realtime.disconnect();
  for (const userId of users) await admin.auth.admin.deleteUser(userId);
}
