"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { findClass, findRace, STAT_KEYS, STAT_LABELS, type Appearance, type Stats } from "../../../lib/characters/catalog";
import { abilityModifier } from "../../../lib/characters/rules";
import type { InventoryItem } from "../../../lib/characters/sheet";
import { CharacterAvatar } from "../character-avatar";
import type { WalletTransaction } from "../../../lib/wallet/types";
import { WalletPanel } from "./wallet-panel";
import { StatusPanel } from "./status-panel";

type Character = {
  id: string;
  name: string;
  race: string;
  characterClass: string;
  level: number;
  experience: number;
  hpCurrent: number;
  hpMax: number;
  stats: Stats;
  appearance: Appearance;
  inventory: InventoryItem[];
  updatedAt: string;
};

const errorMessages: Record<string, string> = {
  invalid_hp: "ค่า HP ไม่ถูกต้อง",
  invalid_stats: "ค่าสถานะต้องอยู่ระหว่าง 1–30",
  invalid_inventory: "กรุณาตรวจชื่อ จำนวน และรายละเอียดสิ่งของ",
  not_found: "ไม่พบตัวละครนี้ หรือคุณไม่มีสิทธิ์แก้ไข",
  save_failed: "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง",
};

function signed(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

export function CharacterSheet({ character, wallet, statuses, innate }: { character: Character; innate: {name_th:string;description_th:string;activation:string;effect_key:string;effect_value:number;usage_rule_th:string}|null; wallet: { balance: number; transactions: WalletTransaction[] }; statuses: { templates: Array<{id:number;name_th:string;effect_type:string;description_th:string;default_duration:number;max_stacks:number}>; effects: Array<{id:string;template_id:number;name_th:string;effect_type:string;description_th:string;duration_remaining:number;stacks:number;source:string}> } }) {
  const [stats, setStats] = useState(character.stats);
  const [hpCurrent, setHpCurrent] = useState(character.hpCurrent);
  const [hpMax, setHpMax] = useState(character.hpMax);
  const [inventory, setInventory] = useState(character.inventory);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const race = findRace(character.race);
  const selectedClass = findClass(character.characterClass);
  const proficiency = 2 + Math.floor((character.level - 1) / 4);
  const armorClass = 10 + abilityModifier(stats.dexterity);
  const passivePerception = 10 + abilityModifier(stats.wisdom);
  const hpPercent = useMemo(() => Math.max(0, Math.min(100, hpMax ? (hpCurrent / hpMax) * 100 : 0)), [hpCurrent, hpMax]);

  function changeStat(key: keyof Stats, amount: number) {
    setStats((current) => ({ ...current, [key]: Math.max(1, Math.min(30, current[key] + amount)) }));
    setStatus("idle");
  }

  function addItem() {
    setInventory((items) => [...items, { id: crypto.randomUUID(), name: "", quantity: 1, note: "" }]);
    setStatus("idle");
  }

  function updateItem(id: string, patch: Partial<InventoryItem>) {
    setInventory((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch(`/api/characters/${character.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats, hpCurrent, hpMax, inventory }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(errorMessages[result.error] ?? errorMessages.save_failed);
      setStatus("saved");
      setMessage("บันทึก Character Sheet แล้ว");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : errorMessages.save_failed);
    }
  }

  return (
    <main className="sheet-shell">
      <header className="sheet-topbar"><Link href="/lobby">← กลับล็อบบี้</Link><span>MYTHWEAVE · CHARACTER SHEET</span><button onClick={save} disabled={status === "saving"}>{status === "saving" ? "กำลังบันทึก…" : "บันทึกการเปลี่ยนแปลง"}</button></header>
      <section className="sheet-layout">
        <aside className="sheet-identity">
          <div className="sheet-avatar"><CharacterAvatar appearance={character.appearance} characterClass={character.characterClass} name={character.name} race={character.race} /></div>
          <small>LEVEL {character.level} · {selectedClass?.role}</small>
          <h1>{character.name}</h1>
          <p>{race?.label} · {selectedClass?.label}</p>
          <div className="sheet-hp-heading"><span>พลังชีวิต</span><strong>{hpCurrent} / {hpMax}</strong></div>
          <div className="sheet-hp-track"><i style={{ width: `${hpPercent}%` }} /></div>
          <div className="sheet-hp-controls">
            <label><span>HP ปัจจุบัน</span><input type="number" min="0" max={hpMax} value={hpCurrent} onChange={(event) => { setHpCurrent(Math.max(0, Math.min(hpMax, Number(event.target.value)))); setStatus("idle"); }} /></label>
            <label><span>HP สูงสุด</span><input type="number" min="1" max="9999" value={hpMax} onChange={(event) => { const value = Math.max(1, Math.min(9999, Number(event.target.value))); setHpMax(value); setHpCurrent((hp) => Math.min(hp, value)); setStatus("idle"); }} /></label>
          </div>
          <div className="sheet-derived">
            <div><strong>{armorClass}</strong><span>เกราะ AC</span></div>
            <div><strong>+{proficiency}</strong><span>Proficiency</span></div>
            <div><strong>{passivePerception}</strong><span>Passive WIS</span></div>
          </div>
          <p className="sheet-updated">แก้ไขล่าสุด {new Date(character.updatedAt).toLocaleString("th-TH")}</p>
          {innate && <section className="innate-card"><small>INNATE GIFT · {innate.activation}</small><h3>{innate.name_th}</h3><p>{innate.description_th}</p><b>{innate.usage_rule_th}</b></section>}
          <Link className="wallet-shop-link" href={`/relationships?character=${character.id}`}>สายสัมพันธ์ NPC →</Link>
          <Link className="wallet-shop-link" href={`/guilds?character=${character.id}`}>ชื่อเสียงกิลด์ →</Link>
          <Link className="wallet-shop-link" href={`/crafting/cooking?character=${character.id}`}>ครัวกองไฟ →</Link>
          <Link className="wallet-shop-link" href={`/crafting/brewing?character=${character.id}`}>โต๊ะปรุงยา →</Link>
          <Link className="wallet-shop-link" href={`/forge?character=${character.id}`}>เตาหลอม Relic →</Link>
          <Link className="wallet-shop-link" href={`/world?character=${character.id}`}>แผนที่โลก →</Link>
          <Link className="wallet-shop-link" href={`/lore/races/${character.race}?character=${character.id}`}>ตำนานเผ่าของฉัน →</Link>
          <Link className="wallet-shop-link" href={`/bestiary?character=${character.id}`}>สมุดบันทึกอสูร →</Link>
          <Link className="wallet-shop-link" href={`/codex?character=${character.id}`}>Codex รวมความรู้ →</Link>
          <Link className="wallet-shop-link" href={`/companions?character=${character.id}`}>โฮมุนครุสคู่หู →</Link>
        </aside>

        <div className="sheet-main">
          <section className="sheet-panel">
            <div className="sheet-section-title"><div><small>ABILITIES</small><h2>ค่าสถานะ</h2></div><p>ปรับได้ 1–30 · modifier คำนวณอัตโนมัติ</p></div>
            <div className="sheet-stats">{STAT_KEYS.map((key) => <article key={key}><span>{STAT_LABELS[key].short}</span><small>{STAT_LABELS[key].label}</small><strong>{stats[key]}</strong><em>{signed(abilityModifier(stats[key]))}</em><div><button onClick={() => changeStat(key, -1)} disabled={stats[key] <= 1}>−</button><button onClick={() => changeStat(key, 1)} disabled={stats[key] >= 30}>+</button></div></article>)}</div>
          </section>

          <section className="sheet-panel">
            <div className="sheet-section-title"><div><small>INVENTORY</small><h2>สัมภาระ</h2></div><button className="sheet-add" onClick={addItem} disabled={inventory.length >= 100}>+ เพิ่มสิ่งของ</button></div>
            {inventory.length ? <div className="inventory-list">
              <div className="inventory-head"><span>สิ่งของ</span><span>จำนวน</span><span>รายละเอียด</span><span /></div>
              {inventory.map((item) => <div className="inventory-row" key={item.id}>
                <input aria-label="ชื่อสิ่งของ" maxLength={60} placeholder="เช่น Healing Potion" value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} />
                <input aria-label="จำนวน" type="number" min="1" max="999" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Math.max(1, Math.min(999, Number(event.target.value))) })} />
                <input aria-label="รายละเอียด" maxLength={200} placeholder="หมายเหตุ (ไม่บังคับ)" value={item.note} onChange={(event) => updateItem(item.id, { note: event.target.value })} />
                <button aria-label={`นำ ${item.name || "สิ่งของ"} ออก`} onClick={() => { setInventory((items) => items.filter((entry) => entry.id !== item.id)); setStatus("idle"); }}>×</button>
              </div>)}
            </div> : <div className="inventory-empty"><span>◇</span><p>กระเป๋ายังว่างเปล่า</p><button onClick={addItem}>เพิ่มสิ่งของชิ้นแรก</button></div>}
          </section>
          <WalletPanel characterId={character.id} initialBalance={wallet.balance} initialTransactions={wallet.transactions} />
          <StatusPanel characterId={character.id} templates={statuses.templates} initialEffects={statuses.effects} />
          <div className={`sheet-save-note ${status}`}>{message || "การเปลี่ยนแปลงจะยังไม่ถูกส่งจนกดบันทึก"}</div>
        </div>
      </section>
    </main>
  );
}
