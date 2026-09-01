"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { DICE_SIDES, type DiceRoll } from "../../lib/dice/types";
import type {
  InitiativeEntry,
  InitiativeTracker,
} from "../../lib/initiative/types";
import { InitiativePanel } from "./initiative-panel";
import type { RoomMessage } from "../../lib/chat/types";
import { RoomChat } from "./room-chat";
import type { RoomSave } from "../../lib/room-saves/types";
import { RoomSavePanel } from "./room-save-panel";
import type { NpcDialogue } from "../../lib/npc/types";
import { NpcDialoguePanel } from "./npc-dialogue";
import type { DmNarration } from "../../lib/dm/types";
import { ManualDmConsole } from "./manual-dm-console";
import type { GeneratedMonster } from "../../lib/monsters/types";
import {HomunculusRoomPanel,type RoomHomunculus,type RoomHomunculusCommand}from"./homunculus-room-panel";
import { MonsterForge } from "./monster-forge";

type TableInfo = { id: string; code: string };
type Member = { user_id: string; display_name: string; role: string };

const tableErrors: Record<string, string> = {
  invalid_code: "รูปแบบรหัสไม่ถูกต้อง",
  table_not_found: "ไม่พบโต๊ะเต๋ารหัสนี้",
  create_failed: "สร้างโต๊ะไม่สำเร็จ",
};

function formatCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-F0-9]/g, "")
    .slice(0, 12)
    .replace(/(.{4})(?=.)/g, "$1-");
}

function rollLabel(roll: DiceRoll) {
  const modifier =
    roll.modifier === 0
      ? ""
      : roll.modifier > 0
        ? ` + ${roll.modifier}`
        : ` − ${Math.abs(roll.modifier)}`;
  return `${roll.dice_count}d${roll.dice_sides}${modifier}`;
}

