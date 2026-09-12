"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { SessionRecapPanel } from "./session-recap-panel";
import { RoomUndoPanel } from "./room-undo-panel";
import type { NpcDialogue } from "../../lib/npc/types";
import { NpcDialoguePanel } from "./npc-dialogue";
import type { DmNarration } from "../../lib/dm/types";
import { ManualDmConsole } from "./manual-dm-console";
import type { GeneratedMonster } from "../../lib/monsters/types";
import {
  HomunculusRoomPanel,
  type RoomHomunculus,
  type RoomHomunculusCommand,
} from "./homunculus-room-panel";
import { MonsterForge } from "./monster-forge";
import {
  PartyAwareness,
  type AwarenessMember,
  type MessengerDispatch,
} from "./party-awareness";
import { WorldBossPanel } from "./world-boss-panel";
import type {
  WorldBoss,
  WorldBossContribution,
} from "../../lib/combat/world-boss";
import { SkillPanel } from "./skill-panel";
import type { CharacterSkill, SkillUse } from "../../lib/skills/types";
import { BattleStage, type Fighter } from "./battle-stage";
import { RoomGateway } from "./room-gateway";
import { CombatDmPanel } from "./combat-dm-panel";
import type { CombatDmMoment } from "../../lib/combat/dm-moments";
import { getRollTier, ROLL_FEEDBACK } from "../../lib/dice/feedback";

