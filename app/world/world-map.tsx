"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Appearance } from "../../lib/characters/catalog";
import { CharacterAvatar } from "../characters/character-avatar";

type Location = {
  id: number;
  slug: string;
  parent_id: number | null;
  location_type: string;
  name_th: string;
  name_en: string;
  description_th: string;
  map_x: number | null;
  map_y: number | null;
  scene_asset: string | null;
  danger_level: number;
  fast_travel: boolean;
};
type Route = {
  id: number;
  from_location_id: number;
  to_location_id: number;
  travel_mode: "fast_travel" | "carriage" | "griffin";
  duration_hours: number;
  cost_copper: number;
  food_cost: number;
};
const typeLabels: Record<string, string> = {
  major_city: "เมืองใหญ่",
  small_town: "หมู่บ้าน",
  dungeon: "ดันเจียน",
  wilderness: "พื้นที่ป่า",
};

export function WorldMap({
  character,
  locations,
  routes,
  initialLocationId,
  initialWorldHours,
}: {
  character: {
    id: string;
    name: string;
    race: string;
    characterClass: string;
    appearance: Appearance;
  };
  locations: Location[];
  routes: Route[];
  initialLocationId: number;
  initialWorldHours: number;
}) {
  const points = useMemo(
    () =>
      locations.filter(
        (location) => location.map_x !== null && location.map_y !== null,
      ),
    [locations],
  );
  const [currentId, setCurrentId] = useState(initialLocationId);
  const [selectedId, setSelectedId] = useState(initialLocationId);
  const [worldHours, setWorldHours] = useState(initialWorldHours);
  const [travelling, setTravelling] = useState(false);
  const [message, setMessage] = useState("");
  const current = locations.find((location) => location.id === currentId) ?? points[0];
  const selected = locations.find((location) => location.id === selectedId) ?? current;

  const travelOptions = routes.filter(
    (route) =>
      (route.from_location_id === current?.id &&
        route.to_location_id === selected?.id) ||
      (route.to_location_id === current?.id &&
        route.from_location_id === selected?.id),
  );

  async function travel(mode: Route["travel_mode"]) {
    if (!selected) return;
    setTravelling(true);
    setMessage("");
    try {
      const response = await fetch("/api/world/travel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: character.id,
          locationId: selected.id,
          mode,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result.error === "insufficient_food"
            ? "เสบียงเดินทางไม่พอ"
            : result.error === "insufficient_funds"
              ? "เหรียญไม่พอจ่ายค่าเดินทาง"
              : "ไม่มีเส้นทางนี้จากตำแหน่งปัจจุบัน",
        );
      }
      setCurrentId(result.travel.location_id);
      setWorldHours(result.travel.world_hours_elapsed ?? worldHours);
      setMessage(
        `เดินทางถึง ${result.travel.location_name} · ใช้เวลา ${result.travel.duration_hours} ชั่วโมง · เสบียง ${result.travel.food_cost}`,
      );
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "เดินทางไม่สำเร็จ");
    } finally {
      setTravelling(false);
    }
  }

  return (
    <main className="world-shell">
      <header>
        <Link href={`/characters/${character.id}`}>← Character Sheet</Link>
        <span>MYTHWEAVE · AETHERRA</span>
        <i>{character.name}</i>
      </header>
      <section className="world-heading">
        <div>
          <small>ONE CONTINENT · FOUR HORIZONS</small>
          <h1>แผนที่เอเธอร์รา</h1>
          <p>
            อาณาจักรออเรเลียน · 2 เมืองใหญ่ · 3 หมู่บ้าน · 1 ดันเจียน · 3
            wilderness zones
          </p>
        </div>
        <div>
          <span>ตำแหน่งปัจจุบัน</span>
          <strong>{current?.name_th}</strong>
          <small>{current?.name_en}</small>
          <span>เวลาโลกสะสม {worldHours} ชั่วโมง</span>
        </div>
      </section>
      {message && <p className="world-message">{message}</p>}
      <section className="interactive-map">
        <img alt="แผนที่ทวีปเอเธอร์รา" src="/assets/worldmap.png" />
        {points.map((location) => (
          <button
            aria-label={location.name_th}
            className={`map-marker ${location.location_type} ${selected?.id === location.id ? "selected" : ""}`}
            style={{ left: `${location.map_x}%`, top: `${location.map_y}%` }}
            onClick={() => setSelectedId(location.id)}
            key={location.id}
          >
            <i />
            <span>{location.name_th}</span>
            {location.id === current?.id && (
              <div className="map-character">
                <CharacterAvatar
                  appearance={character.appearance}
                  race={character.race}
                  characterClass={character.characterClass}
                  name={character.name}
                />
              </div>
            )}
          </button>
        ))}
      </section>
      {selected && (
        <section
          className="location-scene"
          style={{
            backgroundImage: `linear-gradient(90deg,rgba(2,9,7,.96),rgba(2,9,7,.45)),url('${selected.scene_asset}')`,
          }}
        >
          <div>
            <small>
              {typeLabels[selected.location_type] ?? selected.location_type} ·
              DANGER {selected.danger_level}/10
            </small>
            <h2>{selected.name_th}</h2>
            <b>{selected.name_en}</b>
            <p>{selected.description_th}</p>
            {selected.id === current?.id ? (
              <span className="location-current">คุณอยู่ที่นี่</span>
            ) : travelOptions.length ? (
              <div className="travel-options">
                {travelOptions.map((route) => (
                  <button
                    className={`fast-travel-button ${route.travel_mode}`}
                    onClick={() => travel(route.travel_mode)}
                    disabled={travelling}
                    key={route.id}
                  >
                    {travelling
                      ? "กำลังเดินทาง…"
                      : route.travel_mode === "fast_travel"
                        ? "Fast Travel · ทันที · ฟรี"
                        : `${route.travel_mode === "carriage" ? "รถม้า" : "กริฟฟิน"} · ${route.duration_hours} ชม. · ${route.cost_copper} CP · เสบียง ${route.food_cost}`}
                  </button>
                ))}
              </div>
            ) : (
              <span className="location-preview">
                ดูฉากล่วงหน้า · ต้องใช้เส้นทางภาคพื้นดิน
              </span>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
