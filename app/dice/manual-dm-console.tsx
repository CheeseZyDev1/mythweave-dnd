"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import type { DmNarration } from "../../lib/dm/types";

type Member = { display_name: string; role: string };
type DmMode="human"|"subscription"|"api";const KEY_STORAGE="mythweave:openai-api-key";const MODEL_STORAGE="mythweave:openai-model";

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
  mode,
  members,
  rollSummary,
  turnSummary,
  chatSummary,
  npcSummary,
  initialNarrations,
}: {
  tableId: string;
  isDm: boolean;
  mode:DmMode;
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
  const[apiKey,setApiKey]=useState("");const[model,setModel]=useState("gpt-5.6-luna");

  useEffect(() => setPrompt(fallbackPrompt), [fallbackPrompt]);
  useEffect(()=>{if(mode!=="api")return;setApiKey(sessionStorage.getItem(KEY_STORAGE)??"");setModel(sessionStorage.getItem(MODEL_STORAGE)??"gpt-5.6-luna")},[mode]);

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

  async function callAi(action:"test"|"generate"){
    setBusy(true);setMessage("");try{if(apiKey.trim().length<20)throw new Error("กรุณาใส่ API key");sessionStorage.setItem(KEY_STORAGE,apiKey.trim());sessionStorage.setItem(MODEL_STORAGE,model);let latestPrompt=prompt;if(action==="generate"){const contextResponse=await fetch(`/api/dm/manual?tableId=${encodeURIComponent(tableId)}`);const context=await contextResponse.json();if(!contextResponse.ok)throw new Error("โหลดสถานการณ์ล่าสุดไม่สำเร็จ");latestPrompt=context.prompt;setPrompt(context.prompt)}const request=await fetch("/api/dm/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,tableId,apiKey:apiKey.trim(),model,prompt:latestPrompt})});const result=await request.json();if(!request.ok){const messages:Record<string,string>={invalid_api_key:"API key ไม่ถูกต้อง",rate_limited:"เครดิตหมดหรือเรียกใช้ถี่เกินไป",timeout:"AI ตอบช้าเกินไป",provider_error:"โมเดลนี้อาจยังใช้ไม่ได้ในบัญชี API",provider_unavailable:"เชื่อมต่อ OpenAI ไม่ได้"};throw new Error(messages[result.error]??"AI DM ทำงานไม่สำเร็จ")}if(action==="test")setMessage(`เชื่อมต่อสำเร็จ · ${result.model}`);else{const incoming=result.narration as DmNarration;setNarrations(current=>current.some(item=>item.id===incoming.id)?current:[...current.slice(-9),incoming]);setMessage("AI สร้างฉากและเผยแพร่ให้ทุกคนแล้ว")}}catch(caught){setMessage(caught instanceof Error?caught.message:"AI DM ทำงานไม่สำเร็จ")}finally{setBusy(false)}}

  const latest = narrations.at(-1);

  return (
    <section className="dm-console">
      <header>
        <div>
          <small>{mode==="human"?"HUMAN DM":mode==="subscription"?"AI DM · SUB MODE":"AI DM · API MODE"}</small>
          <h2>ห้องควบคุมเนื้อเรื่อง</h2>
        </div>
        <span>{mode==="human"?"หัวปาร์ตี้ควบคุม":mode==="subscription"?"คัดลอก–วาง · ไม่ใช้ API":"เชื่อมอัตโนมัติ · API คิดค่าบริการ"}</span>
      </header>
      {latest && (
        <blockquote>
          <b>{latest.dm_name} · DM</b>
          <p>{latest.narration}</p>
          <small>{new Date(latest.created_at).toLocaleString("th-TH")}</small>
        </blockquote>
      )}
      {isDm&&mode==="subscription"&&(
        <div className="dm-workbench">
          <label>
            <span>1 · คัดลอก Context Prompt</span>
            <textarea readOnly value={prompt} />
            <button onClick={() => refreshPrompt(true)} disabled={busy}>
              {busy ? "กำลังอัปเดต…" : "อัปเดตล่าสุด + คัดลอก"}
            </button>
            <a className="dm-chatgpt-link"href="https://chatgpt.com/"target="_blank"rel="noreferrer">เปิด ChatGPT แล้ววาง Prompt →</a>
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
      )}
      {isDm&&mode==="human"&&<div className="human-dm-workbench"><label><span>คำบรรยายจาก DM</span><textarea maxLength={5000}placeholder="เล่าฉาก เหตุการณ์ หรือคำพูดของ NPC…"value={response}onChange={event=>setResponse(event.target.value)}/></label><button onClick={publish}disabled={busy||!response.trim()}>{busy?"กำลังเผยแพร่…":"เผยแพร่ฉากให้ปาร์ตี้"}</button></div>}
      {isDm&&mode==="api"&&<div className="api-dm-workbench"><p>ใส่คีย์ครั้งเดียวใน session นี้ จากนั้น AI จะอ่าน Context ล่าสุดและเผยแพร่ฉากให้ทุกคนในห้องโดยอัตโนมัติ</p><div><label><span>OpenAI API key</span><input type="password"autoComplete="off"value={apiKey}onChange={event=>setApiKey(event.target.value)}placeholder="API key"/></label><label><span>โมเดล</span><select value={model}onChange={event=>setModel(event.target.value)}><option value="gpt-5.6-luna">GPT-5.6 Luna · ประหยัด</option><option value="gpt-5.6-terra">GPT-5.6 Terra · สมดุล</option><option value="gpt-5-mini">GPT-5 Mini · รองรับกว้าง</option></select></label></div><small>คีย์เก็บใน sessionStorage ของเบราว์เซอร์ ไม่บันทึกใน Supabase และล้างเมื่อจบ session</small><footer><button onClick={()=>callAi("test")}disabled={busy}>ทดสอบการเชื่อมต่อ</button><button className="primary"onClick={()=>callAi("generate")}disabled={busy}>{busy?"AI กำลังเขียนฉาก…":"ให้ AI สร้างฉากถัดไป →"}</button></footer></div>}
      {!isDm&&!latest&&<div className="dm-waiting">กำลังรอ {mode==="human"?"DM": "AI DM"} เผยแพร่ฉากถัดไป</div>}
      {message && <p className="dm-message">{message}</p>}
    </section>
  );
}
