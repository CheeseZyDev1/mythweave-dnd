import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.TEST_APP_URL ?? "http://127.0.0.1:3210";
if (!url || !publishableKey || !serviceRoleKey) throw new Error("Missing Supabase test environment variables.");

const cookieJar = new Map();
const supabase = createBrowserClient(url, publishableKey, {
  cookies: {
    getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
    setAll: (items) => items.forEach(({ name, value }) => value ? cookieJar.set(name, value) : cookieJar.delete(name)),
  },
});

const suffix = crypto.randomUUID().replaceAll("-", "");
const email = `mythweave-character-${suffix}@example.com`;
const password = `Mythweave-${suffix}-9A`;
let userId;
let characterId;

try {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: "Forge Tester" } } });
  if (error || !data.user || !data.session) throw error ?? new Error("Sign-up did not return a session.");
  userId = data.user.id;

  const cookie = [...cookieJar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; ");
  const createResponse = await fetch(`${appUrl}/api/characters`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      name: "Aria Forge",
      race: "elf",
      characterClass: "ranger",
      stats: { strength: 8, dexterity: 15, constitution: 14, intelligence: 10, wisdom: 13, charisma: 12 },
      appearance: { skinTone: "warm", hairStyle: "braid", hairColor: "silver", face: "sharp", body: "balanced" },
    }),
  });
  const createBody = await createResponse.json();
  if (createResponse.status !== 201 || !createBody.id) throw new Error(`Character API failed: ${createResponse.status} ${JSON.stringify(createBody)}`);
  characterId = createBody.id;

  const invalidResponse = await fetch(`${appUrl}/api/characters`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ name: "Cheater", race: "elf", characterClass: "ranger", stats: { strength: 20 }, appearance: {} }),
  });
  if (invalidResponse.status !== 400) throw new Error("Invalid character payload was not rejected.");

  const { data: character, error: readError } = await supabase.from("characters").select("name,race,character_class,dexterity,hp_max,appearance").eq("id", characterId).single();
  if (readError || character.name !== "Aria Forge" || character.dexterity !== 17) throw readError ?? new Error("Saved character values are incorrect.");
  const [{data:innatePool,error:innatePoolError},{data:innateAssignment,error:innateAssignmentError}]=await Promise.all([supabase.from("innate_abilities").select("id,race_id,name_th,usage_rule_th"),supabase.from("character_innate_abilities").select("ability_id,innate_abilities(race_id,name_th,usage_rule_th)").eq("character_id",characterId).single()]);const assignedInnate=innateAssignment?.innate_abilities;if(innatePoolError||innateAssignmentError||innatePool.length!==24||Object.values(Object.groupBy(innatePool,ability=>ability.race_id)).some(pool=>pool.length!==4)||assignedInnate?.race_id!=="elf")throw innatePoolError??innateAssignmentError??new Error("Innate ability pool or automatic assignment is incorrect.");
  const alternateInnate=innatePool.find(ability=>ability.race_id==="elf"&&ability.id!==innateAssignment.ability_id);const {data:tamperedInnate,error:tamperError}=await supabase.from("character_innate_abilities").update({ability_id:alternateInnate.id}).eq("character_id",characterId).select("ability_id");if(tamperError||tamperedInnate.length!==0)throw tamperError??new Error("Player was able to replace an assigned innate ability.");

  const lobbyResponse = await fetch(`${appUrl}/lobby`, { headers: { Cookie: cookie } });
  const lobbyHtml = await lobbyResponse.text();
  if (!lobbyResponse.ok || !lobbyHtml.includes("Aria Forge")) throw new Error("Character was not rendered in the authenticated lobby.");

  const sheetResponse = await fetch(`${appUrl}/characters/${characterId}`, { headers: { Cookie: cookie } });
  const sheetHtml = await sheetResponse.text();
  if (!sheetResponse.ok || !sheetHtml.includes("Aria Forge") || !sheetHtml.includes("Character Sheet") || !sheetHtml.includes("กระเป๋าเหรียญ") || !sheetHtml.includes("ตำนานเผ่าของฉัน")||!sheetHtml.includes("สมุดบันทึกอสูร")||!sheetHtml.includes("Codex รวมความรู้")||!sheetHtml.includes(assignedInnate.name_th)||!sheetHtml.includes(assignedInnate.usage_rule_th)) throw new Error("Character Sheet, wallet, codex links, or innate gift did not render.");

  const {data:raceLore,error:raceLoreError}=await supabase.from("race_lore").select("race_id,name_th,title_th,starting_location_id,world_locations(slug)").order("race_id");if(raceLoreError||raceLore.length!==6||new Set(raceLore.map(entry=>entry.starting_location_id)).size!==6)throw raceLoreError??new Error("Race lore or starting zones were not seeded.");
  const raceLoreIndex=await fetch(`${appUrl}/lore/races?character=${characterId}`,{headers:{Cookie:cookie}});const raceLoreIndexHtml=await raceLoreIndex.text();if(!raceLoreIndex.ok||!raceLoreIndexHtml.includes("ชนเผ่าแห่งเอเธอร์รา")||raceLore.some(entry=>!raceLoreIndexHtml.includes(entry.name_th)))throw new Error("Race lore index did not render all six races.");
  const humanLore=await fetch(`${appUrl}/lore/races/human?character=${characterId}`,{headers:{Cookie:cookie}});const humanLoreHtml=await humanLore.text();const loreChecks=[humanLore.ok,humanLoreHtml.includes("ผู้ถักทอชะตา"),humanLoreHtml.includes("ต้นกำเนิด"),humanLoreHtml.includes("วิถีและวัฒนธรรม"),humanLoreHtml.includes("นครรุ่งอรุณ"),humanLoreHtml.includes("พรจากสายเลือด"),humanLoreHtml.includes("พละกำลัง")];if(loreChecks.some(check=>!check))throw new Error(`Race chronicle did not render lore, homeland, and racial traits: ${humanLore.status} ${JSON.stringify(loreChecks)}`);
  const elfLore=await fetch(`${appUrl}/lore/races/elf?character=${characterId}`,{headers:{Cookie:cookie}});const elfLoreHtml=await elfLore.text();if(!elfLore.ok||!elfLoreHtml.includes("ONE OF FOUR")||innatePool.filter(ability=>ability.race_id==="elf").some(ability=>!elfLoreHtml.includes(ability.name_th)))throw new Error("Race lore did not render the four innate ability possibilities.");
  const unknownLore=await fetch(`${appUrl}/lore/races/unknown-race`,{headers:{Cookie:cookie}});if(unknownLore.status!==404)throw new Error("Unknown race lore did not return 404.");
  const codexBestiary=await fetch(`${appUrl}/codex?character=${characterId}`,{headers:{Cookie:cookie}});const codexBestiaryHtml=await codexBestiary.text();if(!codexBestiary.ok||!codexBestiaryHtml.includes("มหาคัมภีร์")||!codexBestiaryHtml.includes("BESTIARY")||!codexBestiaryHtml.includes("ยังไม่มีบันทึกอสูร"))throw new Error("Codex bestiary index did not render.");
  const codexItems=await fetch(`${appUrl}/codex?character=${characterId}&section=items`,{headers:{Cookie:cookie}});const codexItemsHtml=await codexItems.text();if(!codexItems.ok||!codexItemsHtml.includes("ITEM ARCHIVE")||!codexItemsHtml.includes("มูลค่าพื้นฐาน"))throw new Error("Codex item archive did not render.");
  const codexLore=await fetch(`${appUrl}/codex?character=${characterId}&section=lore`,{headers:{Cookie:cookie}});const codexLoreHtml=await codexLore.text();if(!codexLore.ok||!codexLoreHtml.includes("RACE LORE")||!codexLoreHtml.includes("ผู้ถักทอชะตา"))throw new Error("Codex lore archive did not render.");
  const codexRates=await fetch(`${appUrl}/codex?character=${characterId}&section=rates`,{headers:{Cookie:cookie}});const codexRatesHtml=await codexRates.text();if(!codexRates.ok||!codexRatesHtml.includes("Relic Forge rarity")||!codexRatesHtml.includes("ไม่ใช่อัตราดรอปจากมอนสเตอร์"))throw new Error("Codex drop rates did not render their source disclaimer.");

  const { data: initialWallet, error: initialWalletError } = await supabase.from("character_wallets").select("balance_copper").eq("character_id", characterId).single();
  if (initialWalletError || initialWallet.balance_copper !== 1000) throw initialWalletError ?? new Error("Starting wallet balance is incorrect.");
  async function walletAdjust(amountCopper, reason) {
    const response = await fetch(`${appUrl}/api/wallet`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ characterId, amountCopper, reason }) });
    return { response, body: await response.json() };
  }
  const income = await walletAdjust(250, "Quest reward");
  const expense = await walletAdjust(-500, "Buy supplies");
  if (!income.response.ok || income.body.transaction?.balance_after !== 1250 || !expense.response.ok || expense.body.transaction?.balance_after !== 750) throw new Error("Wallet income or expense was calculated incorrectly.");
  const overdraft = await walletAdjust(-1000, "Impossible purchase");
  if (overdraft.response.status !== 409) throw new Error("Wallet allowed a negative balance.");
  const { data: ledger, error: ledgerError } = await supabase.from("wallet_transactions").select("delta_copper,balance_after").eq("character_id", characterId).order("created_at");
  if (ledgerError || ledger.length !== 3 || ledger.at(-1).balance_after !== 750) throw ledgerError ?? new Error("Wallet ledger is incomplete.");

  const { data: shopItem, error: shopItemError } = await supabase.from("content_items").select("id,name_th,base_value").eq("rarity","uncommon").order("base_value",{ascending:false}).limit(1).single();
  if (shopItemError) throw shopItemError;
  async function shopTrade(action, quantity, itemId = shopItem.id) {
    const response = await fetch(`${appUrl}/api/shop/trade`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ action, characterId, itemId, quantity }) });
    return { response, body: await response.json() };
  }
  const shopPage = await fetch(`${appUrl}/shop?character=${characterId}`, { headers: { Cookie: cookie } });
  if (!shopPage.ok || !(await shopPage.text()).includes("ร้านค้ากริฟฟินทอง")) throw new Error("NPC shop page did not render.");
  const haggleResponse = await fetch(`${appUrl}/api/shop/haggle`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ characterId, itemId: shopItem.id }) });
  const haggleBody = await haggleResponse.json();
  if (haggleResponse.status !== 201 || !Number.isInteger(haggleBody.haggle?.dice_roll) || haggleBody.haggle.dice_roll < 1 || haggleBody.haggle.dice_roll > 20 || ![0,10,20].includes(haggleBody.haggle.discount_percent)) throw new Error(`Shop haggling failed: ${haggleResponse.status} ${JSON.stringify(haggleBody)}`);
  const duplicateHaggle = await fetch(`${appUrl}/api/shop/haggle`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ characterId, itemId: shopItem.id }) });
  if (duplicateHaggle.status !== 409) throw new Error("Haggle cooldown did not prevent rerolling.");
  const purchase = await shopTrade("buy", 1);
  const negotiatedPrice = haggleBody.haggle.offer_price;
  if (!purchase.response.ok || purchase.body.trade?.quantity !== 1 || purchase.body.trade?.unit_price !== negotiatedPrice || purchase.body.trade?.discount_percent !== haggleBody.haggle.discount_percent || purchase.body.trade?.balance_copper !== 750-negotiatedPrice) throw new Error(`Shop purchase failed: ${JSON.stringify(purchase.body)}`);
  const sale = await shopTrade("sell", 1);
  const expectedAfterSale = 750-negotiatedPrice+Math.max(1,Math.floor(shopItem.base_value*.5));
  if (!sale.response.ok || sale.body.trade?.quantity !== 0 || sale.body.trade?.balance_copper !== expectedAfterSale) throw new Error(`Shop sale failed: ${JSON.stringify(sale.body)}`);
  const excessivePurchase = await shopTrade("buy", 99);
  if (excessivePurchase.response.status !== 409) throw new Error("Shop allowed purchase beyond wallet balance.");

  const { data: questTemplate, error: questTemplateError } = await supabase.from("quest_templates").select("id,title_th,objective_template,reward_template").order("id").limit(1).single();
  if (questTemplateError) throw questTemplateError;
  const questPage = await fetch(`${appUrl}/quests?character=${characterId}`, { headers: { Cookie: cookie } });
  if (!questPage.ok || !(await questPage.text()).includes("บันทึกภารกิจ")) throw new Error("Quest Log page did not render.");
  async function questAction(action, payload) { const response=await fetch(`${appUrl}/api/quests`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({action,...payload})});return{response,body:await response.json()}; }
  const acceptedQuest=await questAction("accept",{characterId,templateId:questTemplate.id});
  if(acceptedQuest.response.status!==201||acceptedQuest.body.quest?.status!=="active")throw new Error(`Quest acceptance failed: ${JSON.stringify(acceptedQuest.body)}`);
  const duplicateQuest=await questAction("accept",{characterId,templateId:questTemplate.id});if(duplicateQuest.response.status!==409)throw new Error("Duplicate quest was accepted.");
  let progressedQuest;for(let step=0;step<questTemplate.objective_template.target_count;step++)progressedQuest=await questAction("advance",{questId:acceptedQuest.body.quest.id,amount:1});
  if(!progressedQuest.response.ok||progressedQuest.body.quest?.status!=="completed")throw new Error("Quest did not complete at target progress.");
  const duplicateReward=await questAction("advance",{questId:acceptedQuest.body.quest.id,amount:1});if(duplicateReward.response.status!==409)throw new Error("Completed quest granted progress twice.");
  const [{data:rewardedCharacter},{data:rewardedWallet}]=await Promise.all([supabase.from("characters").select("experience").eq("id",characterId).single(),supabase.from("character_wallets").select("balance_copper").eq("character_id",characterId).single()]);
  if(rewardedCharacter.experience!==questTemplate.reward_template.xp||rewardedWallet.balance_copper!==expectedAfterSale+questTemplate.reward_template.gold*100)throw new Error("Quest rewards were not applied correctly.");

  const {data:statusTemplate,error:statusTemplateError}=await supabase.from("status_effect_templates").select("id,default_duration,max_stacks").eq("slug","poisoned").single();if(statusTemplateError)throw statusTemplateError;
  async function statusAction(action,payload={}){const response=await fetch(`${appUrl}/api/status-effects`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({action,characterId,...payload})});return{response,body:await response.json()};}
  const firstStatus=await statusAction("apply",{templateId:statusTemplate.id,source:"E2E"});const stackedStatus=await statusAction("apply",{templateId:statusTemplate.id,source:"E2E"});
  if(firstStatus.response.status!==201||stackedStatus.body.effect?.stacks!==2||stackedStatus.body.effect?.duration_remaining!==statusTemplate.default_duration)throw new Error("Status stacking failed.");
  const tickedStatus=await statusAction("tick");if(!tickedStatus.response.ok||tickedStatus.body.effects?.[0]?.duration_remaining!==statusTemplate.default_duration-1)throw new Error("Status duration did not tick down.");
  const removedStatus=await statusAction("remove",{effectId:stackedStatus.body.effect.id});if(!removedStatus.response.ok)throw new Error("Status removal failed.");
  const {data:remainingStatuses}=await supabase.from("character_status_effects").select("id").eq("character_id",characterId);if(remainingStatuses.length!==0)throw new Error("Removed status remained active.");

  const {data:npcProfiles,error:npcProfilesError}=await supabase.from("npc_profiles").select("id,name_th").order("id");if(npcProfilesError||npcProfiles.length!==6)throw npcProfilesError??new Error("NPC profiles were not seeded.");
  const relationshipPage=await fetch(`${appUrl}/relationships?character=${characterId}`,{headers:{Cookie:cookie}});const relationshipHtml=await relationshipPage.text();if(!relationshipPage.ok||!relationshipHtml.includes("สายสัมพันธ์แห่งโลก")||!relationshipHtml.includes("พบได้ตอนนี้")||!relationshipHtml.includes("ไม่ว่าง")||!relationshipHtml.includes("ซื้อขายข่าวลับ"))throw new Error("NPC relationship page or schedules did not render.");
  async function affinityAction(npcId,action){const response=await fetch(`${appUrl}/api/npc/affinity`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({characterId,npcId,action})});return{response,body:await response.json()};}
  const talked=await affinityAction(npcProfiles[0].id,"talk");if(talked.response.status!==201||talked.body.affinity?.score!==1||talked.body.affinity?.tier!=="neutral")throw new Error(`NPC talk affinity failed: ${JSON.stringify(talked.body)}`);
  const affinityCooldown=await affinityAction(npcProfiles[0].id,"help");if(affinityCooldown.response.status!==409)throw new Error("NPC interaction cooldown was not enforced.");
  const walletBeforeGift=(await supabase.from("character_wallets").select("balance_copper").eq("character_id",characterId).single()).data.balance_copper;
  const gifted=await affinityAction(npcProfiles[1].id,"gift");if(gifted.response.status!==201||gifted.body.affinity?.score!==5||gifted.body.affinity?.cost_copper!==25||gifted.body.affinity?.wallet_balance!==walletBeforeGift-25)throw new Error(`NPC gift affinity failed: ${JSON.stringify(gifted.body)}`);
  const unavailableNpc=await affinityAction(npcProfiles[5].id,"talk");if(unavailableNpc.response.status!==409||unavailableNpc.body.error!=="npc_unavailable")throw new Error("Daytime interaction with a nocturnal NPC was not blocked.");

  const {data:guildStandings,error:guildStandingsError}=await supabase.rpc("guild_standings",{target_character_id:characterId});if(guildStandingsError||guildStandings.length!==4||"score" in guildStandings[0])throw guildStandingsError??new Error("Guild standings exposed hidden score or were not seeded.");
  const guildPage=await fetch(`${appUrl}/guilds?character=${characterId}`,{headers:{Cookie:cookie}});if(!guildPage.ok||!(await guildPage.text()).includes("สภาสี่กิลด์"))throw new Error("Guild page did not render.");
  async function guildAction(guildId,action){const response=await fetch(`${appUrl}/api/guilds/contribute`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({characterId,guildId,action})});return{response,body:await response.json()};}
  const guildService=await guildAction(guildStandings[0].guild_id,"service");if(guildService.response.status!==201||guildService.body.standing?.standing!=="unknown"||"score" in guildService.body.standing)throw new Error(`Guild service failed or exposed score: ${JSON.stringify(guildService.body)}`);
  const guildCooldown=await guildAction(guildStandings[0].guild_id,"service");if(guildCooldown.response.status!==409)throw new Error("Guild contribution cooldown was not enforced.");
  const walletBeforeGuild=(await supabase.from("character_wallets").select("balance_copper").eq("character_id",characterId).single()).data.balance_copper;
  const guildDonation=await guildAction(guildStandings[1].guild_id,"donate_gold");if(guildDonation.response.status!==201||guildDonation.body.standing?.cost_copper!==100||guildDonation.body.standing?.wallet_balance!==walletBeforeGuild-100)throw new Error(`Guild donation failed: ${JSON.stringify(guildDonation.body)}`);
  const {data:secretAffinity}=await supabase.from("character_guild_affinity").select("score").eq("character_id",characterId);if(secretAffinity.length!==0)throw new Error("Hidden guild score was readable by the player.");

  const {data:cookingRecipe,error:cookingRecipeError}=await supabase.from("cooking_recipes").select("id,output_item_id,effect_template_id").eq("slug","trail-skewers").single();if(cookingRecipeError)throw cookingRecipeError;
  const {data:cookingIngredients,error:cookingIngredientsError}=await supabase.from("cooking_recipe_ingredients").select("content_item_id,quantity").eq("recipe_id",cookingRecipe.id);if(cookingIngredientsError||cookingIngredients.length!==2)throw cookingIngredientsError??new Error("Cooking recipe ingredients are incomplete.");
  const cookingPage=await fetch(`${appUrl}/crafting/cooking?character=${characterId}`,{headers:{Cookie:cookie}});if(!cookingPage.ok||!(await cookingPage.text()).includes("ครัวกองไฟ"))throw new Error("Cooking page did not render.");
  let cooked;let cookingAttempts=0;
  while(!cooked?.body.result?.success&&cookingAttempts<5){for(const ingredient of cookingIngredients){const bought=await shopTrade("buy",ingredient.quantity,ingredient.content_item_id);if(!bought.response.ok)throw new Error(`Could not buy cooking ingredient: ${JSON.stringify(bought.body)}`);}const response=await fetch(`${appUrl}/api/crafting/cook`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({characterId,recipeId:cookingRecipe.id})});cooked={response,body:await response.json()};cookingAttempts++;if(cooked.response.status!==201)throw new Error(`Cooking failed: ${JSON.stringify(cooked.body)}`);}
  if(!cooked.body.result.success)throw new Error("Beginner cooking did not succeed within five attempts.");
  const [{data:cookedStack},{data:foodEffect},{data:cookingHistory}]=await Promise.all([supabase.from("character_item_stacks").select("quantity").eq("character_id",characterId).eq("content_item_id",cookingRecipe.output_item_id).single(),supabase.from("character_status_effects").select("source").eq("character_id",characterId).eq("template_id",cookingRecipe.effect_template_id).single(),supabase.from("cooking_history").select("id").eq("character_id",characterId)]);
  if(cookedStack.quantity<1||!foodEffect.source.startsWith("อาหาร:")||cookingHistory.length!==cookingAttempts)throw new Error("Cooking output, buff, or history was not persisted.");
  const missingCooking=await fetch(`${appUrl}/api/crafting/cook`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({characterId,recipeId:cookingRecipe.id})});if(missingCooking.status!==409)throw new Error("Cooking was allowed without ingredients.");

  const {data:brewingRecipe,error:brewingRecipeError}=await supabase.from("brewing_recipes").select("id,output_item_id").eq("slug","vitality-tonic").single();if(brewingRecipeError)throw brewingRecipeError;
  const {data:brewingIngredients,error:brewingIngredientsError}=await supabase.from("brewing_recipe_ingredients").select("content_item_id,quantity").eq("recipe_id",brewingRecipe.id);if(brewingIngredientsError||brewingIngredients.length!==2)throw brewingIngredientsError??new Error("Brewing ingredients are incomplete.");
  const brewingPage=await fetch(`${appUrl}/crafting/brewing?character=${characterId}`,{headers:{Cookie:cookie}});if(!brewingPage.ok||!(await brewingPage.text()).includes("โต๊ะปรุงยา"))throw new Error("Brewing page did not render.");
  for(const ingredient of brewingIngredients){const bought=await shopTrade("buy",ingredient.quantity,ingredient.content_item_id);if(!bought.response.ok)throw new Error(`Could not buy brewing ingredient: ${JSON.stringify(bought.body)}`);}
  const brewResponse=await fetch(`${appUrl}/api/crafting/brew`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({characterId,recipeId:brewingRecipe.id})});const brewBody=await brewResponse.json();
  if(brewResponse.status!==201||!["standard","potent","masterwork"].includes(brewBody.result?.quality)||brewBody.result.output_quantity<1||brewBody.result.output_quantity>3)throw new Error(`Potion brewing failed: ${JSON.stringify(brewBody)}`);
  const [{data:brewedStack},{data:brewingHistory}]=await Promise.all([supabase.from("character_item_stacks").select("quantity").eq("character_id",characterId).eq("content_item_id",brewingRecipe.output_item_id).single(),supabase.from("brewing_history").select("quality,output_quantity").eq("character_id",characterId)]);
  if(brewedStack.quantity!==brewBody.result.output_quantity||brewingHistory.length!==1||brewingHistory[0].quality!==brewBody.result.quality)throw new Error("Brewing output or history was not persisted.");
  const missingBrew=await fetch(`${appUrl}/api/crafting/brew`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({characterId,recipeId:brewingRecipe.id})});if(missingBrew.status!==409)throw new Error("Brewing was allowed without ingredients.");

  const generateResponse=await fetch(`${appUrl}/api/items/generate`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({characterId,category:"weapon"})});const generateBody=await generateResponse.json();
  if(generateResponse.status!==201||generateBody.item?.category!=="weapon"||!["common","uncommon","rare","epic","legendary"].includes(generateBody.item?.rarity)||!generateBody.item?.name_th||generateBody.item.power_rating<1||typeof generateBody.item.properties!=="object")throw new Error(`Procedural item generation failed: ${JSON.stringify(generateBody)}`);
  const generationCooldown=await fetch(`${appUrl}/api/items/generate`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({characterId,category:"armor"})});if(generationCooldown.status!==429)throw new Error("Procedural item cooldown was not enforced.");
  const forgePage=await fetch(`${appUrl}/forge?character=${characterId}`,{headers:{Cookie:cookie}});const forgeHtml=await forgePage.text();if(!forgePage.ok||!forgeHtml.includes("เตาหลอมชะตา")||!forgeHtml.includes(generateBody.item.name_th))throw new Error("Relic forge page did not render generated item.");
  const {data:generatedItems,error:generatedItemsError}=await supabase.from("generated_items").select("id,seed").eq("character_id",characterId);if(generatedItemsError||generatedItems.length!==1||generatedItems[0].id!==generateBody.item.id)throw generatedItemsError??new Error("Generated item was not persisted.");

  const {data:worldLocations,error:worldLocationsError}=await supabase.from("world_locations").select("id,slug,location_type,name_th,map_x,map_y");if(worldLocationsError)throw worldLocationsError;
  const worldCounts=Object.groupBy(worldLocations,location=>location.location_type);
  if(worldCounts.continent?.length!==1||worldCounts.kingdom?.length!==1||worldCounts.major_city?.length!==2||worldCounts.small_town?.length!==3||worldCounts.dungeon?.length!==1||worldCounts.wilderness?.length!==3)throw new Error(`World map location counts are incorrect: ${JSON.stringify(Object.fromEntries(Object.entries(worldCounts).map(([key,value])=>[key,value.length])))}`);
  const worldPage=await fetch(`${appUrl}/world?character=${characterId}`,{headers:{Cookie:cookie}});const worldHtml=await worldPage.text();if(!worldPage.ok||!worldHtml.includes("แผนที่เอเธอร์รา")||!worldHtml.includes("นครรุ่งอรุณ")||!worldHtml.includes("นครท่าตะวัน")||!worldHtml.includes("สุสานเสียงกระซิบ")||!worldHtml.includes("world-time-day")||!worldHtml.includes("08:00")||!worldHtml.includes("กลางวัน"))throw new Error("Interactive world map or initial day cycle did not render.");
  const [{data:initialWeather,error:initialWeatherError},{data:weatherPatterns,error:weatherPatternsError}]=await Promise.all([supabase.from("character_weather").select("weather_slug,intensity,period_index,location_id").eq("character_id",characterId).single(),supabase.from("weather_patterns").select("slug,name_th")]);if(initialWeatherError||weatherPatternsError||weatherPatterns.length!==6||initialWeather.period_index!==1||initialWeather.intensity<1||initialWeather.intensity>3||!worldHtml.includes(weatherPatterns.find(pattern=>pattern.slug===initialWeather.weather_slug)?.name_th??"__missing_weather__")||!worldHtml.includes(`weather-${initialWeather.weather_slug}`))throw initialWeatherError??weatherPatternsError??new Error("Persisted weather did not render on the world map.");
  const {data:worldPosition,error:worldPositionError}=await supabase.from("character_world_positions").select("location_id,world_locations(slug)").eq("character_id",characterId).single();if(worldPositionError||worldPosition.world_locations?.slug!=="dawnspire")throw worldPositionError??new Error("Character did not start at Dawnspire.");
  await fetch(`${appUrl}/world?character=${characterId}`,{headers:{Cookie:cookie}});
  const {count:positionCount}=await supabase.from("character_world_positions").select("*",{count:"exact",head:true}).eq("character_id",characterId);if(positionCount!==1)throw new Error("World map created duplicate character positions.");
  const sunharbor=worldLocations.find(location=>location.slug==="sunharbor");const dawnspire=worldLocations.find(location=>location.slug==="dawnspire");const greenhollow=worldLocations.find(location=>location.slug==="greenhollow");
  async function fastTravel(locationId,mode="fast_travel"){const response=await fetch(`${appUrl}/api/world/travel`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({characterId,locationId,mode})});return{response,body:await response.json()};}
  const outboundTravel=await fastTravel(sunharbor.id);if(!outboundTravel.response.ok||outboundTravel.body.travel?.location_id!==sunharbor.id||outboundTravel.body.travel?.cost_copper!==0)throw new Error(`Fast travel outbound failed: ${JSON.stringify(outboundTravel.body)}`);
  const invalidFastTravel=await fastTravel(greenhollow.id);if(invalidFastTravel.response.status!==409)throw new Error("Fast travel allowed a small-town destination.");
  const returnTravel=await fastTravel(dawnspire.id);if(!returnTravel.response.ok||returnTravel.body.travel?.location_id!==dawnspire.id)throw new Error(`Fast travel return failed: ${JSON.stringify(returnTravel.body)}`);
  const [{data:returnedPosition},{data:travelHistory}]=await Promise.all([supabase.from("character_world_positions").select("location_id").eq("character_id",characterId).single(),supabase.from("character_travel_history").select("from_location_id,to_location_id,travel_mode").eq("character_id",characterId).order("created_at")]);if(returnedPosition.location_id!==dawnspire.id||travelHistory.length!==2||travelHistory.some(trip=>trip.travel_mode!=="fast_travel"))throw new Error("Fast travel position or history was not persisted.");
  const riverrest=worldLocations.find(location=>location.slug==="riverrest");const {data:travelRation}=await supabase.from("content_items").select("id,base_value").eq("slug","common-19").single();
  const rationPurchase=await shopTrade("buy",1,travelRation.id);if(!rationPurchase.response.ok)throw new Error("Could not buy carriage ration.");
  const balanceBeforeCarriage=rationPurchase.body.trade.balance_copper;
  const carriageOutbound=await fastTravel(riverrest.id,"carriage");if(!carriageOutbound.response.ok||carriageOutbound.body.travel?.duration_hours!==8||carriageOutbound.body.travel?.cost_copper!==50||carriageOutbound.body.travel?.food_cost!==1||carriageOutbound.body.travel?.world_hours_elapsed!==8||carriageOutbound.body.travel?.wallet_balance!==balanceBeforeCarriage-50)throw new Error(`Carriage travel failed: ${JSON.stringify(carriageOutbound.body)}`);
  const noFoodReturn=await fastTravel(dawnspire.id,"carriage");if(noFoodReturn.response.status!==409||noFoodReturn.body.error!=="insufficient_food")throw new Error("Vehicle travel did not require food.");
  const returnRation=await shopTrade("buy",1,travelRation.id);if(!returnRation.response.ok)throw new Error("Could not buy return ration.");
  const carriageReturn=await fastTravel(dawnspire.id,"carriage");if(!carriageReturn.response.ok||carriageReturn.body.travel?.world_hours_elapsed!==16)throw new Error(`Carriage return failed: ${JSON.stringify(carriageReturn.body)}`);
  const [{data:vehiclePosition},{data:allTravelHistory}]=await Promise.all([supabase.from("character_world_positions").select("location_id,world_hours_elapsed").eq("character_id",characterId).single(),supabase.from("character_travel_history").select("travel_mode,duration_hours,cost_copper").eq("character_id",characterId).order("created_at")]);if(vehiclePosition.location_id!==dawnspire.id||vehiclePosition.world_hours_elapsed!==16||allTravelHistory.length!==4||allTravelHistory.filter(trip=>trip.travel_mode==="carriage").length!==2)throw new Error("Vehicle travel state or history was not persisted.");
  const encounterRation=await shopTrade("buy",1,travelRation.id);if(!encounterRation.response.ok)throw new Error("Could not buy encounter journey ration.");
  const interruptedTravel=await fastTravel(greenhollow.id,"carriage");if(!interruptedTravel.response.ok||interruptedTravel.body.travel?.interrupted!==true||!interruptedTravel.body.travel?.journey_id||!interruptedTravel.body.travel?.encounter?.name_th||interruptedTravel.body.travel?.location_id!==dawnspire.id||interruptedTravel.body.travel?.world_hours_elapsed!==22)throw new Error(`Random encounter did not interrupt the journey: ${JSON.stringify(interruptedTravel.body)}`);
  const activeJourneyPage=await fetch(`${appUrl}/world?character=${characterId}`,{headers:{Cookie:cookie}});const activeJourneyHtml=await activeJourneyPage.text();if(!activeJourneyPage.ok||!activeJourneyHtml.includes(interruptedTravel.body.travel.encounter.name_th)||!activeJourneyHtml.includes("RANDOM ENCOUNTER")||!activeJourneyHtml.includes("world-time-dawn")||!activeJourneyHtml.includes("06:00")||!activeJourneyHtml.includes("รุ่งสาง"))throw new Error("Persisted encounter or advanced day cycle did not render after reload.");
  const duplicateJourney=await fastTravel(riverrest.id,"carriage");if(duplicateJourney.response.status!==409||duplicateJourney.body.error!=="journey_active")throw new Error("A second journey started during an active encounter.");
  const resolveResponse=await fetch(`${appUrl}/api/world/travel`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({action:"resolve",characterId,journeyId:interruptedTravel.body.travel.journey_id})});const resolveBody=await resolveResponse.json();if(!resolveResponse.ok||resolveBody.travel?.interrupted!==false||resolveBody.travel?.location_id!==greenhollow.id||resolveBody.travel?.world_hours_elapsed!==28)throw new Error(`Travel encounter resolution failed: ${JSON.stringify(resolveBody)}`);
  const [{data:resolvedJourney},{data:resolvedPosition},{data:resolvedHistory}]=await Promise.all([supabase.from("character_journeys").select("status,elapsed_hours,duration_hours").eq("id",interruptedTravel.body.travel.journey_id).single(),supabase.from("character_world_positions").select("location_id,world_hours_elapsed").eq("character_id",characterId).single(),supabase.from("character_travel_history").select("id").eq("character_id",characterId)]);if(resolvedJourney.status!=="arrived"||resolvedJourney.elapsed_hours!==resolvedJourney.duration_hours||resolvedPosition.location_id!==greenhollow.id||resolvedPosition.world_hours_elapsed!==28||resolvedHistory.length!==5)throw new Error("Resolved journey state was not persisted exactly once.");
  const weatherResponse=await fetch(`${appUrl}/api/world/weather?character=${characterId}`,{headers:{Cookie:cookie}});const weatherBody=await weatherResponse.json();if(!weatherResponse.ok||weatherBody.weather?.period_index!==6||weatherBody.weather?.location_id!==greenhollow.id||!weatherPatterns.some(pattern=>pattern.slug===weatherBody.weather?.slug))throw new Error(`Weather did not advance with location and world time: ${JSON.stringify(weatherBody)}`);
  const villageEventResponse=await fetch(`${appUrl}/api/world/events?character=${characterId}`,{headers:{Cookie:cookie}});const villageEventBody=await villageEventResponse.json();const {data:villageTemplates,error:villageTemplatesError}=await supabase.from("village_event_templates").select("id");if(!villageEventResponse.ok||villageTemplatesError||villageTemplates.length!==16||!villageEventBody.event?.id||villageEventBody.event?.status!=="active"||villageEventBody.event?.location_id!==greenhollow.id||villageEventBody.event?.world_day!==2)throw villageTemplatesError??new Error(`Village event was not generated: ${JSON.stringify(villageEventBody)}`);
  const walletBeforeEvent=(await supabase.from("character_wallets").select("balance_copper").eq("character_id",characterId).single()).data.balance_copper;const resolveEventResponse=await fetch(`${appUrl}/api/world/events`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({characterId,eventId:villageEventBody.event.id,action:"participate"})});const resolveEventBody=await resolveEventResponse.json();if(!resolveEventResponse.ok||resolveEventBody.event?.status!=="completed"||resolveEventBody.event?.reward_copper!==villageEventBody.event.reward_copper||resolveEventBody.event?.wallet_balance!==walletBeforeEvent+villageEventBody.event.reward_copper)throw new Error(`Village event resolution failed: ${JSON.stringify(resolveEventBody)}`);
  const repeatEventResponse=await fetch(`${appUrl}/api/world/events`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({characterId,eventId:villageEventBody.event.id,action:"participate"})});if(repeatEventResponse.status!==409)throw new Error("Village event rewarded the character more than once.");
  const reloadedVillagePage=await fetch(`${appUrl}/world?character=${characterId}`,{headers:{Cookie:cookie}});const reloadedVillageHtml=await reloadedVillagePage.text();if(!reloadedVillagePage.ok||!reloadedVillageHtml.includes(villageEventBody.event.title_th)||!reloadedVillageHtml.includes("เหตุการณ์สิ้นสุดแล้ว"))throw new Error("Resolved village event did not persist after reload.");

  const updateResponse = await fetch(`${appUrl}/api/characters/${characterId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      hpCurrent: 5,
      hpMax: 12,
      stats: { strength: 9, dexterity: 17, constitution: 14, intelligence: 10, wisdom: 13, charisma: 12 },
      inventory: [{ id: "e2e-potion", name: "Healing Potion", quantity: 2, note: "E2E test item" }],
    }),
  });
  if (!updateResponse.ok) throw new Error(`Character Sheet update failed: ${updateResponse.status} ${await updateResponse.text()}`);

  const { data: updated, error: updateReadError } = await supabase.from("characters").select("hp_current,hp_max,strength,inventory").eq("id", characterId).single();
  if (updateReadError || updated.hp_current !== 5 || updated.hp_max !== 12 || updated.strength !== 9 || updated.inventory?.[0]?.name !== "Healing Potion") {
    throw updateReadError ?? new Error("Character Sheet values were not saved correctly.");
  }

  const outsider = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { data: hiddenCharacters, error: outsiderError } = await outsider.from("characters").select("id").eq("id", characterId);
  if (outsiderError || hiddenCharacters.length !== 0) throw outsiderError ?? new Error("RLS exposed a character to an unauthenticated client.");
  const { data: hiddenWallets, error: hiddenWalletError } = await outsider.from("character_wallets").select("character_id").eq("character_id", characterId);
  if (hiddenWalletError || hiddenWallets.length !== 0) throw hiddenWalletError ?? new Error("RLS exposed a wallet to an unauthenticated client.");
  const { data: hiddenStacks, error: hiddenStacksError } = await outsider.from("character_item_stacks").select("id").eq("character_id",characterId);
  if (hiddenStacksError || hiddenStacks.length !== 0) throw hiddenStacksError ?? new Error("RLS exposed purchased items.");
  const {data:hiddenQuests,error:hiddenQuestsError}=await outsider.from("character_quests").select("id").eq("character_id",characterId);if(hiddenQuestsError||hiddenQuests.length!==0)throw hiddenQuestsError??new Error("RLS exposed quest log.");
  const {data:hiddenStatuses,error:hiddenStatusesError}=await outsider.from("character_status_effects").select("id").eq("character_id",characterId);if(hiddenStatusesError||hiddenStatuses.length!==0)throw hiddenStatusesError??new Error("RLS exposed status effects.");
  const {data:hiddenHaggles,error:hiddenHagglesError}=await outsider.from("shop_haggles").select("id").eq("character_id",characterId);if(hiddenHagglesError||hiddenHaggles.length!==0)throw hiddenHagglesError??new Error("RLS exposed haggle attempts.");
  const {data:hiddenAffinity,error:hiddenAffinityError}=await outsider.from("character_npc_affinity").select("id").eq("character_id",characterId);if(hiddenAffinityError||hiddenAffinity.length!==0)throw hiddenAffinityError??new Error("RLS exposed NPC affinity.");
  const {data:hiddenSchedules,error:hiddenSchedulesError}=await outsider.from("npc_schedules").select("id");if(hiddenSchedulesError||hiddenSchedules.length!==0)throw hiddenSchedulesError??new Error("RLS exposed NPC schedules publicly.");
  const {data:hiddenRaceLore,error:hiddenRaceLoreError}=await outsider.from("race_lore").select("race_id");if(hiddenRaceLoreError||hiddenRaceLore.length!==0)throw hiddenRaceLoreError??new Error("RLS exposed race lore publicly.");
  const {data:hiddenInnate,error:hiddenInnateError}=await outsider.from("character_innate_abilities").select("character_id").eq("character_id",characterId);if(hiddenInnateError||hiddenInnate.length!==0)throw hiddenInnateError??new Error("RLS exposed assigned innate ability.");
  const {data:hiddenGuildAffinity,error:hiddenGuildAffinityError}=await outsider.from("character_guild_affinity").select("id").eq("character_id",characterId);if(hiddenGuildAffinityError||hiddenGuildAffinity.length!==0)throw hiddenGuildAffinityError??new Error("RLS exposed hidden guild affinity.");
  const {data:hiddenCooking,error:hiddenCookingError}=await outsider.from("cooking_history").select("id").eq("character_id",characterId);if(hiddenCookingError||hiddenCooking.length!==0)throw hiddenCookingError??new Error("RLS exposed cooking history.");
  const {data:hiddenBrewing,error:hiddenBrewingError}=await outsider.from("brewing_history").select("id").eq("character_id",characterId);if(hiddenBrewingError||hiddenBrewing.length!==0)throw hiddenBrewingError??new Error("RLS exposed brewing history.");
  const {data:hiddenGenerated,error:hiddenGeneratedError}=await outsider.from("generated_items").select("id").eq("character_id",characterId);if(hiddenGeneratedError||hiddenGenerated.length!==0)throw hiddenGeneratedError??new Error("RLS exposed generated items.");
  const {data:hiddenPositions,error:hiddenPositionsError}=await outsider.from("character_world_positions").select("character_id").eq("character_id",characterId);if(hiddenPositionsError||hiddenPositions.length!==0)throw hiddenPositionsError??new Error("RLS exposed character world position.");
  const {data:hiddenTravel,error:hiddenTravelError}=await outsider.from("character_travel_history").select("id").eq("character_id",characterId);if(hiddenTravelError||hiddenTravel.length!==0)throw hiddenTravelError??new Error("RLS exposed travel history.");
  const {data:hiddenJourneys,error:hiddenJourneysError}=await outsider.from("character_journeys").select("id").eq("character_id",characterId);if(hiddenJourneysError||hiddenJourneys.length!==0)throw hiddenJourneysError??new Error("RLS exposed active journeys.");
  const {data:hiddenWeather,error:hiddenWeatherError}=await outsider.from("character_weather").select("character_id").eq("character_id",characterId);if(hiddenWeatherError||hiddenWeather.length!==0)throw hiddenWeatherError??new Error("RLS exposed character weather.");
  const {data:hiddenVillageEvents,error:hiddenVillageEventsError}=await outsider.from("character_village_events").select("id").eq("character_id",characterId);if(hiddenVillageEventsError||hiddenVillageEvents.length!==0)throw hiddenVillageEventsError??new Error("RLS exposed village events.");

  console.log(JSON.stringify({ signup: true, apiCreate: true, invalidPayloadRejected: true, racialBonus: character.dexterity === 17, lobbyRender: true, sheetRender: true,raceLorePages:true,raceLoreStartingZones:true,innatePool:true,innateRandomAssignment:true,innateImmutable:true,codexBestiary:true,codexItems:true,codexLore:true,codexDropRates:true, sheetUpdate: true, inventoryPersistence: true, walletStartingFunds: true, walletLedger: true, overdraftRejected: true, shopRender: true, shopHaggle:true,haggleCooldown:true,negotiatedPrice:true,shopBuy: true, shopSell: true, excessivePurchaseRejected: true, questLogRender:true,questAccept:true,questComplete:true,questRewardOnce:true,statusApply:true,statusStacks:true,statusDuration:true,statusRemove:true,npcAffinityPage:true,npcAffinityTalk:true,npcAffinityGift:true,npcAffinityCooldown:true,npcSchedules:true,npcAvailability:true,guildPage:true,guildHiddenScore:true,guildService:true,guildDonation:true,guildCooldown:true,cookingPage:true,cookingIngredients:true,cookingRoll:true,cookingOutput:true,cookingBuff:true,brewingPage:true,brewingIngredients:true,brewingQuality:true,brewingOutput:true,proceduralItem:true,proceduralItemPersisted:true,itemGenerationCooldown:true,forgePage:true,worldMap:true,worldLocationCounts:true,worldStartPosition:true,worldPositionUnique:true,fastTravel:true,fastTravelRestriction:true,travelHistory:true,carriageTravel:true,travelConsumesFood:true,travelConsumesCoins:true,worldTimeProgress:true,travelLoading:true,randomEncounter:true,encounterPersistence:true,encounterResolution:true,dayNightCycle:true,worldClock:true,weatherSystem:true,weatherPersistence:true,weatherVisuals:true,villageEvents:true,eventRewardOnce:true,eventPersistence:true, rlsOwnerRead: true, rlsPublicDenied: true }));
} finally {
  if (characterId) await supabase.from("characters").delete().eq("id", characterId);
  if (userId) await fetch(`${url}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } });
}
