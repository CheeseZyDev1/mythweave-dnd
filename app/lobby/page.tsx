import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import {
  DEFAULT_APPEARANCE,
  findClass,
  findRace,
  type Appearance,
} from "../../lib/characters/catalog";
import { CharacterAvatar } from "../characters/character-avatar";
import { LogoutButton } from "./logout-button";
import {
  ExistingRoomCharacterPicker,
  NewRoomCharacterPicker,
} from "./room-character-controls";

export const metadata: Metadata = { title: "ล็อบบี้ — Mythweave" };

export default async function LobbyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const isGuest = Boolean(user.is_anonymous);
  const displayName = String(
    user.user_metadata?.display_name ??
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split("@")[0] ??
      "Adventurer",
  );
  const [{ data: characters }, { data: ownMemberships }] = await Promise.all([
    supabase
      .from("characters")
      .select(
        "id,name,race,character_class,level,hp_current,hp_max,appearance,dimension_id",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("dice_table_members")
      .select("table_id,role,joined_at,character_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false })
      .limit(8),
  ]);
  const roomIds = (ownMemberships ?? []).map((item) => item.table_id);
  const [{ data: rooms }, { data: roomMembers }] = roomIds.length
    ? await Promise.all([
        supabase
          .from("dice_tables")
          .select("id,code,dm_mode,created_at,dimension_id")
          .in("id", roomIds),
        supabase
          .from("dice_table_members")
          .select("table_id,user_id,display_name,role")
          .in("table_id", roomIds)
          .order("joined_at"),
      ])
    : [{ data: [] }, { data: [] }];
  const roomList = (ownMemberships ?? []).flatMap((membership) => {
    const room = (rooms ?? []).find((item) => item.id === membership.table_id);
    return room
      ? [
          {
            ...room,
            ownRole: membership.role,
            character_id: membership.character_id,
            members: (roomMembers ?? []).filter(
              (member) => member.table_id === room.id,
            ),
          },
        ]
      : [];
  });

  return (
    <main className="lobby-shell">
      <header className="lobby-topbar">
        <span className="lobby-brand">MYTHWEAVE</span>
        <LogoutButton />
      </header>
      <section className="lobby-content">
        <span className="lobby-kicker">ADVENTURER VERIFIED</span>
        <h1>
          ยินดีต้อนรับ
          <br />
          {displayName}
        </h1>
        <p>
          {characters?.length
            ? "เลือกตัวละครที่ต้องการใช้ หรือสร้างตำนานบทใหม่ก่อนเข้าสู่ห้องกับเพื่อน"
            : "บัญชีของคุณพร้อมแล้ว ขั้นต่อไปคือสร้างตัวละคร เลือกเผ่าและอาชีพ ก่อนเข้าสู่ห้องผจญภัยกับเพื่อน"}
        </p>
        <div className={`lobby-identity ${isGuest ? "guest" : ""}`}>
          <small>บัญชีที่กำลังใช้งาน</small>
          <strong>{isGuest ? `◇ Guest · ${displayName}` : user.email}</strong>
          {isGuest && (
            <span>
              ข้อมูลผูกกับเบราว์เซอร์นี้ กรุณาอย่าออกจากระบบหรือล้างข้อมูล
            </span>
          )}
        </div>
        <section className="lobby-room-actions">
          <div>
            <small>PLAY ONLINE</small>
            <h2>เริ่มเล่นกับเพื่อน</h2>
            <p>สร้างห้องส่วนตัว หรือกรอกรหัสที่หัวปาร์ตี้ส่งมาให้</p>
          </div>
          {characters?.length ? (
            <NewRoomCharacterPicker characters={characters} />
          ) : (
            <Link className="need-character" href="/characters/new">
              สร้างตัวละครก่อนเปิดหรือจอยห้อง →
            </Link>
          )}
        </section>
        <section className="lobby-room-list">
          <header>
            <div>
              <small>MY ROOMS</small>
              <h2>ห้องที่เคยเข้าร่วม</h2>
            </div>
            <span>แสดงเฉพาะห้องของคุณเพื่อรักษาความเป็นส่วนตัว</span>
          </header>
          {roomList.length ? (
            <div>
              {roomList.map((room) => (
                <article key={room.id}>
                  <header>
                    <span>ห้อง {room.code}</span>
                    <b>
                      {room.ownRole === "dm"
                        ? "DM"
                        : room.ownRole === "spectator"
                          ? "SPECTATOR"
                          : "PLAYER"}
                    </b>
                  </header>
                  <p>
                    {room.dm_mode === "human"
                      ? "DM คนจริง"
                      : room.dm_mode === "subscription"
                        ? "AI DM · SUB"
                        : "AI DM · API"}{" "}
                    · สมาชิก {room.members.length} คน
                  </p>
                  <div>
                    {room.members.slice(0, 6).map((member) => (
                      <i key={`${room.id}-${member.user_id}`}>
                        {member.role === "dm"
                          ? "👑"
                          : member.role === "spectator"
                            ? "👁"
                            : "⚔️"}{" "}
                        {member.display_name}
                      </i>
                    ))}
                  </div>
                  <ExistingRoomCharacterPicker
                    tableId={room.id}
                    initialCharacterId={room.character_id}
                    characters={(characters ?? []).filter(
                      (character) =>
                        character.dimension_id === room.dimension_id,
                    )}
                  />
                </article>
              ))}
            </div>
          ) : (
            <p className="room-list-empty">
              ยังไม่มีห้องที่เคยเข้าร่วม · กดสร้างห้องหรือจอยด้วยรหัสด้านบน
            </p>
          )}
        </section>
        <div className="lobby-character-heading">
          <div>
            <small>YOUR ADVENTURERS</small>
            <h2>ตัวละครของคุณ</h2>
          </div>
          <Link href="/characters/new">+ สร้างตัวละคร</Link>
        </div>
        {characters?.length ? (
          <div className="lobby-characters">
            {characters.map((character) => {
              const race = findRace(character.race);
              const characterClass = findClass(character.character_class);
              return (
                <Link
                  className="lobby-character-card"
                  href={`/characters/${character.id}`}
                  key={character.id}
                >
                  <div className="lobby-avatar">
                    <CharacterAvatar
                      appearance={
                        (character.appearance as Appearance) ??
                        DEFAULT_APPEARANCE
                      }
                      characterClass={character.character_class}
                      name={character.name}
                      race={character.race}
                    />
                  </div>
                  <div>
                    <small>LEVEL {character.level}</small>
                    <h3>{character.name}</h3>
                    <p>
                      {race?.label} · {characterClass?.label}
                    </p>
                    <span>
                      HP {character.hp_current}/{character.hp_max}
                    </span>
                  </div>
                  <i>เปิด Character Sheet →</i>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="lobby-empty">
            <span>✦</span>
            <h3>ยังไม่มีตัวละคร</h3>
            <p>เข้าสู่ Character Forge เพื่อสร้างผู้ผจญภัยคนแรก</p>
            <Link href="/characters/new">สร้างตัวละครแรก →</Link>
          </div>
        )}
        <div className="lobby-next">
          <article>
            <span>01 · READY</span>
            <h2>สร้างตัวละคร</h2>
            <p>เลือกเผ่า คลาส ค่าสถานะ และรูปลักษณ์เริ่มต้น</p>
          </article>
          <article>
            <span>02 · READY</span>
            <h2>Character Sheet</h2>
            <p>ดูและแก้ไข HP, stats และ inventory เบื้องต้น</p>
          </article>
          <article>
            <span>03 · ACTIVE</span>
            <h2>ทอยเต๋าพร้อมกัน</h2>
            <p>ส่งผลเต๋าแบบ real-time ให้ผู้เล่นในห้องเห็นพร้อมกัน</p>
            <Link href="/dice">เปิดโต๊ะเต๋า →</Link>
          </article>
          <article>
            <span>DM · TOOLS</span>
            <h2>เครื่องมือผู้ดำเนินเกม</h2>
            <p>เปิดห้องที่ดูแลและส่งรายงานเหตุการณ์ โดยไม่ปะปนกับระบบ Admin</p>
            <Link href="/dm">เปิด DM Toolkit →</Link>
          </article>
          <article>
            <span>04 · WORLD</span>
            <h2>คลังเนื้อหา</h2>
            <p>ตรวจ item, dialogue, quest และ event ที่พร้อมใช้งาน</p>
            <Link href="/content">เปิด World Content →</Link>
          </article>
          <article>
            <span>05 · DIMENSIONS</span>
            <h2>มิติและกฎโลก</h2>
            <p>สำรวจ preset ความยาก ธีม และเนื้อเรื่องที่แยกจากกัน</p>
            <Link href="/dimensions">เปิด Reality Atlas →</Link>
          </article>
        </div>
      </section>
    </main>
  );
}
