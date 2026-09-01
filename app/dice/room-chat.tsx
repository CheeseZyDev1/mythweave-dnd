"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import type { RoomMessage } from "../../lib/chat/types";

export function RoomChat({ tableId, currentUserId, initialMessages }: { tableId: string; currentUserId: string; initialMessages: RoomMessage[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`room-chat-${tableId}`).on("postgres_changes", {
      event: "INSERT", schema: "public", table: "room_messages", filter: `table_id=eq.${tableId}`,
    }, (payload) => {
      const incoming = payload.new as RoomMessage;
      setMessages((current) => current.some((message) => message.id === incoming.id) ? current : [...current.slice(-99), incoming]);
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [tableId]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tableId, content }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === "rate_limited" ? "ส่งเร็วเกินไป กรุณารอสักครู่" : "ส่งข้อความไม่สำเร็จ");
      const incoming = result.message as RoomMessage;
      setMessages((current) => current.some((message) => message.id === incoming.id) ? current : [...current.slice(-99), incoming]);
      setContent("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ส่งข้อความไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  return <section className="room-chat"><header><div><small>PARTY CHANNEL · LIVE</small><h2>แชตในห้อง</h2></div><span>{messages.length} ข้อความ</span></header><div className="room-chat-list" ref={listRef}>{messages.length ? messages.map((message) => <article className={message.user_id === currentUserId ? "mine" : ""} key={message.id}><div><strong>{message.sender_name}</strong><i>{message.sender_role.toUpperCase()}</i><time>{new Date(message.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</time></div><p>{message.content}</p></article>) : <div className="room-chat-empty">ส่งข้อความแรกเพื่อเรียกปาร์ตี้มารวมตัว</div>}</div><form onSubmit={send}><input aria-label="ข้อความในห้อง" maxLength={500} placeholder="พิมพ์ข้อความถึงปาร์ตี้…" value={content} onChange={(event) => setContent(event.target.value)} /><button disabled={busy || !content.trim()}>{busy ? "…" : "ส่ง"}</button></form>{error && <p className="dice-error">{error}</p>}</section>;
}
