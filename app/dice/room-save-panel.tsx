"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RoomSave } from "../../lib/room-saves/types";

export function RoomSavePanel({ tableId, isDm, initialSaves }: { tableId: string; isDm: boolean; initialSaves: RoomSave[] }) {
  const router = useRouter();
  const [saves, setSaves] = useState(initialSaves);
  const [names, setNames] = useState<Record<number, string>>(() => Object.fromEntries(initialSaves.map((save) => [save.slot, save.save_name])));
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  async function action(actionName: "save" | "load", slot: number) {
    setBusySlot(slot); setMessage("");
    try {
      const response = await fetch("/api/room-saves", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName, tableId, slot, name: names[slot] || `การผจญภัยช่อง ${slot}` }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === "dm_required" ? "เฉพาะ DM เท่านั้นที่จัดการเซฟได้" : "ดำเนินการกับเซฟไม่สำเร็จ");
      if (actionName === "save") setSaves((current) => [...current.filter((save) => save.slot !== slot), result.save].sort((a, b) => a.slot - b.slot));
      setMessage(actionName === "save" ? `บันทึกช่อง ${slot} แล้ว` : `โหลดช่อง ${slot} แล้ว`);
      router.refresh();
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "ดำเนินการกับเซฟไม่สำเร็จ"); }
    finally { setBusySlot(null); }
  }

  return <section className="room-saves"><header><div><small>CAMPAIGN MEMORY</small><h2>บันทึกห้อง</h2></div><span>{isDm ? "DM CONTROL" : "VIEW ONLY"}</span></header><div className="save-slots">{[1,2,3].map((slot) => { const save = saves.find((item) => item.slot === slot); return <article key={slot}><b>{slot.toString().padStart(2,"0")}</b><div><input aria-label={`ชื่อเซฟช่อง ${slot}`} maxLength={60} disabled={!isDm} value={names[slot] ?? save?.save_name ?? ""} placeholder={`ช่องบันทึก ${slot}`} onChange={(event) => setNames((current) => ({ ...current, [slot]: event.target.value }))} />{save ? <small>รอบ {save.round_number} · {save.entry_count} ตัว · {new Date(save.updated_at).toLocaleString("th-TH")}</small> : <small>ช่องว่าง</small>}</div>{isDm && <span><button onClick={() => action("save", slot)} disabled={busySlot !== null}>{busySlot === slot ? "…" : "เซฟ"}</button><button onClick={() => action("load", slot)} disabled={busySlot !== null || !save}>โหลด</button></span>}</article>; })}</div>{message && <p>{message}</p>}</section>;
}
