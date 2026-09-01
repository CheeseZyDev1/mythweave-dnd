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
    body: JSON.stringify({ action: "join", code: created.code, role: "spectator" }),
  });
  if (!joinResponse.ok) {
    const responseBody = await joinResponse.text();
    const { error: rpcError } = await guest.client.rpc("join_dice_table", { invite_code: created.code, member_name: "Dice Guest", requested_role: "spectator" }).single();
    throw new Error(`Join table failed: ${joinResponse.status} ${responseBody}; RPC: ${rpcError?.message ?? "unknown"}`);
  }

  const { data: roles, error: rolesError } = await host.client.from("dice_table_members").select("user_id,role").eq("table_id", created.tableId);
  if (rolesError || roles.find((member) => member.user_id === users[0])?.role !== "dm" || roles.find((member) => member.user_id === users[1])?.role !== "spectator") throw rolesError ?? new Error("Room roles were not persisted correctly.");

  let chatResolve;
  let chatReject;
  const chatEvent = new Promise((resolve, reject) => { chatResolve = resolve; chatReject = reject; });
  const chatChannel = guest.client.channel(`chat-e2e-${suffix}`).on("postgres_changes", {
    event: "INSERT", schema: "public", table: "room_messages", filter: `table_id=eq.${created.tableId}`,
  }, (payload) => chatResolve(payload.new));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Chat subscription timed out.")), 10000);
    chatChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") { clearTimeout(timer); resolve(); }
      if (status === "CHANNEL_ERROR") { clearTimeout(timer); reject(new Error("Chat channel error.")); }
    });
  });
  const chatTimer = setTimeout(() => chatReject(new Error("Guest did not receive room chat.")), 10000);
  const chatResponse = await fetch(`${appUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: host.cookie() },
    body: JSON.stringify({ tableId: created.tableId, content: "Gather at the old gate." }),
  });
  const chatBody = await chatResponse.json();
  if (chatResponse.status !== 201 || chatBody.message?.sender_role !== "dm") throw new Error(`Chat send failed: ${chatResponse.status} ${JSON.stringify(chatBody)}`);
  const receivedChat = await chatEvent;
  clearTimeout(chatTimer);
  if (receivedChat.id !== chatBody.message.id || receivedChat.content !== "Gather at the old gate.") throw new Error("Realtime chat did not match the stored message.");
  const longChatResponse = await fetch(`${appUrl}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: guest.cookie() }, body: JSON.stringify({ tableId: created.tableId, content: "x".repeat(501) }) });
  if (longChatResponse.status !== 400) throw new Error("Oversized chat message was not rejected.");

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

  async function saveAction(player, action, slot, name) {
    const response = await fetch(`${appUrl}/api/room-saves`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: player.cookie() }, body: JSON.stringify({ action, tableId: created.tableId, slot, name }) });
    const body = await response.json();
    return { response, body };
  }
  const savedRoom = await saveAction(host, "save", 1, "Round Two");
  if (savedRoom.response.status !== 200 || savedRoom.body.save?.entry_count !== 2 || savedRoom.body.save?.round_number !== 2) throw new Error(`Room save failed: ${savedRoom.response.status} ${JSON.stringify(savedRoom.body)}`);
  const spectatorSave = await saveAction(guest, "save", 2, "Forbidden Save");
  if (spectatorSave.response.status !== 403) throw new Error("Spectator was allowed to save room state.");
  await initiativeAction(host, "reset");
  const { data: clearedEntries } = await host.client.from("initiative_entries").select("id").eq("table_id", created.tableId);
  if (clearedEntries?.length !== 0) throw new Error("Initiative reset did not clear entries before load test.");
  const loadedRoom = await saveAction(host, "load", 1);
  if (loadedRoom.response.status !== 200) throw new Error(`Room load failed: ${loadedRoom.response.status} ${JSON.stringify(loadedRoom.body)}`);
  const [{ data: restoredEntries }, { data: restoredTracker }] = await Promise.all([
    host.client.from("initiative_entries").select("id,name,initiative").eq("table_id", created.tableId),
    host.client.from("initiative_trackers").select("current_entry_id,round_number,active").eq("table_id", created.tableId).single(),
  ]);
  if (restoredEntries?.length !== 2 || restoredTracker?.current_entry_id !== hostEntry.entry.id || restoredTracker.round_number !== 2 || !restoredTracker.active) throw new Error("Loaded room state did not restore the saved encounter.");

  const { data: guestRolls, error: guestReadError } = await guest.client.from("dice_rolls").select("id").eq("table_id", created.tableId);
  if (guestReadError || guestRolls.length !== 1) throw guestReadError ?? new Error("Member could not read shared rolls.");
  const outsider = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { data: publicRolls, error: publicReadError } = await outsider.from("dice_rolls").select("id").eq("table_id", created.tableId);
  if (publicReadError || publicRolls.length !== 0) throw publicReadError ?? new Error("RLS exposed rolls to the public.");
  const { data: publicInitiative, error: publicInitiativeError } = await outsider.from("initiative_entries").select("id").eq("table_id", created.tableId);
  if (publicInitiativeError || publicInitiative.length !== 0) throw publicInitiativeError ?? new Error("RLS exposed initiative entries to the public.");
  const { data: publicMessages, error: publicMessagesError } = await outsider.from("room_messages").select("id").eq("table_id", created.tableId);
  if (publicMessagesError || publicMessages.length !== 0) throw publicMessagesError ?? new Error("RLS exposed room chat to the public.");
  const { data: publicSaves, error: publicSavesError } = await outsider.from("room_saves").select("id").eq("table_id", created.tableId);
  if (publicSavesError || publicSaves.length !== 0) throw publicSavesError ?? new Error("RLS exposed room saves to the public.");

  const contentResponse = await fetch(`${appUrl}/api/content/summary`, { headers: { Cookie: host.cookie() } });
  const contentSummary = await contentResponse.json();
  if (!contentResponse.ok || contentSummary.items?.common !== 40 || contentSummary.items?.uncommon !== 25 || contentSummary.dialogue !== 32 || contentSummary.quests !== 30 || contentSummary.events !== 15) throw new Error(`Static content pool counts are incorrect: ${JSON.stringify(contentSummary)}`);
  const contentPage = await fetch(`${appUrl}/content`, { headers: { Cookie: host.cookie() } });
  if (!contentPage.ok || !(await contentPage.text()).includes("คลังเรื่องราว")) throw new Error("World content page did not render.");

  let npcResolve;
  let npcReject;
  const npcEvent = new Promise((resolve,reject)=>{npcResolve=resolve;npcReject=reject;});
  const npcChannel=guest.client.channel(`npc-e2e-${suffix}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"npc_dialogue_history",filter:`table_id=eq.${created.tableId}`},payload=>npcResolve(payload.new));
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("NPC subscription timed out.")),10000);npcChannel.subscribe(status=>{if(status==="SUBSCRIBED"){clearTimeout(timer);resolve();}if(status==="CHANNEL_ERROR"){clearTimeout(timer);reject(new Error("NPC channel error."));}});});
  const npcTimer=setTimeout(()=>npcReject(new Error("Guest did not receive NPC dialogue.")),10000);
  const npcResponse=await fetch(`${appUrl}/api/npc/dialogue`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:host.cookie()},body:JSON.stringify({tableId:created.tableId,npcName:"Elder Elrin",speakerType:"villager",context:"greeting"})});
  const npcBody=await npcResponse.json();
  if(npcResponse.status!==201||npcBody.dialogue?.context!=="greeting"||!npcBody.dialogue?.text_th)throw new Error(`NPC dialogue failed: ${npcResponse.status} ${JSON.stringify(npcBody)}`);
  const receivedNpc=await npcEvent;clearTimeout(npcTimer);
  if(receivedNpc.id!==npcBody.dialogue.id)throw new Error("Realtime NPC dialogue did not match.");
  const {data:publicNpc,error:publicNpcError}=await outsider.from("npc_dialogue_history").select("id").eq("table_id",created.tableId);
  if(publicNpcError||publicNpc.length!==0)throw publicNpcError??new Error("RLS exposed NPC dialogue.");

  await guest.client.removeChannel(channel);
  await guest.client.removeChannel(initiativeChannel);
  await guest.client.removeChannel(chatChannel);
  await guest.client.removeChannel(npcChannel);
  console.log(JSON.stringify({ privateTable: true, inviteJoin: true, roomRoles: true, roomChat: true, chatRealtime: true, oversizedChatRejected: true, roomSave: true, dmSaveOnly: true, roomLoadRestore: true, staticContentCounts: true, contentPage: true, npcWeightedDialogue: true, npcRealtime: true, serverRoll: true, realtimeToGuest: true, invalidDiceRejected: true, initiativeOrder: true, initiativeRealtime: true, roundAdvance: true, memberRead: true, publicDenied: true, total: received.total }));
} finally {
  for (const client of browserClients) client.realtime.disconnect();
  for (const userId of users) await admin.auth.admin.deleteUser(userId);
}
