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
  async function shopTrade(action, quantity) {
    const response = await fetch(`${appUrl}/api/shop/trade`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ action, characterId, itemId: shopItem.id, quantity }) });
    return { response, body: await response.json() };
  }
  const shopPage = await fetch(`${appUrl}/shop?character=${characterId}`, { headers: { Cookie: cookie } });
  if (!shopPage.ok || !(await shopPage.text()).includes("ร้านค้ากริฟฟินทอง")) throw new Error("NPC shop page did not render.");
  const purchase = await shopTrade("buy", 1);
  if (!purchase.response.ok || purchase.body.trade?.quantity !== 1 || purchase.body.trade?.balance_copper !== 750-shopItem.base_value) throw new Error(`Shop purchase failed: ${JSON.stringify(purchase.body)}`);
  const sale = await shopTrade("sell", 1);
  const expectedAfterSale = 750-shopItem.base_value+Math.max(1,Math.floor(shopItem.base_value*.5));
  if (!sale.response.ok || sale.body.trade?.quantity !== 0 || sale.body.trade?.balance_copper !== expectedAfterSale) throw new Error(`Shop sale failed: ${JSON.stringify(sale.body)}`);
  const excessivePurchase = await shopTrade("buy", 99);
  if (excessivePurchase.response.status !== 409) throw new Error("Shop allowed purchase beyond wallet balance.");

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

  console.log(JSON.stringify({ signup: true, apiCreate: true, invalidPayloadRejected: true, racialBonus: character.dexterity === 17, lobbyRender: true, sheetRender: true, sheetUpdate: true, inventoryPersistence: true, walletStartingFunds: true, walletLedger: true, overdraftRejected: true, shopRender: true, shopBuy: true, shopSell: true, excessivePurchaseRejected: true, rlsOwnerRead: true, rlsPublicDenied: true }));
} finally {
  if (characterId) await supabase.from("characters").delete().eq("id", characterId);
  if (userId) await fetch(`${url}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } });
}
