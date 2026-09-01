import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { ShopClient } from "./shop-client";
export const metadata: Metadata = { title: "NPC Shop — Mythweave" };
type Props = { searchParams: Promise<{ character?: string }> };
export default async function ShopPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const { character: id } = await searchParams;
  if (!id) redirect("/lobby");
  const [
    { data: character },
    { data: wallet },
    { data: items },
    { data: stacks },
    { data: haggles },
  ] = await Promise.all([
    supabase
      .from("characters")
      .select("id,name,race,character_class,charisma")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("character_wallets")
      .select("balance_copper")
      .eq("character_id", id)
      .maybeSingle(),
    supabase
      .from("content_items")
      .select("id,name_th,name_en,rarity,category,base_value,tags")
      .in("rarity", ["common", "uncommon"])
      .order("rarity")
      .order("base_value"),
    supabase
      .from("character_item_stacks")
      .select("id,content_item_id,quantity,acquired_unit_value")
      .eq("character_id", id),
    supabase
      .from("shop_haggles")
      .select("id,content_item_id,dice_roll,charisma_modifier,difficulty_class,discount_percent,expires_at,consumed_at,created_at")
      .eq("character_id", id)
      .gt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false }),
  ]);
  if (!character || !wallet) notFound();
  return (
    <ShopClient
      character={character}
      initialBalance={wallet.balance_copper}
      items={items ?? []}
      initialStacks={stacks ?? []}
      initialHaggles={haggles ?? []}
    />
  );
}
