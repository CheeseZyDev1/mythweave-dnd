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
  const bestiaryCharacterResponse=await fetch(`${appUrl}/api/characters`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:host.cookie()},body:JSON.stringify({name:"Kael Archivist",race:"human",characterClass:"wizard",stats:{strength:8,dexterity:12,constitution:13,intelligence:15,wisdom:14,charisma:10},appearance:{skinTone:"warm",hairStyle:"short",hairColor:"raven",face:"sharp",body:"balanced"}})});const bestiaryCharacterBody=await bestiaryCharacterResponse.json();if(bestiaryCharacterResponse.status!==201||!bestiaryCharacterBody.id)throw new Error(`Could not create bestiary character: ${JSON.stringify(bestiaryCharacterBody)}`);const bestiaryCharacterId=bestiaryCharacterBody.id;
  const guestCharacterResponse=await fetch(`${appUrl}/api/characters`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:guest.cookie()},body:JSON.stringify({name:"Mira Listener",race:"elf",characterClass:"ranger",stats:{strength:10,dexterity:15,constitution:12,intelligence:11,wisdom:14,charisma:10},appearance:{skinTone:"porcelain",hairStyle:"braid",hairColor:"silver",face:"soft",body:"slim"}})});const guestCharacterBody=await guestCharacterResponse.json();if(guestCharacterResponse.status!==201||!guestCharacterBody.id)throw new Error(`Could not create guest character: ${JSON.stringify(guestCharacterBody)}`);const guestCharacterId=guestCharacterBody.id;

  const createResponse = await fetch(`${appUrl}/api/dice/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: host.cookie() },
    body: JSON.stringify({ action: "create",characterId:bestiaryCharacterId }),
  });
  const created = await createResponse.json();
  if (createResponse.status !== 201 || !created.tableId || !/^[A-F0-9]{4}(?:-[A-F0-9]{4}){2}$/.test(created.code)) throw new Error(`Create table failed: ${createResponse.status} ${JSON.stringify(created)}`);

  const joinResponse = await fetch(`${appUrl}/api/dice/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: guest.cookie() },
    body: JSON.stringify({ action: "join", code: created.code, role: "spectator",characterId:guestCharacterId }),
  });
  if (!joinResponse.ok) {
    const responseBody = await joinResponse.text();
    const { error: rpcError } = await guest.client.rpc("join_dice_table", { invite_code: created.code, member_name: "Dice Guest", requested_role: "spectator" }).single();
    throw new Error(`Join table failed: ${joinResponse.status} ${responseBody}; RPC: ${rpcError?.message ?? "unknown"}`);
  }

  const { data: roles, error: rolesError } = await host.client.from("dice_table_members").select("user_id,role,character_id").eq("table_id", created.tableId);
  if (rolesError || roles.find((member) => member.user_id === users[0])?.role !== "dm" || roles.find((member) => member.user_id === users[0])?.character_id!==bestiaryCharacterId||roles.find((member) => member.user_id === users[1])?.role !== "spectator"||roles.find((member) => member.user_id === users[1])?.character_id!==guestCharacterId) throw rolesError ?? new Error("Room roles or linked characters were not persisted correctly.");
  const foreignLink=await host.client.rpc("link_dice_member_character",{target_table_id:created.tableId,target_character_id:guestCharacterId});if(!foreignLink.error?.message.includes("character not found"))throw new Error("Room member linked another player's character.");const awarenessRequest=async()=>{const response=await fetch(`${appUrl}/api/party/awareness?tableId=${created.tableId}&characterId=${bestiaryCharacterId}`,{headers:{Cookie:host.cookie()}});return{response,body:await response.json()};};const sameLocationAwareness=await awarenessRequest();if(!sameLocationAwareness.response.ok||sameLocationAwareness.body.members?.length!==2||sameLocationAwareness.body.members.some(member=>member.awareness_tier!=="same_location"))throw new Error(`Same-location party awareness failed: ${JSON.stringify(sameLocationAwareness.body)}`);const{data:awarenessLocations,error:awarenessLocationsError}=await admin.from("world_locations").select("id,slug").in("slug",["greenhollow","aetherra"]);if(awarenessLocationsError)throw awarenessLocationsError;const greenhollowLocation=awarenessLocations.find(item=>item.slug==="greenhollow");const continentLocation=awarenessLocations.find(item=>item.slug==="aetherra");const{error:nearMoveError}=await admin.from("character_world_positions").update({location_id:greenhollowLocation.id}).eq("character_id",guestCharacterId);if(nearMoveError)throw nearMoveError;const sameCityAwareness=await awarenessRequest();if(sameCityAwareness.body.members?.find(member=>member.character_id===guestCharacterId)?.awareness_tier!=="same_city")throw new Error("Party member in the same city region was misclassified.");const{error:farMoveError}=await admin.from("character_world_positions").update({location_id:continentLocation.id}).eq("character_id",guestCharacterId);if(farMoveError)throw farMoveError;const farAwareness=await awarenessRequest();if(farAwareness.body.members?.find(member=>member.character_id===guestCharacterId)?.awareness_tier!=="far_city")throw new Error("Far party member was misclassified.");const awarenessPage=await fetch(`${appUrl}/dice?table=${created.tableId}`,{headers:{Cookie:host.cookie()}});const awarenessHtml=await awarenessPage.text();if(!awarenessPage.ok||!awarenessHtml.includes("ตำแหน่งของปาร์ตี้")||!awarenessHtml.includes("อยู่คนละเมือง")||!awarenessHtml.includes("Mira Listener"))throw new Error("Party awareness tiers did not render in the room UI.");
  const{data:birdItem,error:birdItemError}=await host.client.from("content_items").select("id").eq("slug","messenger-raven").single();if(birdItemError)throw birdItemError;const buyBird=await fetch(`${appUrl}/api/shop/trade`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:host.cookie()},body:JSON.stringify({action:"buy",characterId:bestiaryCharacterId,itemId:birdItem.id,quantity:1})});if(!buyBird.ok)throw new Error(`Could not buy messenger bird: ${await buyBird.text()}`);const sendBird=async content=>{const response=await fetch(`${appUrl}/api/party/messenger`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:host.cookie()},body:JSON.stringify({tableId:created.tableId,characterId:bestiaryCharacterId,recipientUserId:users[1],content})});return{response,body:await response.json()};};await admin.from("character_world_positions").update({location_id:greenhollowLocation.id}).eq("character_id",guestCharacterId);const nearBird=await sendBird("This should not need a bird.");if(nearBird.response.status!==409||nearBird.body.error!=="far_city_required")throw new Error("Messenger bird was consumed for a nearby party member.");await admin.from("character_world_positions").update({location_id:continentLocation.id}).eq("character_id",guestCharacterId);const birdMessage="จงรอที่ประตูเหนือ ข้ากำลังเดินทางไป";const farBird=await sendBird(birdMessage);if(farBird.response.status!==201||farBird.body.birdsRemaining!==0||farBird.body.dispatch?.content!==birdMessage)throw new Error(`Messenger bird dispatch failed: ${JSON.stringify(farBird.body)}`);const duplicateBird=await sendBird("No second bird remains.");if(duplicateBird.response.status!==409||duplicateBird.body.error!=="messenger_bird_required")throw new Error("Messenger bird inventory was not consumed exactly once.");const{data:receivedBirds,error:receivedBirdsError}=await guest.client.from("messenger_dispatches").select("content").eq("table_id",created.tableId);if(receivedBirdsError||receivedBirds.length!==1||receivedBirds[0].content!==birdMessage)throw receivedBirdsError??new Error("Messenger recipient could not read the dispatch.");const messengerPage=await fetch(`${appUrl}/dice?table=${created.tableId}`,{headers:{Cookie:host.cookie()}});const messengerHtml=await messengerPage.text();if(!messengerPage.ok||!messengerHtml.includes("ส่งข่าวข้ามเมือง")||!messengerHtml.includes(birdMessage)||!messengerHtml.includes("ซื้อนกสารที่ร้านค้า"))throw new Error("Messenger bird controls or history did not render.");
  const spectatorBird=await fetch(`${appUrl}/api/party/messenger`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:guest.cookie()},body:JSON.stringify({tableId:created.tableId,characterId:guestCharacterId,recipientUserId:users[0],content:"Spectator cannot dispatch."})});if(spectatorBird.status!==403||!(await spectatorBird.text()).includes("player_required"))throw new Error("Spectator was allowed to dispatch a messenger bird.");
  const spectatorChat=await fetch(`${appUrl}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:guest.cookie()},body:JSON.stringify({tableId:created.tableId,content:"Spectators must remain silent."})});if(spectatorChat.status!==403||!(await spectatorChat.text()).includes("spectator_read_only"))throw new Error("Spectator was allowed to send room chat.");
  const spectatorRoll=await fetch(`${appUrl}/api/dice/roll`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:guest.cookie()},body:JSON.stringify({tableId:created.tableId,diceCount:1,diceSides:20,modifier:0})});if(spectatorRoll.status!==403||!(await spectatorRoll.text()).includes("spectator_read_only"))throw new Error("Spectator was allowed to roll dice.");
  const spectatorInitiative=await fetch(`${appUrl}/api/initiative`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:guest.cookie()},body:JSON.stringify({action:"add",tableId:created.tableId,name:"Ghost",initiative:20})});if(spectatorInitiative.status!==403||!(await spectatorInitiative.text()).includes("spectator_read_only"))throw new Error("Spectator was allowed to alter initiative.");
  const companionCommand=async(command,tableId=null,cookie=host.cookie())=>{const response=await fetch(`${appUrl}/api/companions/command`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({characterId:bestiaryCharacterId,command,tableId})});return{response,body:await response.json()};};
  const freeformCompanion=await companionCommand("เดินไปเปิดหีบ");if(freeformCompanion.response.status!==400||freeformCompanion.body.error!=="invalid_command")throw new Error("Homunculus accepted a free-form or autonomous command.");
  const prematureCompanion=await companionCommand("guard");if(prematureCompanion.response.status!==409||prematureCompanion.body.error!=="not_summoned")throw new Error("Homunculus acted before being summoned.");
  const summonedCompanion=await companionCommand("summon",created.tableId);if(summonedCompanion.response.status!==201||summonedCompanion.body.protocol!=="command-only"||summonedCompanion.body.companion?.active_table_id!==created.tableId||!summonedCompanion.body.systemDirective?.includes("never a Dungeon Master"))throw new Error(`Homunculus summon or separate command protocol failed: ${JSON.stringify(summonedCompanion.body)}`);
  const guardedCompanion=await companionCommand("guard");if(guardedCompanion.response.status!==201||guardedCompanion.body.companion?.stance!=="guarding"||!guardedCompanion.body.command?.response_th.includes("DM"))throw new Error("Homunculus guard command invented an outcome or failed.");
  const stolenCompanion=await companionCommand("scout",null,guest.cookie());if(stolenCompanion.response.status!==404)throw new Error("Another room member commanded someone else's homunculus.");
  const {data:guestCompanions,error:guestCompanionsError}=await guest.client.from("homunculus_companions").select("id,name,stance").eq("active_table_id",created.tableId);if(guestCompanionsError||guestCompanions.length!==1||guestCompanions[0].stance!=="guarding")throw guestCompanionsError??new Error("Room member could not see the summoned homunculus state.");
  const {data:guestCompanionCommands,error:guestCompanionCommandsError}=await guest.client.from("homunculus_commands").select("command").eq("table_id",created.tableId);if(guestCompanionCommandsError||guestCompanionCommands.length!==2)throw guestCompanionCommandsError??new Error("Room member could not see command-only companion history.");
  const companionPage=await fetch(`${appUrl}/companions?character=${bestiaryCharacterId}`,{headers:{Cookie:host.cookie()}});const companionHtml=await companionPage.text();if(!companionPage.ok||!companionHtml.includes("วงแหวนคำสั่ง")||!companionHtml.includes("COMMAND-ONLY")||!companionHtml.includes(created.code))throw new Error("Homunculus command console did not render.");
  const roomWithCompanion=await fetch(`${appUrl}/dice?table=${created.tableId}`,{headers:{Cookie:guest.cookie()}});const roomWithCompanionHtml=await roomWithCompanion.text();if(!roomWithCompanion.ok||!roomWithCompanionHtml.includes("โฮมุนครุสในห้อง")||!roomWithCompanionHtml.includes(summonedCompanion.body.companion.name))throw new Error("Summoned homunculus did not render for another room member.");

  let chatResolve;
  const chatEvent = new Promise((resolve) => { chatResolve = resolve; });
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
  // The first authenticated channel on a fresh Realtime socket can report
  // SUBSCRIBED just before its database-change binding is fully settled.
  await new Promise((resolve) => setTimeout(resolve, 500));
  const sentChats=[];let receivedChat=null;
  for(let attempt=1;attempt<=2&&!receivedChat;attempt++){
    const content=attempt===1?"Gather at the old gate.":"Realtime channel readiness check.";
    const chatResponse = await fetch(`${appUrl}/api/chat`, {method:"POST",headers:{"Content-Type":"application/json",Cookie:host.cookie()},body:JSON.stringify({tableId:created.tableId,content})});
    const chatBody=await chatResponse.json();if(chatResponse.status!==201||chatBody.message?.sender_role!=="dm")throw new Error(`Chat send failed: ${chatResponse.status} ${JSON.stringify(chatBody)}`);sentChats.push(chatBody.message);
    receivedChat=await Promise.race([chatEvent,new Promise(resolve=>setTimeout(()=>resolve(null),attempt===1?5000:10000))]);
  }
  if(!receivedChat||!sentChats.some(message=>message.id===receivedChat.id&&message.content===receivedChat.content))throw new Error("Guest did not receive a matching room chat event after readiness retry.");
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
  const guestEntry = await initiativeAction(host, "add", { name: "Goblin", initiative: 12 });
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
  const secondTurn = await initiativeAction(host, "next");
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
  const {data:publicCompanions,error:publicCompanionsError}=await outsider.from("homunculus_companions").select("id").eq("active_table_id",created.tableId);if(publicCompanionsError||publicCompanions.length!==0)throw publicCompanionsError??new Error("RLS exposed summoned homunculi publicly.");

  const contentResponse = await fetch(`${appUrl}/api/content/summary`, { headers: { Cookie: host.cookie() } });
  const contentSummary = await contentResponse.json();
  if (!contentResponse.ok || contentSummary.items?.common < 40 || contentSummary.items?.uncommon < 25 || contentSummary.dialogue !== 32 || contentSummary.quests !== 30 || contentSummary.events !== 15) throw new Error(`Static content pool counts are below their required baseline: ${JSON.stringify(contentSummary)}`);
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

  let monsterResolve;
  let monsterReject;
  const monsterEvent=new Promise((resolve,reject)=>{monsterResolve=resolve;monsterReject=reject;});
  const monsterChannel=guest.client.channel(`monster-e2e-${suffix}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"generated_monsters",filter:`table_id=eq.${created.tableId}`},payload=>monsterResolve(payload.new));
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("Monster subscription timed out.")),10000);monsterChannel.subscribe(status=>{if(status==="SUBSCRIBED"){clearTimeout(timer);resolve();}if(status==="CHANNEL_ERROR"){clearTimeout(timer);reject(new Error("Monster channel error."));}});});
  const monsterTimer=setTimeout(()=>monsterReject(new Error("Guest did not receive generated monster.")),10000);
  const monsterResponse=await fetch(`${appUrl}/api/monsters/generate`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:host.cookie()},body:JSON.stringify({tableId:created.tableId,challenge:"boss",biome:"ruins"})});const monsterBody=await monsterResponse.json();
  if(monsterResponse.status!==201||monsterBody.monster?.challenge_tier!=="boss"||monsterBody.monster?.biome!=="ruins"||monsterBody.monster.hp_max<95||!monsterBody.monster.traits?.signature)throw new Error(`Monster generation failed: ${JSON.stringify(monsterBody)}`);
  const receivedMonster=await monsterEvent;clearTimeout(monsterTimer);if(receivedMonster.id!==monsterBody.monster.id)throw new Error("Realtime generated monster did not match.");
  if("weakness" in monsterBody.monster||"weakness" in receivedMonster)throw new Error("Generated monster payload exposed its hidden weakness.");
  if(monsterBody.monster.hp_current!==monsterBody.monster.hp_max)throw new Error("Generated monster did not begin combat at full HP.");
  let combatResolve;let combatReject;const combatEvent=new Promise((resolve,reject)=>{combatResolve=resolve;combatReject=reject;});
  const combatChannel=guest.client.channel(`combat-e2e-${suffix}`).on("postgres_changes",{event:"UPDATE",schema:"public",table:"timed_combat_actions",filter:`table_id=eq.${created.tableId}`},payload=>combatResolve(payload.new));
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("Combat subscription timed out.")),10000);combatChannel.subscribe(status=>{if(status==="SUBSCRIBED"){clearTimeout(timer);resolve();}if(status==="CHANNEL_ERROR"){clearTimeout(timer);reject(new Error("Combat channel error."));}});});await new Promise(resolve=>setTimeout(resolve,500));
  const combatRequest=async(payload,cookie=host.cookie())=>{const response=await fetch(`${appUrl}/api/combat/timing`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify(payload)});return{response,body:await response.json()};};
  const{data:startedAttackData,error:startedAttackError}=await host.client.rpc("start_timed_attack_synced",{target_monster_id:monsterBody.monster.id,target_character_id:bestiaryCharacterId});if(startedAttackError||startedAttackData?.action?.status!=="pending"||startedAttackData?.action?.base_damage<1)throw startedAttackError??new Error(`Timing attack did not start: ${JSON.stringify(startedAttackData)}`);const startedAttack={body:{combatAction:startedAttackData.action,serverNow:startedAttackData.server_now}};
  const duplicateStart=await combatRequest({action:"start",monsterId:monsterBody.monster.id,characterId:bestiaryCharacterId});if(duplicateStart.response.status!==409||duplicateStart.body.error!=="attack_pending")throw new Error("A player opened two timing attacks concurrently.");
  const spectatorAttack=await combatRequest({action:"start",monsterId:monsterBody.monster.id,characterId:guestCharacterId},guest.cookie());if(spectatorAttack.response.status!==403||spectatorAttack.body.error!=="player_required")throw new Error("Spectator was allowed to start timing combat.");
  const waitForTarget=Math.max(0,new Date(startedAttack.body.combatAction.target_at).getTime()-new Date(startedAttack.body.serverNow).getTime());if(!Number.isFinite(waitForTarget)||waitForTarget<500||waitForTarget>4000)throw new Error(`Invalid synchronized combat clock: ${JSON.stringify(startedAttack.body)}`);await new Promise(resolve=>setTimeout(resolve,waitForTarget));
  const combatTimer=setTimeout(()=>combatReject(new Error("Spectator did not receive resolved combat in realtime.")),10000);const{data:resolvedAttackBody,error:resolvedAttackError}=await host.client.rpc("resolve_timed_attack_synced",{target_action_id:startedAttack.body.combatAction.id,client_pressed_at:startedAttack.body.combatAction.target_at});if(resolvedAttackError||resolvedAttackBody?.action?.status!=="resolved"||resolvedAttackBody?.action?.grade!=="perfect"||resolvedAttackBody?.action?.applied_damage<1)throw resolvedAttackError??new Error(`Timing attack resolution failed: ${JSON.stringify(resolvedAttackBody)}`);const resolvedAttack={body:resolvedAttackBody};const receivedCombat=await combatEvent;clearTimeout(combatTimer);if(receivedCombat.id!==resolvedAttack.body.action.id||receivedCombat.status!=="resolved")throw new Error("Realtime timing combat result did not match.");
  const expectedHp=monsterBody.monster.hp_max-resolvedAttack.body.action.applied_damage;if(resolvedAttack.body.monster?.hp_current!==expectedHp||resolvedAttack.body.action.monster_hp_after!==expectedHp)throw new Error("Monster HP and combat ledger diverged.");
  const replayAttack=await combatRequest({action:"resolve",actionId:startedAttack.body.combatAction.id});if(replayAttack.response.status!==409||replayAttack.body.error!=="already_resolved")throw new Error("Resolved timing damage could be applied twice.");
  const{data:guestCombat,error:guestCombatError}=await guest.client.from("timed_combat_actions").select("id,grade,applied_damage").eq("id",startedAttack.body.combatAction.id).single();if(guestCombatError||guestCombat.grade!==resolvedAttack.body.action.grade||guestCombat.applied_damage!==resolvedAttack.body.action.applied_damage)throw guestCombatError??new Error("Room member could not read shared combat results.");
  const{error:directCombatError}=await host.client.from("timed_combat_actions").insert({table_id:created.tableId,monster_id:monsterBody.monster.id,actor_user_id:users[0],character_id:bestiaryCharacterId,actor_name:"Forged",character_name:"Forged",damage_type:"fire",base_damage:999,opens_at:new Date().toISOString(),target_at:new Date(Date.now()+1000).toISOString(),closes_at:new Date(Date.now()+2000).toISOString()});if(!directCombatError)throw new Error("Player bypassed server-authoritative combat with a direct insert.");
  const{data:persistedMonster,error:persistedMonsterError}=await host.client.from("generated_monsters").select("hp_current,hp_max").eq("id",monsterBody.monster.id).single();if(persistedMonsterError||persistedMonster.hp_current!==expectedHp||persistedMonster.hp_max!==monsterBody.monster.hp_max)throw persistedMonsterError??new Error("Resolved monster HP was not persisted.");const combatPage=await fetch(`${appUrl}/dice?table=${created.tableId}`,{headers:{Cookie:host.cookie()}});const combatHtml=await combatPage.text();if(!combatPage.ok||!combatHtml.includes("TIMING STRIKE")||!combatHtml.includes("เริ่มจับจังหวะ"))throw new Error("Timing combat controls did not render.");
  const environmentRequest=async(payload,cookie=host.cookie())=>{const response=await fetch(`${appUrl}/api/combat/environment`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify(payload)});return{response,body:await response.json()};};const spawnedObject=await environmentRequest({action:"spawn",tableId:created.tableId,objectType:"explosive_barrel"});if(spawnedObject.response.status!==201||spawnedObject.body.object?.status!=="active"||spawnedObject.body.object?.base_damage!==18)throw new Error(`DM could not place a combat environment object: ${JSON.stringify(spawnedObject.body)}`);
  let environmentResolve;let environmentReject;const environmentEvent=new Promise((resolve,reject)=>{environmentResolve=resolve;environmentReject=reject;});const environmentChannel=guest.client.channel(`environment-e2e-${suffix}`).on("postgres_changes",{event:"UPDATE",schema:"public",table:"combat_environment_objects",filter:`table_id=eq.${created.tableId}`},payload=>environmentResolve(payload.new));await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("Environment subscription timed out.")),10000);environmentChannel.subscribe(status=>{if(status==="SUBSCRIBED"){clearTimeout(timer);resolve();}if(status==="CHANNEL_ERROR"){clearTimeout(timer);reject(new Error("Environment channel error."));}});});await new Promise(resolve=>setTimeout(resolve,500));
  const spectatorEnvironment=await environmentRequest({action:"trigger",objectId:spawnedObject.body.object.id,monsterId:monsterBody.monster.id,characterId:guestCharacterId},guest.cookie());if(spectatorEnvironment.response.status!==403||spectatorEnvironment.body.error!=="player_required")throw new Error("Spectator triggered a combat environment object.");const environmentTimer=setTimeout(()=>environmentReject(new Error("Spectator did not receive environment interaction in realtime.")),10000);const triggeredObject=await environmentRequest({action:"trigger",objectId:spawnedObject.body.object.id,monsterId:monsterBody.monster.id,characterId:bestiaryCharacterId});if(!triggeredObject.response.ok||triggeredObject.body.object?.status!=="spent"||triggeredObject.body.object?.applied_damage<18||triggeredObject.body.monster?.hp_current!==expectedHp-triggeredObject.body.object.applied_damage)throw new Error(`Environmental damage was inconsistent: ${JSON.stringify(triggeredObject.body)}`);const receivedEnvironment=await environmentEvent;clearTimeout(environmentTimer);if(receivedEnvironment.id!==spawnedObject.body.object.id||receivedEnvironment.status!=="spent")throw new Error("Realtime environment result did not match.");const repeatedObject=await environmentRequest({action:"trigger",objectId:spawnedObject.body.object.id,monsterId:monsterBody.monster.id,characterId:bestiaryCharacterId});if(repeatedObject.response.status!==409||repeatedObject.body.error!=="object_spent")throw new Error("A spent environment object dealt damage twice.");
  const{data:persistedEnvironment,error:persistedEnvironmentError}=await host.client.from("combat_environment_objects").select("status,effect_th,applied_damage").eq("id",spawnedObject.body.object.id).single();if(persistedEnvironmentError||persistedEnvironment.status!=="spent"||!persistedEnvironment.effect_th||persistedEnvironment.applied_damage!==triggeredObject.body.object.applied_damage)throw persistedEnvironmentError??new Error("Environmental combat ledger was not persisted.");const environmentPage=await fetch(`${appUrl}/dice?table=${created.tableId}`,{headers:{Cookie:host.cookie()}});const environmentHtml=await environmentPage.text();if(!environmentPage.ok||!environmentHtml.includes("วางวัตถุในฉาก")||!environmentHtml.includes("ถังดินเพลิง"))throw new Error("Environmental combat controls did not render.");
  const {data:hiddenWeaknessForHost,error:hiddenWeaknessForHostError}=await host.client.from("generated_monster_weaknesses").select("template_id").eq("monster_id",monsterBody.monster.id);if(hiddenWeaknessForHostError||hiddenWeaknessForHost.length!==0)throw hiddenWeaknessForHostError??new Error("Room DM could directly read hidden weakness storage.");
  const {data:secretWeakness,error:secretWeaknessError}=await admin.from("generated_monster_weaknesses").select("template_id,monster_weakness_templates(damage_type,multiplier)").eq("monster_id",monsterBody.monster.id).single();if(secretWeaknessError||!secretWeakness?.monster_weakness_templates)throw secretWeaknessError??new Error("Server did not assign a hidden monster weakness.");
  const weakness=secretWeakness.monster_weakness_templates;const weaknessHit=await fetch(`${appUrl}/api/monsters/damage`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:host.cookie()},body:JSON.stringify({monsterId:monsterBody.monster.id,damageType:weakness.damage_type,baseDamage:20})});const weaknessHitBody=await weaknessHit.json();if(!weaknessHit.ok||weaknessHitBody.result?.effective!==true||weaknessHitBody.result?.applied_damage!==Math.floor(20*Number(weakness.multiplier)))throw new Error(`Hidden weakness multiplier was not applied: ${JSON.stringify(weaknessHitBody)}`);
  const normalType=["fire","cold","lightning","radiant","bludgeoning","piercing","slashing","poison","psychic"].find(type=>type!==weakness.damage_type);const normalHit=await fetch(`${appUrl}/api/monsters/damage`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:host.cookie()},body:JSON.stringify({monsterId:monsterBody.monster.id,damageType:normalType,baseDamage:20})});const normalHitBody=await normalHit.json();if(!normalHit.ok||normalHitBody.result?.effective!==false||normalHitBody.result?.applied_damage!==20)throw new Error("Normal damage incorrectly triggered a weakness.");
  const spectatorDamage=await fetch(`${appUrl}/api/monsters/damage`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:guest.cookie()},body:JSON.stringify({monsterId:monsterBody.monster.id,damageType:weakness.damage_type,baseDamage:20})});if(spectatorDamage.status!==403)throw new Error("Spectator was allowed to probe hidden monster weaknesses.");
  const dmMonsterPage=await fetch(`${appUrl}/dice?table=${created.tableId}`,{headers:{Cookie:host.cookie()}});if(!dmMonsterPage.ok||!(await dmMonsterPage.text()).includes("จุดอ่อนถูกซ่อน"))throw new Error("DM weakness damage tester did not render.");
  const recordObservation=async(monsterId,notes,guessedWeakness=null,cookie=host.cookie())=>{const response=await fetch(`${appUrl}/api/bestiary`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({characterId:bestiaryCharacterId,monsterId,notes,guessedWeakness})});return{response,body:await response.json()};};
  const firstObservation=await recordObservation(monsterBody.monster.id,"รูนบนเกราะสั่นเมื่อถูกกระแทก",normalType);if(firstObservation.response.status!==201||firstObservation.body.entry?.encounter_count!==1||firstObservation.body.entry?.new_sighting!==true||firstObservation.body.entry?.discovered_weakness!==null)throw new Error(`First bestiary observation failed: ${JSON.stringify(firstObservation.body)}`);
  const duplicateObservation=await recordObservation(monsterBody.monster.id,"ทดสอบกับตัวเดิมอีกครั้ง",weakness.damage_type);if(!duplicateObservation.response.ok||duplicateObservation.body.entry?.encounter_count!==1||duplicateObservation.body.entry?.new_sighting!==false||duplicateObservation.body.entry?.discovered_weakness!==null)throw new Error("Repeated notes on the same monster counted as another encounter.");
  const {data:secondMonster,error:secondMonsterError}=await admin.from("generated_monsters").insert({table_id:created.tableId,created_by:users[0],name_th:monsterBody.monster.name_th,challenge_tier:monsterBody.monster.challenge_tier,biome:monsterBody.monster.biome,hp_max:monsterBody.monster.hp_max,armor_class:monsterBody.monster.armor_class,attack_bonus:monsterBody.monster.attack_bonus,damage_dice:monsterBody.monster.damage_dice,traits:monsterBody.monster.traits}).select("id").single();if(secondMonsterError)throw secondMonsterError;
  const {data:secondSecret,error:secondSecretError}=await admin.from("generated_monster_weaknesses").select("monster_weakness_templates(damage_type)").eq("monster_id",secondMonster.id).single();if(secondSecretError)throw secondSecretError;const confirmedType=secondSecret.monster_weakness_templates.damage_type;if(confirmedType!==weakness.damage_type)throw new Error("Same monster species received inconsistent hidden weaknesses.");
  const confirmedObservation=await recordObservation(secondMonster.id,"พบร่องรอยเดียวกันในอสูรตัวที่สอง",confirmedType);if(!confirmedObservation.response.ok||confirmedObservation.body.entry?.encounter_count!==2||confirmedObservation.body.entry?.discovered_weakness!==confirmedType)throw new Error(`Repeated encounter did not confirm a correct weakness guess: ${JSON.stringify(confirmedObservation.body)}`);
  const entryId=confirmedObservation.body.entry.id;
  const shareKnowledge=async(payload)=>{const response=await fetch(`${appUrl}/api/bestiary/share`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:host.cookie()},body:JSON.stringify({characterId:bestiaryCharacterId,entryId,...payload})});return{response,body:await response.json()};};
  const partyShare=await shareKnowledge({action:"share",mode:"party",tableId:created.tableId});if(partyShare.response.status!==201||partyShare.body.result?.share_mode!=="party")throw new Error(`Party bestiary share failed: ${JSON.stringify(partyShare.body)}`);
  const duplicatePartyShare=await shareKnowledge({action:"share",mode:"party",tableId:created.tableId});if(duplicatePartyShare.response.status!==409||duplicatePartyShare.body.error!=="already_shared")throw new Error("Duplicate party bestiary share was not rejected.");
  const directShare=await shareKnowledge({action:"share",mode:"direct",recipientUserId:users[1]});if(directShare.response.status!==201||directShare.body.result?.share_mode!=="direct")throw new Error(`Direct bestiary share failed: ${JSON.stringify(directShare.body)}`);
  const {data:guestShares,error:guestSharesError}=await guest.client.from("bestiary_shares").select("share_mode,monster_name").eq("entry_id",entryId);if(guestSharesError||guestShares.length!==2||!guestShares.some(item=>item.share_mode==="party")||!guestShares.some(item=>item.share_mode==="direct"))throw guestSharesError??new Error("Recipient could not read both shared bestiary snapshots.");
  const {data:publicShares,error:publicSharesError}=await outsider.from("bestiary_shares").select("id").eq("entry_id",entryId);if(publicSharesError||publicShares.length!==0)throw publicSharesError??new Error("RLS exposed shared bestiary snapshots to outsiders.");
  const sharedPage=await fetch(`${appUrl}/bestiary?character=${guestCharacterId}`,{headers:{Cookie:guest.cookie()}});const sharedHtml=await sharedPage.text();if(!sharedPage.ok||!sharedHtml.includes(monsterBody.monster.name_th)||!sharedHtml.includes("PARTY SHARE")||!sharedHtml.includes("DIRECT SHARE"))throw new Error("Shared bestiary feed did not render for its recipient.");
  const {data:guildRows,error:guildRowsError}=await admin.from("guilds").select("id,name_th").order("id").limit(2);if(guildRowsError||guildRows.length<2)throw guildRowsError??new Error("Test guilds are unavailable.");
  const {data:walletBefore,error:walletBeforeError}=await host.client.from("character_wallets").select("balance_copper").eq("character_id",bestiaryCharacterId).single();if(walletBeforeError)throw walletBeforeError;
  const soldKnowledge=await shareKnowledge({action:"guild",mode:"sell",guildId:guildRows[0].id});if(soldKnowledge.response.status!==201||soldKnowledge.body.result?.payout_copper!==100||soldKnowledge.body.result?.affinity_delta!==2)throw new Error(`Guild knowledge sale failed: ${JSON.stringify(soldKnowledge.body)}`);
  const duplicateGuild=await shareKnowledge({action:"guild",mode:"donate",guildId:guildRows[0].id});if(duplicateGuild.response.status!==409||duplicateGuild.body.error!=="already_shared")throw new Error("Duplicate contribution to the same guild was not rejected.");
  const donatedKnowledge=await shareKnowledge({action:"guild",mode:"donate",guildId:guildRows[1].id});if(donatedKnowledge.response.status!==201||donatedKnowledge.body.result?.payout_copper!==0||donatedKnowledge.body.result?.affinity_delta!==8)throw new Error(`Guild knowledge donation failed: ${JSON.stringify(donatedKnowledge.body)}`);
  const {data:walletAfter,error:walletAfterError}=await host.client.from("character_wallets").select("balance_copper").eq("character_id",bestiaryCharacterId).single();if(walletAfterError||Number(walletAfter.balance_copper)!==Number(walletBefore.balance_copper)+100)throw walletAfterError??new Error("Knowledge sale did not credit the wallet exactly once.");
  const {data:affinityRows,error:affinityRowsError}=await admin.from("character_guild_affinity").select("guild_id,score").eq("character_id",bestiaryCharacterId).in("guild_id",guildRows.map(item=>item.id));if(affinityRowsError||affinityRows.find(item=>item.guild_id===guildRows[0].id)?.score!==2||affinityRows.find(item=>item.guild_id===guildRows[1].id)?.score!==8)throw affinityRowsError??new Error("Guild contribution affinity deltas were incorrect.");
  const {data:hiddenAffinity,error:hiddenAffinityError}=await host.client.from("character_guild_affinity").select("score").eq("character_id",bestiaryCharacterId);if(hiddenAffinityError||hiddenAffinity.length!==0)throw hiddenAffinityError??new Error("Hidden guild affinity score was exposed to its player.");
  const crossCharacterObservation=await recordObservation(secondMonster.id,"ขโมยบันทึก",confirmedType,guest.cookie());if(crossCharacterObservation.response.status!==404)throw new Error("Another player wrote into a character's bestiary.");
  const bestiaryPage=await fetch(`${appUrl}/bestiary?character=${bestiaryCharacterId}`,{headers:{Cookie:host.cookie()}});const bestiaryHtml=await bestiaryPage.text();if(!bestiaryPage.ok||!bestiaryHtml.includes("สมุดบันทึกอสูร")||!bestiaryHtml.includes(monsterBody.monster.name_th)||!bestiaryHtml.includes("ยืนยันแล้ว")||!bestiaryHtml.includes("พบร่องรอยเดียวกัน"))throw new Error("Bestiary page did not render the persisted discovery.");
  const {data:publicBestiary,error:publicBestiaryError}=await outsider.from("character_bestiary_entries").select("id").eq("character_id",bestiaryCharacterId);if(publicBestiaryError||publicBestiary.length!==0)throw publicBestiaryError??new Error("RLS exposed character bestiary records.");
  const spectatorMonster=await fetch(`${appUrl}/api/monsters/generate`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:guest.cookie()},body:JSON.stringify({tableId:created.tableId,challenge:"minion",biome:"forest"})});if(spectatorMonster.status!==403)throw new Error("Spectator was allowed to generate monsters.");
  const {data:publicMonsters,error:publicMonstersError}=await outsider.from("generated_monsters").select("id").eq("table_id",created.tableId);if(publicMonstersError||publicMonsters.length!==0)throw publicMonstersError??new Error("RLS exposed generated monsters.");
  const{data:publicCombat,error:publicCombatError}=await outsider.from("timed_combat_actions").select("id").eq("table_id",created.tableId);if(publicCombatError||publicCombat.length!==0)throw publicCombatError??new Error("RLS exposed timing combat history.");
  const{data:publicEnvironment,error:publicEnvironmentError}=await outsider.from("combat_environment_objects").select("id").eq("table_id",created.tableId);if(publicEnvironmentError||publicEnvironment.length!==0)throw publicEnvironmentError??new Error("RLS exposed combat environment objects.");

  const promptResponse = await fetch(`${appUrl}/api/dm/manual?tableId=${created.tableId}`, { headers: { Cookie: host.cookie() } });
  const promptBody = await promptResponse.json();
  if (!promptResponse.ok || !promptBody.prompt?.includes("Gather at the old gate.") || !promptBody.prompt.includes("Elder Elrin") || !promptBody.prompt.includes("ถึงตา Aria")) throw new Error(`Manual DM context was incomplete: ${promptResponse.status} ${JSON.stringify(promptBody)}`);

  let dmResolve;
  let dmReject;
  const dmEvent = new Promise((resolve, reject) => { dmResolve = resolve; dmReject = reject; });
  const dmChannel = guest.client.channel(`dm-e2e-${suffix}`).on("postgres_changes", {
    event: "INSERT", schema: "public", table: "dm_narrations", filter: `table_id=eq.${created.tableId}`,
  }, (payload) => dmResolve(payload.new));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Manual DM subscription timed out.")), 10000);
    dmChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") { clearTimeout(timer); resolve(); }
      if (status === "CHANNEL_ERROR") { clearTimeout(timer); reject(new Error("Manual DM channel error.")); }
    });
  });
  const dmTimer = setTimeout(() => dmReject(new Error("Guest did not receive DM narration.")), 10000);
  const narration = "ประตูศิลาเปิดออกใต้แสงจันทร์สีม่วง ทางเลือกทั้งสามรออยู่เบื้องหน้า";
  const dmResponse = await fetch(`${appUrl}/api/dm/manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: host.cookie() },
    body: JSON.stringify({ tableId: created.tableId, narration }),
  });
  const dmBody = await dmResponse.json();
  if (dmResponse.status !== 201 || dmBody.narration?.narration !== narration) throw new Error(`Manual DM publish failed: ${dmResponse.status} ${JSON.stringify(dmBody)}`);
  const receivedDm = await dmEvent;
  clearTimeout(dmTimer);
  if (receivedDm.id !== dmBody.narration.id || receivedDm.narration !== narration) throw new Error("Realtime DM narration did not match.");
  const spectatorDmResponse = await fetch(`${appUrl}/api/dm/manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: guest.cookie() },
    body: JSON.stringify({ tableId: created.tableId, narration: "Spectator must not publish." }),
  });
  if (spectatorDmResponse.status !== 403) throw new Error("Spectator was allowed to publish DM narration.");
  const spectatorPromptResponse = await fetch(`${appUrl}/api/dm/manual?tableId=${created.tableId}`, { headers: { Cookie: guest.cookie() } });
  if (spectatorPromptResponse.status !== 403) throw new Error("Spectator was allowed to generate DM context.");
  const { data: publicNarrations, error: publicNarrationsError } = await outsider.from("dm_narrations").select("id").eq("table_id", created.tableId);
  if (publicNarrationsError || publicNarrations.length !== 0) throw publicNarrationsError ?? new Error("RLS exposed DM narrations.");
  const{data:publicDispatches,error:publicDispatchesError}=await outsider.from("messenger_dispatches").select("id").eq("table_id",created.tableId);if(publicDispatchesError||publicDispatches.length!==0)throw publicDispatchesError??new Error("RLS exposed messenger dispatches.");

  await guest.client.removeChannel(channel);
  await guest.client.removeChannel(initiativeChannel);
  await guest.client.removeChannel(chatChannel);
  await guest.client.removeChannel(npcChannel);
  await guest.client.removeChannel(dmChannel);
  await guest.client.removeChannel(monsterChannel);
  await guest.client.removeChannel(combatChannel);
  await guest.client.removeChannel(environmentChannel);
  const {error:removeGuestError}=await admin.from("dice_table_members").delete().eq("table_id",created.tableId).eq("user_id",users[1]);if(removeGuestError)throw removeGuestError;const{error:guestPositionError}=await guest.client.rpc("ensure_character_world_position",{target_character_id:guestCharacterId});if(guestPositionError)throw guestPositionError;const{data:wilderness,error:wildernessError}=await admin.from("world_locations").select("id").eq("location_type","wilderness").limit(1).single();if(wildernessError)throw wildernessError;const{data:ghostPosition,error:ghostMoveError}=await admin.from("character_world_positions").update({location_id:wilderness.id}).eq("character_id",guestCharacterId).select("location_id").single();if(ghostMoveError||ghostPosition.location_id!==wilderness.id)throw ghostMoveError??new Error("Ghost test could not enter wilderness.");
  const ghostSolo=await fetch(`${appUrl}/api/solo`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:guest.cookie()},body:JSON.stringify({characterId:guestCharacterId,action:"start"})});if(ghostSolo.status!==201)throw new Error(`Ghost test could not start Solo: ${await ghostSolo.text()}`);const ghostDefeat=await fetch(`${appUrl}/api/solo/life`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:guest.cookie()},body:JSON.stringify({characterId:guestCharacterId,action:"defeat",cause:"E2E ghost transition"})});if(ghostDefeat.status!==201)throw new Error(`Ghost test could not record defeat: ${await ghostDefeat.text()}`);
  const ghostGateway=await fetch(`${appUrl}/dice`,{headers:{Cookie:guest.cookie()}});const ghostGatewayHtml=await ghostGateway.text();if(!ghostGateway.ok||!ghostGatewayHtml.includes("GHOST · SPECTATOR ONLY")||ghostGatewayHtml.includes("สร้างห้องใหม่ · เป็น DM"))throw new Error("Dead character did not receive the ghost-only room gateway.");const ghostPlayerJoin=await fetch(`${appUrl}/api/dice/tables`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:guest.cookie()},body:JSON.stringify({action:"join",code:created.code,role:"player"})});if(ghostPlayerJoin.status!==409||!(await ghostPlayerJoin.text()).includes("ghost_spectator_only"))throw new Error("Ghost joined a room as an active player.");const ghostJoin=await fetch(`${appUrl}/api/dice/tables`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:guest.cookie()},body:JSON.stringify({action:"join",code:created.code,role:"spectator"})});const ghostJoinBody=await ghostJoin.text();if(!ghostJoin.ok||!ghostJoinBody.includes('"ghost":true')){const{error:directGhostLinkError}=await guest.client.rpc("link_dice_member_character",{target_table_id:created.tableId,target_character_id:guestCharacterId});throw new Error(`Ghost could not join a room as spectator: ${ghostJoin.status} ${ghostJoinBody}; link=${directGhostLinkError?.message??"none"}`);}
  const ghostRoom=await fetch(`${appUrl}/dice?table=${created.tableId}`,{headers:{Cookie:guest.cookie()}});const ghostRoomHtml=await ghostRoom.text();if(!ghostRoom.ok||!ghostRoomHtml.includes("GHOST MODE")||!ghostRoomHtml.includes("READ ONLY")||!ghostRoomHtml.includes(narration))throw new Error("Ghost room did not render the live room as read-only.");const ghostChat=await fetch(`${appUrl}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:guest.cookie()},body:JSON.stringify({tableId:created.tableId,content:"A ghost cannot speak."})});if(ghostChat.status!==403)throw new Error("Ghost sent chat.");const ghostRoll=await fetch(`${appUrl}/api/dice/roll`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:guest.cookie()},body:JSON.stringify({tableId:created.tableId,diceCount:1,diceSides:20,modifier:0})});if(ghostRoll.status!==403)throw new Error("Ghost rolled dice.");const ghostNpc=await fetch(`${appUrl}/api/npc/dialogue`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:guest.cookie()},body:JSON.stringify({tableId:created.tableId,npcName:"Whisper",speakerType:"generic",context:"greeting"})});if(ghostNpc.status!==403)throw new Error("Ghost triggered NPC dialogue.");const{error:ghostDirectRollError}=await guest.client.from("dice_rolls").insert({table_id:created.tableId,user_id:users[1],roller_name:"Ghost",dice_count:1,dice_sides:20,modifier:0,rolls:[20],total:20});if(!ghostDirectRollError)throw new Error("Ghost bypassed read-only mode with a direct database insert.");const{data:ghostVisibleRolls,error:ghostVisibleRollsError}=await guest.client.from("dice_rolls").select("id").eq("table_id",created.tableId);if(ghostVisibleRollsError||ghostVisibleRolls.length<1)throw ghostVisibleRollsError??new Error("Ghost could not observe room rolls.");
  console.log(JSON.stringify({ privateTable: true, inviteJoin: true, roomRoles: true,partyCharacterLink:true,partyAwarenessTiers:true,messengerBird:true,messengerDistanceGuard:true,messengerRls:true,spectatorReadOnly:true,ghostSpectator:true,ghostDatabaseGuard:true, roomChat: true, chatRealtime: true, oversizedChatRejected: true, roomSave: true, dmSaveOnly: true, roomLoadRestore: true, staticContentCounts: true, contentPage: true, npcWeightedDialogue: true, npcRealtime: true, proceduralMonster:true,monsterRealtime:true,spectatorMonsterDenied:true,timingCombat:true,serverTiming:true,combatRealtime:true,combatReplayGuard:true,combatRls:true,environmentCombat:true,environmentRealtime:true,environmentSingleUse:true,environmentRls:true,hiddenWeakness:true,weaknessDamageMultiplier:true,weaknessDmOnly:true,bestiaryNotes:true,uniqueSightings:true,weaknessDiscovery:true,bestiaryOwnership:true,partyBestiaryShare:true,directBestiaryShare:true,sharedBestiaryRls:true,guildKnowledgeSell:true,guildKnowledgeDonate:true,guildAffinityDifference:true,manualDmContext: true, manualDmPublish: true, dmRealtime: true, spectatorDmDenied: true, serverRoll: true, realtimeToGuest: true, invalidDiceRejected: true, initiativeOrder: true, initiativeRealtime: true, roundAdvance: true, memberRead: true, publicDenied: true, total: received.total }));
} finally {
  for (const client of browserClients) client.realtime.disconnect();
  for (const userId of users) await admin.auth.admin.deleteUser(userId);
}
