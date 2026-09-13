"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CharacterOption = {
  id: string;
  name: string;
  dimension_id: string;
};

const roomErrors: Record<string, string> = {
  character_unavailable: "ตัวละครนี้ยังไม่พร้อมเข้าห้อง",
  dimension_mismatch: "ตัวละครนี้อยู่คนละมิติกับห้อง",
  not_a_member: "บัญชีนี้ไม่ได้เป็นสมาชิกห้อง",
  character_not_found: "ไม่พบตัวละครในบัญชีนี้",
};

export function NewRoomCharacterPicker({
  characters,
}: {
  characters: CharacterOption[];
}) {
  const [characterId, setCharacterId] = useState(characters[0]?.id ?? "");
  const suffix = characterId
    ? `&character=${encodeURIComponent(characterId)}`
    : "";

  return (
    <div className="lobby-room-picker">
      <label>
        <span>ตัวละครที่จะเข้าร่วม</span>
        <select
          value={characterId}
          onChange={(event) => setCharacterId(event.target.value)}
        >
          {characters.map((character) => (
            <option value={character.id} key={character.id}>
              {character.name}
            </option>
          ))}
        </select>
      </label>
      <nav>
        <Link className="create" href={`/dice?action=create${suffix}`}>
          <b>＋</b>
          <span>
            <strong>สร้างห้อง</strong>
            <small>เป็นหัวปาร์ตี้และรับรหัสเชิญ</small>
          </span>
        </Link>
        <Link href={`/dice?action=join${suffix}`}>
          <b>→</b>
          <span>
            <strong>จอยห้อง</strong>
            <small>เข้าด้วยรหัสจากเพื่อน</small>
          </span>
        </Link>
      </nav>
    </div>
  );
}

export function ExistingRoomCharacterPicker({
  tableId,
  characters,
  initialCharacterId,
}: {
  tableId: string;
  characters: CharacterOption[];
  initialCharacterId: string | null;
}) {
  const router = useRouter();
  const initialCompatible = characters.some(
    (character) => character.id === initialCharacterId,
  );
  const [characterId, setCharacterId] = useState(
    initialCompatible ? (initialCharacterId ?? "") : (characters[0]?.id ?? ""),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function enterRoom() {
    if (!characterId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/dice/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "select_character",
          tableId,
          characterId,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(roomErrors[result.error] ?? "เลือกตัวละครไม่สำเร็จ");
      }
      router.push(`/dice?table=${tableId}`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "เลือกตัวละครไม่สำเร็จ",
      );
      setBusy(false);
    }
  }

  if (!characters.length) {
    return (
      <p className="room-character-warning">
        ไม่มีตัวละครในมิติเดียวกับห้องนี้
      </p>
    );
  }

  return (
    <div className="room-character-entry">
      <label>
        <span>เข้าห้องด้วย</span>
        <select
          value={characterId}
          onChange={(event) => setCharacterId(event.target.value)}
        >
          {characters.map((character) => (
            <option value={character.id} key={character.id}>
              {character.name}
            </option>
          ))}
        </select>
      </label>
      <button onClick={enterRoom} disabled={busy || !characterId}>
        {busy ? "กำลังเข้าห้อง…" : "กลับเข้าห้อง →"}
      </button>
      {error && <small>{error}</small>}
    </div>
  );
}
