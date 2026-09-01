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

  await guest.client.removeChannel(channel);
  await guest.client.removeChannel(initiativeChannel);
  await guest.client.removeChannel(chatChannel);
  await guest.client.removeChannel(npcChannel);
  await guest.client.removeChannel(dmChannel);
  await guest.client.removeChannel(monsterChannel);
  console.log(JSON.stringify({ privateTable: true, inviteJoin: true, roomRoles: true, roomChat: true, chatRealtime: true, oversizedChatRejected: true, roomSave: true, dmSaveOnly: true, roomLoadRestore: true, staticContentCounts: true, contentPage: true, npcWeightedDialogue: true, npcRealtime: true, proceduralMonster:true,monsterRealtime:true,spectatorMonsterDenied:true,hiddenWeakness:true,weaknessDamageMultiplier:true,weaknessDmOnly:true,bestiaryNotes:true,uniqueSightings:true,weaknessDiscovery:true,bestiaryOwnership:true,partyBestiaryShare:true,directBestiaryShare:true,sharedBestiaryRls:true,guildKnowledgeSell:true,guildKnowledgeDonate:true,guildAffinityDifference:true,manualDmContext: true, manualDmPublish: true, dmRealtime: true, spectatorDmDenied: true, serverRoll: true, realtimeToGuest: true, invalidDiceRejected: true, initiativeOrder: true, initiativeRealtime: true, roundAdvance: true, memberRead: true, publicDenied: true, total: received.total }));
} finally {
  for (const client of browserClients) client.realtime.disconnect();
  for (const userId of users) await admin.auth.admin.deleteUser(userId);
}
