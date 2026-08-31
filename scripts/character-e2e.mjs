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

  const outsider = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { data: hiddenCharacters, error: outsiderError } = await outsider.from("characters").select("id").eq("id", characterId);
  if (outsiderError || hiddenCharacters.length !== 0) throw outsiderError ?? new Error("RLS exposed a character to an unauthenticated client.");

  console.log(JSON.stringify({ signup: true, apiCreate: true, invalidPayloadRejected: true, racialBonus: character.dexterity === 17, lobbyRender: true, rlsOwnerRead: true, rlsPublicDenied: true, hp: character.hp_max }));
} finally {
  if (characterId) await supabase.from("characters").delete().eq("id", characterId);
  if (userId) await fetch(`${url}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } });
}