export function DiceTable({
  initialTable,
  initialRolls,
  members,
  currentUserId,
  invalidTable,
  initialInitiativeEntries,
  initialInitiativeTracker,
  initialMessages,
  initialSaves,
  initialNpcHistory,
  initialNarrations,
  initialMonsters,
  initialCompanions,initialCompanionCommands,
}: {
  initialTable: TableInfo | null;
  initialRolls: DiceRoll[];
  members: Member[];
  currentUserId: string;
  invalidTable: boolean;
  initialInitiativeEntries: InitiativeEntry[];
  initialInitiativeTracker: InitiativeTracker | null;
  initialMessages: RoomMessage[];
  initialSaves: RoomSave[];
  initialNpcHistory: NpcDialogue[];
  initialNarrations: DmNarration[];
  initialMonsters: GeneratedMonster[];
  initialCompanions:RoomHomunculus[];initialCompanionCommands:RoomHomunculusCommand[];
}) {
  const router = useRouter();
  const [table] = useState(initialTable);
  const [rolls, setRolls] = useState(initialRolls);
  const [code, setCode] = useState("");
  const [joinRole, setJoinRole] = useState("player");
  const [diceCount, setDiceCount] = useState(1);
  const [diceSides, setDiceSides] = useState(20);
  const [modifier, setModifier] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    invalidTable ? "คุณยังไม่ได้เข้าร่วมโต๊ะนี้ หรือโต๊ะไม่มีอยู่" : "",
  );
  const [animatedRoll, setAnimatedRoll] = useState<DiceRoll | null>(
    initialRolls.at(-1) ?? null,
  );
  const [rolling, setRolling] = useState(false);
  const latest = rolls.at(-1) ?? null;
  const ownMember = members.find((member) => member.user_id === currentUserId);

  useEffect(() => {
    if (!table) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`dice-table-${table.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dice_rolls",
          filter: `table_id=eq.${table.id}`,
        },
        (payload) => {
          const incoming = payload.new as DiceRoll;
          setRolls((current) =>
            current.some((roll) => roll.id === incoming.id)
              ? current
              : [...current.slice(-49), incoming],
          );
          setAnimatedRoll(incoming);
          setRolling(true);
          window.setTimeout(() => setRolling(false), 720);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table]);

  const average = useMemo(
    () =>
      rolls.length
        ? Math.round(
            (rolls.reduce((sum, roll) => sum + roll.total, 0) / rolls.length) *
              10,
          ) / 10
        : 0,
    [rolls],
  );

  async function tableAction(action: "create" | "join") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/dice/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, code, role: joinRole }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(tableErrors[result.error] ?? "เชื่อมต่อโต๊ะไม่สำเร็จ");
      router.push(`/dice?table=${result.tableId}`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "เชื่อมต่อโต๊ะไม่สำเร็จ",
      );
      setBusy(false);
    }
  }

  async function rollDice() {
    if (!table) return;
    setBusy(true);
    setError("");
    setRolling(true);
    try {
      const response = await fetch("/api/dice/roll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: table.id,
          diceCount,
          diceSides,
          modifier,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error === "not_a_member"
            ? "คุณไม่ได้เป็นสมาชิกโต๊ะนี้"
            : "ทอยเต๋าไม่สำเร็จ",
        );
      const incoming = result.roll as DiceRoll;
      setRolls((current) =>
        current.some((roll) => roll.id === incoming.id)
          ? current
          : [...current.slice(-49), incoming],
      );
      setAnimatedRoll(incoming);
      window.setTimeout(() => setRolling(false), 720);
    } catch (caught) {
      setRolling(false);
      setError(caught instanceof Error ? caught.message : "ทอยเต๋าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!table) return;
    await navigator.clipboard.writeText(table.code);
  }

  if (!table)
    return (
      <main className="dice-shell">
        <header className="dice-topbar">
          <Link href="/lobby">← กลับล็อบบี้</Link>
          <span>MYTHWEAVE · REALTIME DICE</span>
          <i>PHASE 1</i>
        </header>
        <section className="dice-gateway">
          <small>THE SHARED TABLE</small>
          <h1>
            ทอยชะตา
            <br />
            พร้อมกัน
          </h1>
          <p>
            สร้างห้องใหม่ในฐานะ DM แล้วส่งรหัสให้เพื่อน
            หรือกรอกรหัสและเลือกบทบาท ทุกผลทอยจะปรากฏพร้อมกันแบบ real-time
          </p>
          <div className="dice-gateway-actions">
            <button onClick={() => tableAction("create")} disabled={busy}>
              {busy ? "กำลังเปิดห้อง…" : "สร้างห้องใหม่ · เป็น DM"}
            </button>
            <span>หรือเข้าร่วมด้วยรหัส</span>
            <div className="dice-role-picker">
              {[
                ["player", "Player"],
                ["dm", "DM"],
                ["spectator", "Spectator"],
              ].map(([value, label]) => (
                <button
                  className={joinRole === value ? "selected" : ""}
                  onClick={() => setJoinRole(value)}
                  key={value}
                >
                  {label}
                </button>
              ))}
            </div>
            <div>
              <input
                aria-label="รหัสห้อง"
                placeholder="AB12-CD34-EF56"
                value={code}
                onChange={(event) => setCode(formatCode(event.target.value))}
                maxLength={14}
              />
              <button
                onClick={() => tableAction("join")}
                disabled={busy || code.length !== 14}
              >
                เข้าร่วม
              </button>
            </div>
          </div>
          {error && <p className="dice-error">{error}</p>}
          <footer>
            <b>PRIVATE ROOM</b>
            <span>เฉพาะผู้ที่มีรหัสและล็อกอินแล้วจึงเข้าถึงข้อมูลได้</span>
          </footer>
        </section>
      </main>
    );

  return (
    <main className="dice-shell">
      <header className="dice-topbar">
        <Link href="/lobby">← กลับล็อบบี้</Link>
        <span>MYTHWEAVE · REALTIME DICE</span>
        <button onClick={copyCode}>คัดลอกรหัส {table.code}</button>
      </header>
      <section className="dice-layout">
        <aside className="dice-controls">
          <small>ROLL CONFIGURATION</small>
          <h1>ลูกเต๋าแห่งชะตา</h1>
          <p>ผู้ทอย: {ownMember?.display_name ?? "Adventurer"}</p>
          <label>
            <span>จำนวนลูก</span>
            <select
              value={diceCount}
              onChange={(event) => setDiceCount(Number(event.target.value))}
            >
              {Array.from({ length: 10 }, (_, index) => index + 1).map(
                (count) => (
                  <option value={count} key={count}>
                    {count} ลูก
                  </option>
                ),
              )}
            </select>
          </label>
          <div className="dice-types">
            {DICE_SIDES.map((sides) => (
              <button
                className={diceSides === sides ? "selected" : ""}
                onClick={() => setDiceSides(sides)}
                key={sides}
              >
                d{sides}
              </button>
            ))}
          </div>
          <label>
            <span>Modifier</span>
            <input
              type="number"
              min="-100"
              max="100"
              value={modifier}
              onChange={(event) =>
                setModifier(
                  Math.max(-100, Math.min(100, Number(event.target.value))),
                )
              }
            />
          </label>
          <button
            className="dice-roll-button"
            onClick={rollDice}
            disabled={busy}
          >
            {busy ? "กำลังทอย…" : `ทอย ${diceCount}d${diceSides}`}
          </button>
          {error && <p className="dice-error">{error}</p>}
          <div className="dice-members">
            <span>ผู้เล่นในโต๊ะ</span>
            {members.map((member) => (
              <i key={member.user_id}>
                <b>{member.display_name.slice(0, 1).toUpperCase()}</b>
                {member.display_name}
              </i>
            ))}
          </div>
        </aside>
        <div className="dice-board">
          <section className="dice-stage">
            <div className={`animated-die ${rolling ? "rolling" : ""}`}>
              <span>{animatedRoll?.total ?? "?"}</span>
            </div>
            <small>
              {animatedRoll ? rollLabel(animatedRoll) : "เลือกเต๋าแล้วเริ่มทอย"}
            </small>
            <h2>
              {animatedRoll
                ? `${animatedRoll.roller_name} ทอยได้ ${animatedRoll.total}`
                : "ชะตายังไม่ถูกเปิดเผย"}
            </h2>
            {animatedRoll && (
              <p>
                ผลแต่ละลูก: {animatedRoll.rolls.join(" · ")}
                {animatedRoll.modifier
                  ? ` · modifier ${animatedRoll.modifier > 0 ? "+" : ""}${animatedRoll.modifier}`
                  : ""}
              </p>
            )}
          </section>
          <InitiativePanel
            tableId={table.id}
            initialEntries={initialInitiativeEntries}
            initialTracker={initialInitiativeTracker}
          />
          <section className="dice-history">
            <header>
              <div>
                <small>LIVE HISTORY</small>
                <h2>ประวัติการทอย</h2>
              </div>
              <span>
                {rolls.length} ครั้ง · เฉลี่ย {average}
              </span>
            </header>
            {rolls.length ? (
              <div>
                {[...rolls].reverse().map((roll) => (
                  <article
                    className={roll.id === latest?.id ? "latest" : ""}
                    key={roll.id}
                  >
                    <b>{roll.total}</b>
                    <span>
                      <strong>{roll.roller_name}</strong>
                      <small>
                        {rollLabel(roll)} · {roll.rolls.join(", ")}
                      </small>
                    </span>
                    <time>
                      {new Date(roll.created_at).toLocaleTimeString("th-TH", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </time>
                  </article>
                ))}
              </div>
            ) : (
              <p className="dice-empty">ยังไม่มีผลการทอยในโต๊ะนี้</p>
            )}
          </section>
          <RoomChat
            tableId={table.id}
            currentUserId={currentUserId}
            initialMessages={initialMessages}
          />
          <HomunculusRoomPanel tableId={table.id} initialCompanions={initialCompanions} initialCommands={initialCompanionCommands}/>
          <RoomSavePanel
            tableId={table.id}
            isDm={ownMember?.role === "dm"}
            initialSaves={initialSaves}
          />
          <NpcDialoguePanel
            tableId={table.id}
            initialHistory={initialNpcHistory}
          />
          <MonsterForge
            tableId={table.id}
            isDm={ownMember?.role === "dm"}
            initialMonsters={initialMonsters}
          />
          <ManualDmConsole
            tableId={table.id}
            isDm={ownMember?.role === "dm"}
            members={members}
            rollSummary={rolls
              .slice(-5)
              .map(
                (roll) =>
                  `${roll.roller_name}: ${roll.dice_count}d${roll.dice_sides} = ${roll.total}`,
              )}
            turnSummary={
              initialInitiativeEntries.find(
                (entry) =>
                  entry.id === initialInitiativeTracker?.current_entry_id,
              )?.name ?? ""
            }
            chatSummary={initialMessages
              .slice(-5)
              .map((item) => `${item.sender_name}: ${item.content}`)}
            npcSummary={initialNpcHistory
              .slice(-3)
              .map((item) => `${item.npc_name}: ${item.text_th}`)}
            initialNarrations={initialNarrations}
          />
        </div>
      </section>
    </main>
  );
}
