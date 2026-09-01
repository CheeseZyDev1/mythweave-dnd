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

  const lobbyResponse = await fetch(`${appUrl}/lobby`, { headers: { Cookie: cookie } });
  const lobbyHtml = await lobbyResponse.text();
  if (!lobbyResponse.ok || !lobbyHtml.includes("Aria Forge")) throw new Error("Character was not rendered in the authenticated lobby.");

  const sheetResponse = await fetch(`${appUrl}/characters/${characterId}`, { headers: { Cookie: cookie } });
  const sheetHtml = await sheetResponse.text();
  if (!sheetResponse.ok || !sheetHtml.includes("Aria Forge") || !sheetHtml.includes("Character Sheet") || !sheetHtml.includes("กระเป๋าเหรียญ")) throw new Error("Character Sheet or wallet did not render.");

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

  const {data:npcProfiles,error:npcProfilesError}=await supabase.from("npc_profiles").select("id,name_th").order("id").limit(2);if(npcProfilesError||npcProfiles.length!==2)throw npcProfilesError??new Error("NPC profiles were not seeded.");
  const relationshipPage=await fetch(`${appUrl}/relationships?character=${characterId}`,{headers:{Cookie:cookie}});if(!relationshipPage.ok||!(await relationshipPage.text()).includes("สายสัมพันธ์แห่งโลก"))throw new Error("NPC relationship page did not render.");
  async function affinityAction(npcId,action){const response=await fetch(`${appUrl}/api/npc/affinity`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify({characterId,npcId,action})});return{response,body:await response.json()};}
  const talked=await affinityAction(npcProfiles[0].id,"talk");if(talked.response.status!==201||talked.body.affinity?.score!==1||talked.body.affinity?.tier!=="neutral")throw new Error(`NPC talk affinity failed: ${JSON.stringify(talked.body)}`);
  const affinityCooldown=await affinityAction(npcProfiles[0].id,"help");if(affinityCooldown.response.status!==409)throw new Error("NPC interaction cooldown was not enforced.");
  const walletBeforeGift=(await supabase.from("character_wallets").select("balance_copper").eq("character_id",characterId).single()).data.balance_copper;
  const gifted=await affinityAction(npcProfiles[1].id,"gift");if(gifted.response.status!==201||gifted.body.affinity?.score!==5||gifted.body.affinity?.cost_copper!==25||gifted.body.affinity?.wallet_balance!==walletBeforeGift-25)throw new Error(`NPC gift affinity failed: ${JSON.stringify(gifted.body)}`);

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
  const {data:hiddenGuildAffinity,error:hiddenGuildAffinityError}=await outsider.from("character_guild_affinity").select("id").eq("character_id",characterId);if(hiddenGuildAffinityError||hiddenGuildAffinity.length!==0)throw hiddenGuildAffinityError??new Error("RLS exposed hidden guild affinity.");
  const {data:hiddenCooking,error:hiddenCookingError}=await outsider.from("cooking_history").select("id").eq("character_id",characterId);if(hiddenCookingError||hiddenCooking.length!==0)throw hiddenCookingError??new Error("RLS exposed cooking history.");

  console.log(JSON.stringify({ signup: true, apiCreate: true, invalidPayloadRejected: true, racialBonus: character.dexterity === 17, lobbyRender: true, sheetRender: true, sheetUpdate: true, inventoryPersistence: true, walletStartingFunds: true, walletLedger: true, overdraftRejected: true, shopRender: true, shopHaggle:true,haggleCooldown:true,negotiatedPrice:true,shopBuy: true, shopSell: true, excessivePurchaseRejected: true, questLogRender:true,questAccept:true,questComplete:true,questRewardOnce:true,statusApply:true,statusStacks:true,statusDuration:true,statusRemove:true,npcAffinityPage:true,npcAffinityTalk:true,npcAffinityGift:true,npcAffinityCooldown:true,guildPage:true,guildHiddenScore:true,guildService:true,guildDonation:true,guildCooldown:true,cookingPage:true,cookingIngredients:true,cookingRoll:true,cookingOutput:true,cookingBuff:true, rlsOwnerRead: true, rlsPublicDenied: true }));
} finally {
  if (characterId) await supabase.from("characters").delete().eq("id", characterId);
  if (userId) await fetch(`${url}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } });
}
