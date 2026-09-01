"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { splitCoins } from "../../lib/wallet/types";
type Item = {
  id: number;
  name_th: string;
  name_en: string;
  rarity: string;
  category: string;
  base_value: number;
  tags: string[];
};
type Stack = {
  id: string;
  content_item_id: number;
  quantity: number;
  acquired_unit_value: number;
};
type Haggle = {
  id: string;
  content_item_id: number;
  dice_roll: number;
  charisma_modifier: number;
  difficulty_class: number;
  discount_percent: number;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};
export function ShopClient({
  character,
  initialBalance,
  items,
  initialStacks,
  initialHaggles,
}: {
  character: {
    id: string;
    name: string;
    race: string;
    character_class: string;
    charisma: number;
  };
  initialBalance: number;
  items: Item[];
  initialStacks: Stack[];
  initialHaggles: Haggle[];
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [stacks, setStacks] = useState(initialStacks);
  const [haggles, setHaggles] = useState(initialHaggles);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const coins = splitCoins(balance);
  const visible = useMemo(
    () =>
      filter === "all"
        ? items
        : items.filter((item) => item.category === filter),
    [filter, items],
  );
  async function trade(action: "buy" | "sell", itemId: number) {
    setBusy(itemId);
    setMessage("");
    try {
      const response = await fetch("/api/shop/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          characterId: character.id,
          itemId,
          quantity: 1,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error === "insufficient_funds"
            ? "เหรียญไม่พอซื้อสินค้านี้"
            : result.error === "insufficient_items"
              ? "ไม่มีสินค้านี้ในกระเป๋า"
              : "ทำรายการไม่สำเร็จ",
        );
      setBalance(result.trade.balance_copper);
      if (action === "buy" && result.trade.discount_percent > 0) {
        setHaggles((current) =>
          current.map((haggle) =>
            haggle.content_item_id === itemId && !haggle.consumed_at
              ? { ...haggle, consumed_at: new Date().toISOString() }
              : haggle,
          ),
        );
      }
      setStacks((current) => {
        const existing = current.find(
          (stack) => stack.content_item_id === itemId,
        );
        if (result.trade.quantity === 0)
          return current.filter((stack) => stack.content_item_id !== itemId);
        if (existing)
          return current.map((stack) =>
            stack.content_item_id === itemId
              ? { ...stack, quantity: result.trade.quantity }
              : stack,
          );
        return [
          ...current,
          {
            id: result.trade.stack_id,
            content_item_id: itemId,
            quantity: result.trade.quantity,
            acquired_unit_value:
              items.find((item) => item.id === itemId)?.base_value ?? 0,
          },
        ];
      });
      setMessage(
        `${action === "buy" ? "ซื้อ" : "ขาย"} ${result.trade.item_name} สำเร็จ${result.trade.discount_percent ? ` · ลด ${result.trade.discount_percent}%` : ""}`,
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "ทำรายการไม่สำเร็จ",
      );
    } finally {
      setBusy(null);
    }
  }
  async function haggle(itemId: number) {
    setBusy(itemId);
    setMessage("");
    try {
      const response = await fetch("/api/shop/haggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: character.id, itemId }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result.error === "cooldown"
            ? "ต้องรอ 5 นาทีก่อนต่อรองสินค้านี้อีกครั้ง"
            : "ต่อรองไม่สำเร็จ",
        );
      }
      const offer = result.haggle;
      setHaggles((current) => [
        {
          id: offer.id,
          content_item_id: offer.item_id,
          dice_roll: offer.dice_roll,
          charisma_modifier: offer.charisma_modifier,
          difficulty_class: offer.difficulty_class,
          discount_percent: offer.discount_percent,
          expires_at: offer.expires_at,
          consumed_at: null,
          created_at: new Date().toISOString(),
        },
        ...current.filter((item) => item.content_item_id !== offer.item_id),
      ]);
      setMessage(
        offer.success
          ? `ต่อรองสำเร็จ! d20 ${offer.dice_roll} + CHA ${offer.charisma_modifier} = ${offer.total} · ลด ${offer.discount_percent}% สำหรับการซื้อครั้งถัดไป`
          : `พ่อค้าไม่ยอมลดราคา · d20 ${offer.dice_roll} + CHA ${offer.charisma_modifier} = ${offer.total} (DC ${offer.difficulty_class})`,
      );
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "ต่อรองไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }
  return (
    <main className="shop-shell">
      <header>
        <Link href={`/characters/${character.id}`}>← Character Sheet</Link>
        <span>MYTHWEAVE · NPC MARKET</span>
        <i>{character.name}</i>
      </header>
      <section className="shop-hero">
        <div>
          <small>THE GILDED WYVERN</small>
          <h1>ร้านค้ากริฟฟินทอง</h1>
          <p>อุปกรณ์เดินทางจาก content pool · รับซื้อคืนครึ่งราคา</p>
        </div>
        <div className="shop-wallet">
          <span>ยอดคงเหลือ</span>
          <strong>
            {coins.platinum} PP · {coins.gold} GP · {coins.silver} SP ·{" "}
            {coins.copper} CP
          </strong>
          <small>{balance} copper ทั้งหมด</small>
        </div>
      </section>
      <nav className="shop-filters">
        {[
          "all",
          "weapon",
          "armor",
          "consumable",
          "tool",
          "material",
          "treasure",
        ].map((value) => (
          <button
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
            key={value}
          >
            {value}
          </button>
        ))}
      </nav>
      {message && <p className="shop-message">{message}</p>}
      <section className="shop-grid">
        {visible.map((item) => {
          const owned =
            stacks.find((stack) => stack.content_item_id === item.id)
              ?.quantity ?? 0;
          const recentHaggle = haggles.find(
            (haggle) =>
              haggle.content_item_id === item.id &&
              new Date(haggle.expires_at).getTime() > Date.now(),
          );
          const haggleOffer = recentHaggle?.consumed_at ? undefined : recentHaggle;
          const offerPrice = haggleOffer?.discount_percent
            ? Math.max(
                1,
                Math.floor(
                  (item.base_value * (100 - haggleOffer.discount_percent)) /
                    100,
                ),
              )
            : item.base_value;
          return (
            <article key={item.id}>
              <div className={`shop-item-icon ${item.rarity}`}>
                {item.category.slice(0, 1).toUpperCase()}
              </div>
              <small>
                {item.rarity} · {item.category}
              </small>
              <h2>{item.name_th}</h2>
              <p>{item.name_en}</p>
              <div className="shop-price">
                <strong>
                  {offerPrice} CP
                  {offerPrice !== item.base_value && (
                    <del>{item.base_value} CP</del>
                  )}
                </strong>
                <span>มี {owned}</span>
              </div>
              <button
                className={`haggle-button ${recentHaggle ? (recentHaggle.discount_percent > 0 ? "won" : "lost") : ""}`}
                onClick={() => haggle(item.id)}
                disabled={busy !== null || Boolean(recentHaggle)}
              >
                {recentHaggle
                  ? recentHaggle.consumed_at
                    ? "ใช้ข้อเสนอแล้ว · รอรอบถัดไป"
                    : recentHaggle.discount_percent > 0
                      ? `ข้อเสนอ -${recentHaggle.discount_percent}% · ใช้ได้ครั้งเดียว`
                    : "ต่อรองพลาด · รอ 5 นาที"
                  : `ต่อราคา · CHA ${character.charisma}`}
              </button>
              <footer>
                <button
                  onClick={() => trade("buy", item.id)}
                  disabled={busy !== null}
                >
                  ซื้อ
                </button>
                <button
                  onClick={() => trade("sell", item.id)}
                  disabled={busy !== null || owned < 1}
                >
                  ขาย {Math.max(1, Math.floor(item.base_value * 0.5))} CP
                </button>
              </footer>
            </article>
          );
        })}
      </section>
    </main>
  );
}
