"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import type { DmNarration } from "../../lib/dm/types";

type Member = { display_name: string; role: string };

function buildPrompt(
  members: Member[],
  rollSummary: string[],
  turnSummary: string,
  chatSummary: string[],
  npcSummary: string[],
) {
  return [
    "คุณคือ Dungeon Master ของเกม D&D ภาษาไทย เขียนฉากต่อไปให้กระชับ สนุก และเสนอทางเลือก 3 ทาง",
    `สมาชิก: ${members.map((member) => `${member.display_name} (${member.role})`).join(", ")}`,
    `Initiative: ${turnSummary || "ยังไม่เริ่ม"}`,
    `ผลเต๋าล่าสุด:\n${rollSummary.join("\n") || "ไม่มี"}`,
    `แชตล่าสุด:\n${chatSummary.join("\n") || "ไม่มี"}`,
    `บท NPC ล่าสุด:\n${npcSummary.join("\n") || "ไม่มี"}`,
    "ตอบเฉพาะคำบรรยายฉากและตัวเลือก ห้ามตัดสินใจแทนผู้เล่น",
  ].join("\n\n");
}

export function ManualDmConsole({
  tableId,
  isDm,
  members,
  rollSummary,
  turnSummary,
  chatSummary,
  npcSummary,
  initialNarrations,
}: {
  tableId: string;
  isDm: boolean;
  members: Member[];
  rollSummary: string[];
  turnSummary: string;
  chatSummary: string[];
  npcSummary: string[];
  initialNarrations: DmNarration[];
}) {
  const fallbackPrompt = useMemo(
    () =>
      buildPrompt(
        members,
        rollSummary,
        turnSummary,
        chatSummary,
        npcSummary,
      ),
    [members, rollSummary, turnSummary, chatSummary, npcSummary],
  );
  const [prompt, setPrompt] = useState(fallbackPrompt);
  const [narrations, setNarrations] = useState(initialNarrations);
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setPrompt(fallbackPrompt), [fallbackPrompt]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`dm-${tableId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_narrations",
          filter: `table_id=eq.${tableId}`,
        },
        (payload) => {
          const incoming = payload.new as DmNarration;
          setNarrations((current) =>
            current.some((item) => item.id === incoming.id)
              ? current
              : [...current.slice(-9), incoming],
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tableId]);

  async function refreshPrompt(copyAfterRefresh = false) {
    setBusy(true);
    setMessage("");
    try {
      const request = await fetch(
        `/api/dm/manual?tableId=${encodeURIComponent(tableId)}`,
      );
      const result = await request.json();
      if (!request.ok) throw new Error("อัปเดต Context ไม่สำเร็จ");
      setPrompt(result.prompt);
      if (copyAfterRefresh) {
        await navigator.clipboard.writeText(result.prompt);
        setMessage("อัปเดตและคัดลอก prompt แล้ว — นำไปวางใน AI ที่ต้องการ");
      } else {
        setMessage("อัปเดต Context ล่าสุดแล้ว");
      }
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "อัปเดต Context ไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setMessage("");
    try {
      const request = await fetch("/api/dm/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId, narration: response }),
      });
      const result = await request.json();
      if (!request.ok) {
        throw new Error(
          result.error === "dm_required"
            ? "เฉพาะ DM เท่านั้น"
            : "เผยแพร่ไม่สำเร็จ",
        );
      }
      const incoming = result.narration as DmNarration;
      setNarrations((current) =>
        current.some((item) => item.id === incoming.id)
          ? current
          : [...current.slice(-9), incoming],
      );
      setResponse("");
      setMessage("เผยแพร่คำบรรยายให้ปาร์ตี้แล้ว");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "เผยแพร่ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const latest = narrations.at(-1);

  return (
    <section className="dm-console">
      <header>
        <div>
          <small>AI DM · MANUAL MODE</small>
          <h2>ห้องควบคุมเนื้อเรื่อง</h2>
        </div>
        <span>ไม่ใช้ API · ไม่มีค่าใช้จ่าย</span>
      </header>
      {latest && (
        <blockquote>
          <b>{latest.dm_name} · DM</b>
          <p>{latest.narration}</p>
          <small>{new Date(latest.created_at).toLocaleString("th-TH")}</small>
        </blockquote>
      )}
      {isDm ? (
        <div className="dm-workbench">
          <label>
            <span>1 · คัดลอก Context Prompt</span>
            <textarea readOnly value={prompt} />
            <button onClick={() => refreshPrompt(true)} disabled={busy}>
              {busy ? "กำลังอัปเดต…" : "อัปเดตล่าสุด + คัดลอก"}
            </button>
          </label>
          <label>
            <span>2 · วางคำตอบจาก AI</span>
            <textarea
              maxLength={5000}
              placeholder="วางคำบรรยายจาก AI ที่นี่…"
              value={response}
              onChange={(event) => setResponse(event.target.value)}
            />
            <button onClick={publish} disabled={busy || !response.trim()}>
              {busy ? "กำลังเผยแพร่…" : "เผยแพร่ให้ปาร์ตี้"}
            </button>
          </label>
        </div>
      ) : (
        !latest && <div className="dm-waiting">กำลังรอ DM เผยแพร่ฉากถัดไป</div>
      )}
      {message && <p className="dm-message">{message}</p>}
    </section>
  );
}
