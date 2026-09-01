"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import type { InitiativeEntry, InitiativeTracker } from "../../lib/initiative/types";

export function InitiativePanel({ tableId, initialEntries, initialTracker }: { tableId: string; initialEntries: InitiativeEntry[]; initialTracker: InitiativeTracker | null }) {
  const [entries, setEntries] = useState(initialEntries);
  const [tracker, setTracker] = useState(initialTracker);
  const [name, setName] = useState("");
  const [initiative, setInitiative] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ordered = useMemo(() => [...entries].sort((a, b) => b.initiative - a.initiative || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)), [entries]);
  const activeEntry = ordered.find((entry) => entry.id === tracker?.current_entry_id);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`initiative-${tableId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "initiative_entries", filter: `table_id=eq.${tableId}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          const removed = payload.old as { id?: string };
          if (removed.id) setEntries((current) => current.filter((entry) => entry.id !== removed.id));
          return;
        }
        const incoming = payload.new as InitiativeEntry;
        setEntries((current) => [...current.filter((entry) => entry.id !== incoming.id), incoming]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "initiative_trackers", filter: `table_id=eq.${tableId}` }, (payload) => {
        if (payload.eventType !== "DELETE") setTracker(payload.new as InitiativeTracker);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [tableId]);

  async function action(actionName: "add" | "remove" | "next" | "reset", extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/initiative", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName, tableId, ...extra }) });
      const result = await response.json();
      if (!response.ok) throw new Error("อัปเดต Initiative ไม่สำเร็จ");
      if (result.entry) {
        setEntries((current) => [...current.filter((entry) => entry.id !== result.entry.id), result.entry]);
        setName("");
      }
      if (result.removed) setEntries((current) => current.filter((entry) => entry.id !== result.removed));
      if (result.tracker) setTracker(result.tracker);
      if (result.reset) { setEntries([]); setTracker(null); }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "อัปเดต Initiative ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return <section className="initiative-panel"><header><div><small>TURN ORDER · REALTIME</small><h2>Initiative Tracker</h2></div><span>{tracker?.active ? `รอบ ${tracker.round_number}` : "ยังไม่เริ่มต่อสู้"}</span></header><div className="initiative-current"><small>ถึงตาของ</small><strong>{activeEntry?.name ?? "—"}</strong><button onClick={() => action("next")} disabled={busy || ordered.length === 0}>{tracker?.active ? "จบเทิร์น · คนถัดไป →" : "เริ่มการต่อสู้"}</button></div><div className="initiative-add"><input maxLength={40} placeholder="ชื่อตัวละครหรือศัตรู" value={name} onChange={(event) => setName(event.target.value)} /><input aria-label="ค่า Initiative" type="number" min="-10" max="99" value={initiative} onChange={(event) => setInitiative(Math.max(-10, Math.min(99, Number(event.target.value))))} /><button onClick={() => action("add", { name, initiative })} disabled={busy || !name.trim()}>+ เพิ่ม</button></div>{error && <p className="dice-error">{error}</p>}<div className="initiative-list">{ordered.map((entry, index) => <article className={entry.id === tracker?.current_entry_id ? "active" : ""} key={entry.id}><i>{index + 1}</i><span><strong>{entry.name}</strong><small>{entry.id === tracker?.current_entry_id ? "กำลังเล่นเทิร์นนี้" : "รอเทิร์น"}</small></span><b>{entry.initiative}</b><button aria-label={`นำ ${entry.name} ออกจากลำดับ`} onClick={() => action("remove", { entryId: entry.id })} disabled={busy}>×</button></article>)}</div>{ordered.length > 0 && <button className="initiative-reset" onClick={() => action("reset")} disabled={busy}>ล้างลำดับทั้งหมด</button>}</section>;
}

