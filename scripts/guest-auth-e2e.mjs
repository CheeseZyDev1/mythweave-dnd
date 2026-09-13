import { createBrowserClient } from "@supabase/ssr";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  appUrl = process.env.TEST_APP_URL ?? "http://127.0.0.1:3212";
if (!url || !key) throw new Error("Missing Supabase environment");
const jar = new Map(),
  supabase = createBrowserClient(url, key, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (items) =>
        items.forEach(({ name, value }) =>
          value ? jar.set(name, value) : jar.delete(name),
        ),
    },
  });
const { data, error } = await supabase.auth.signInAnonymously({
  options: { data: { display_name: "Quick Wanderer" } },
});
if (error || !data.user?.is_anonymous)
  throw error ?? new Error("Anonymous session missing");
const cookie = [...jar]
  .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
  .join("; ");
const response = await fetch(`${appUrl}/lobby`, {
    headers: { Cookie: cookie },
  }),
  html = await response.text();
if (!response.ok || !html.includes("Quick Wanderer") || !html.includes("Guest"))
  throw new Error("Guest lobby did not render");
let characterId;
try {
  const { data: dimension, error: dimensionError } = await supabase
    .from("dimension_presets")
    .select("id")
    .eq("active", true)
    .order("sort_order")
    .limit(1)
    .single();
  if (dimensionError) throw dimensionError;
  const created = await fetch(`${appUrl}/api/characters`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      name: "Guest Scribe",
      race: "human",
      characterClass: "fighter",
      secondaryClass: null,
      profession: "chronicler",
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
        face: "soft",
        body: "balanced",
        portraitBackdrop: "forest",
        portraitFrame: "gold",
        portraitSigil: "class",
      },
    }),
  });
  const body = await created.json();
  if (created.status !== 201 || !body.id)
    throw new Error(
      `Guest character creation failed (${created.status}): ${JSON.stringify(body)}`,
    );
  characterId = body.id;
  const guestLobby = await fetch(`${appUrl}/lobby`, {
      headers: { Cookie: cookie },
    }),
    guestLobbyHtml = await guestLobby.text();
  if (
    !guestLobby.ok ||
    !guestLobbyHtml.includes("Guest Scribe") ||
    !guestLobbyHtml.includes("สร้างห้อง") ||
    !guestLobbyHtml.includes("จอยห้อง")
  )
    throw new Error(
      "Saved guest character or room actions did not appear in lobby",
    );
  console.log(
    JSON.stringify({
      userId: data.user.id,
      guestAuth: true,
      displayName: true,
      lobby: true,
      characterSaved: true,
      roomActions: true,
    }),
  );
} finally {
  if (characterId)
    await supabase.from("characters").delete().eq("id", characterId);
}
