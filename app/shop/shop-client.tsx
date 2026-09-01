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
export function ShopClient({
  character,
  initialBalance,
  items,
  initialStacks,
}: {
  character: {
    id: string;
    name: string;
    race: string;
    character_class: string;
  };
  initialBalance: number;
  items: Item[];
  initialStacks: Stack[];
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [stacks, setStacks] = useState(initialStacks);
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
        `${action === "buy" ? "ซื้อ" : "ขาย"} ${result.trade.item_name} สำเร็จ`,
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "ทำรายการไม่สำเร็จ",
      );
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
                <strong>{item.base_value} CP</strong>
                <span>มี {owned}</span>
              </div>
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