type TableInfo = {
  id: string;
  code: string;
  dm_mode: "human" | "subscription" | "api";
};
type Member = Fighter;

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
  initialCompanions,
  initialCompanionCommands,
  ghostMode,
  characters,
  initialAwareness,
  initialMessengerBirds,
  initialMessengerDispatches,
  initialWorldBoss,
  initialWorldBossContributions,
  initialSkills,
  initialSkillUses,
  hasSessionRecaps,
  initialCombatDmMoments,
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
  initialCompanions: RoomHomunculus[];
  initialCompanionCommands: RoomHomunculusCommand[];
  ghostMode: boolean;
  characters: { id: string; name: string }[];
  initialAwareness: AwarenessMember[];
  initialMessengerBirds: number;
  initialMessengerDispatches: MessengerDispatch[];
  initialWorldBoss: WorldBoss | null;
  initialWorldBossContributions: WorldBossContribution[];
  initialSkills: CharacterSkill[];
  initialSkillUses: SkillUse[];
  hasSessionRecaps: boolean;
  initialCombatDmMoments: CombatDmMoment[];
}) {
  const [table] = useState(initialTable);
  const [rolls, setRolls] = useState(initialRolls);
  const [diceCount, setDiceCount] = useState(1);
  const [diceSides, setDiceSides] = useState(20);
  const [modifier, setModifier] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [animatedRoll, setAnimatedRoll] = useState<DiceRoll | null>(
    initialRolls.at(-1) ?? null,
  );
  const [rolling, setRolling] = useState(false);
  const announcedRolls = useRef(new Set<string>());
  const rollTimer = useRef<number | undefined>(undefined);
  const latest = rolls.at(-1) ?? null;
  const ownMember = members.find((member) => member.user_id === currentUserId);
  const readOnly = ownMember?.role === "spectator";
  const isDm = ownMember?.role === "dm";
  const isActor = ownMember?.role === "dm" || ownMember?.role === "player";

  const announceRoll = useCallback((incoming: DiceRoll) => {
    if (announcedRolls.current.has(incoming.id)) return;
    announcedRolls.current.add(incoming.id);
    setAnimatedRoll(incoming);
    setRolling(true);
    window.dispatchEvent(
      new CustomEvent("mythweave:dice-sfx", {
        detail: { tier: getRollTier(incoming) },
      }),
    );
    window.clearTimeout(rollTimer.current);
    rollTimer.current = window.setTimeout(() => setRolling(false), 1050);
  }, []);

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
          announceRoll(incoming);
        },
      )
      .subscribe();
    return () => {
      window.clearTimeout(rollTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [announceRoll, table]);

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
      announceRoll(incoming);
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

  const animatedTier = animatedRoll ? getRollTier(animatedRoll) : "neutral";
  const animatedFeedback = ROLL_FEEDBACK[animatedTier];

  if (!table)
    return (
      <RoomGateway
        characters={characters}
        ghostMode={ghostMode}
        invalidTable={invalidTable}
      />
    );

  return (
    <main className="dice-shell">
      <header className="dice-topbar">
        <Link href="/lobby">← กลับล็อบบี้</Link>
        <span>
          MYTHWEAVE · REALTIME DICE ·{" "}
          <Link href={`/vtt?table=${table.id}`}>VTT MAP</Link> ·{" "}
          <Link href={`/dice/history?table=${table.id}`}>ROLL HISTORY</Link>
        </span>
        <button onClick={copyCode}>คัดลอกรหัส {table.code}</button>
      </header>
      <section className="dice-layout">
        <aside className="dice-controls">
          {readOnly && (
            <div className="ghost-mode-banner">
              {ghostMode ? "GHOST MODE" : "SPECTATOR"} · READ ONLY
            </div>
          )}
          <small>ROLL CONFIGURATION</small>
          <h1>ลูกเต๋าแห่งชะตา</h1>
          <p>ผู้ทอย: {ownMember?.display_name ?? "Adventurer"}</p>
          <label>
            <span>จำนวนลูก</span>
            <select
              disabled={readOnly}
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
                disabled={readOnly}
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
              disabled={readOnly}
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
            disabled={busy || readOnly}
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
          <BattleStage
            tableId={table.id}
            members={members}
            initialMonsters={initialMonsters}
            initialSkills={initialSkillUses}
            initialTurn={
              initialInitiativeEntries.find(
                (entry) =>
                  entry.id === initialInitiativeTracker?.current_entry_id,
              )?.name
            }
          />
          <CombatDmPanel
            tableId={table.id}
            isDm={isDm}
            initialMoments={initialCombatDmMoments}
          />
          <section className="dice-stage">
            <div
              className={`dice-cast ${animatedTier} ${rolling ? "rolling" : "settled"}`}
            >
              <i className="dice-trail" aria-hidden="true" />
              <div
                className="animated-die"
                data-sides={animatedRoll?.dice_sides ?? diceSides}
              >
                <span>{animatedRoll?.total ?? "?"}</span>
              </div>
              {animatedRoll && !rolling && (
                <strong
                  className="roll-emote"
                  aria-label={animatedFeedback.label}
                >
                  {animatedFeedback.emoji}
                </strong>
              )}
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
              <>
                <p className={`roll-verdict ${animatedTier}`}>
                  {animatedFeedback.emoji} {animatedFeedback.label} ·{" "}
                  {animatedFeedback.message}
                </p>
                <p>
                  ผลแต่ละลูก: {animatedRoll.rolls.join(" · ")}
                  {animatedRoll.modifier
                    ? ` · modifier ${animatedRoll.modifier > 0 ? "+" : ""}${animatedRoll.modifier}`
                    : ""}
                </p>
              </>
            )}
          </section>
          {(isDm || initialInitiativeEntries.length > 0) && (
            <InitiativePanel
              tableId={table.id}
              initialEntries={initialInitiativeEntries}
              initialTracker={initialInitiativeTracker}
              readOnly={!isDm}
            />
          )}
          {((isActor && ownMember?.character_id) ||
            initialSkillUses.length > 0) && (
            <SkillPanel
              tableId={table.id}
              characterId={isActor ? (ownMember?.character_id ?? null) : null}
              isDm={isDm}
              readOnly={!isActor}
              initialSkills={initialSkills}
              initialUses={initialSkillUses}
            />
          )}
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
                    className={`${roll.id === latest?.id ? "latest" : ""} tier-${getRollTier(roll)}`}
                    key={roll.id}
                  >
                    <b>
                      <i aria-hidden="true">
                        {ROLL_FEEDBACK[getRollTier(roll)].emoji}
                      </i>
                      {roll.total}
                    </b>
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
          {isActor && ownMember?.character_id && (
            <PartyAwareness
              tableId={table.id}
              viewerCharacterId={ownMember.character_id}
              initialMembers={initialAwareness}
              initialBirds={initialMessengerBirds}
              initialDispatches={initialMessengerDispatches}
              canSend
            />
          )}
          <RoomChat
            tableId={table.id}
            currentUserId={currentUserId}
            initialMessages={initialMessages}
            readOnly={readOnly}
          />
          {(initialCompanions.length > 0 ||
            initialCompanionCommands.length > 0) && (
            <HomunculusRoomPanel
              tableId={table.id}
              currentUserId={currentUserId}
              readOnly={readOnly}
              monsters={initialMonsters}
              initialCompanions={initialCompanions}
              initialCommands={initialCompanionCommands}
            />
          )}
          {initialWorldBoss && (
            <WorldBossPanel
              tableId={table.id}
              currentUserId={currentUserId}
              characterId={ownMember?.character_id ?? null}
              readOnly={readOnly}
              isDm={isDm}
              members={members}
              initialBoss={initialWorldBoss}
              initialContributions={initialWorldBossContributions}
            />
          )}
          {(isDm || initialSaves.length > 0) && (
            <RoomSavePanel
              tableId={table.id}
              isDm={isDm}
              initialSaves={initialSaves}
            />
          )}
          {(isDm || hasSessionRecaps) && (
            <SessionRecapPanel tableId={table.id} isDm={isDm} />
          )}
          {isDm && <RoomUndoPanel tableId={table.id} isDm />}
          {(isDm || initialNpcHistory.length > 0) && (
            <NpcDialoguePanel
              tableId={table.id}
              initialHistory={initialNpcHistory}
              readOnly={!isDm}
            />
          )}
          {(isDm || initialMonsters.length > 0) && (
            <MonsterForge
              tableId={table.id}
              isDm={isDm}
              initialMonsters={initialMonsters}
              currentUserId={currentUserId}
              characterId={ownMember?.character_id ?? null}
              canAttack={!readOnly}
            />
          )}
          {(isDm || initialNarrations.length > 0) && (
            <ManualDmConsole
              tableId={table.id}
              isDm={isDm}
              mode={table.dm_mode}
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
          )}
        </div>
      </section>
    </main>
  );
}
