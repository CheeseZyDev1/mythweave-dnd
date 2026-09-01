"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Appearance } from "../../lib/characters/catalog";
import { getWorldTime } from "../../lib/world/time";
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
type Journey = {
  id: string;
  destinationId: number;
  mode: string;
  durationHours: number;
  elapsedHours: number;
  encounterName: string;
  encounterDescription: string;
};
type Weather = { slug: string; name_th: string; description_th: string; symbol: string; travel_note_th: string; intensity: number; period_index: number; next_change_in_hours: number };
type VillageEvent = { id: string; title_th: string; description_th: string; event_type: string; reward_copper: number; status: string; world_day: number; location_id: number };
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
  initialWeather,
  initialVillageEvent,
  initialJourney,
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
  initialWeather: Weather;
  initialVillageEvent: VillageEvent | null;
  initialJourney: Journey | null;
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
  const [journey, setJourney] = useState<Journey | null>(initialJourney);
  const [message, setMessage] = useState("");
  const [weather, setWeather] = useState(initialWeather);
  const [villageEvent, setVillageEvent] = useState(initialVillageEvent);
  const worldTime = getWorldTime(worldHours);
  const current = locations.find((location) => location.id === currentId) ?? points[0];
  const selected = locations.find((location) => location.id === selectedId) ?? current;

  const travelOptions = routes.filter(
    (route) =>
      (route.from_location_id === current?.id &&
        route.to_location_id === selected?.id) ||
      (route.to_location_id === current?.id &&
        route.from_location_id === selected?.id),
  );

  async function refreshWorldContext() {
    const [weatherResponse, eventResponse] = await Promise.all([fetch(`/api/world/weather?character=${character.id}`), fetch(`/api/world/events?character=${character.id}`)]);
    if (weatherResponse.ok) setWeather((await weatherResponse.json()).weather);
    if (eventResponse.ok) setVillageEvent((await eventResponse.json()).event);
  }

  async function travel(mode: Route["travel_mode"]) {
    if (!selected) return;
    setTravelling(true);
    setMessage("");
    try {
      const [response] = await Promise.all([
        fetch("/api/world/travel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId: character.id, locationId: selected.id, mode }),
        }),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);
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
      setWorldHours(result.travel.world_hours_elapsed ?? worldHours);
      await refreshWorldContext();
      if (result.travel.interrupted) {
        setJourney({ id: result.travel.journey_id, destinationId: result.travel.destination_id, mode, durationHours: result.travel.duration_hours, elapsedHours: result.travel.elapsed_hours, encounterName: result.travel.encounter.name_th, encounterDescription: result.travel.encounter.description_th });
        setMessage("การเดินทางถูกขัดจังหวะ · ต้องจัดการเหตุการณ์ก่อนไปต่อ");
      } else {
        setCurrentId(result.travel.location_id);
        setMessage(`เดินทางถึง ${result.travel.location_name} · ใช้เวลา ${result.travel.duration_hours} ชั่วโมง · เสบียง ${result.travel.food_cost}`);
      }
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "เดินทางไม่สำเร็จ");
    } finally {
      setTravelling(false);
    }
  }

  async function continueJourney() {
    if (!journey) return;
    setTravelling(true);
    setMessage("");
    try {
      const [response] = await Promise.all([
        fetch("/api/world/travel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resolve", characterId: character.id, journeyId: journey.id }) }),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
      const result = await response.json();
      if (!response.ok) throw new Error("ไม่สามารถเดินทางต่อได้");
      setCurrentId(result.travel.location_id);
      setSelectedId(result.travel.location_id);
      setWorldHours(result.travel.world_hours_elapsed);
      await refreshWorldContext();
      setJourney(null);
      setMessage(`ผ่านเหตุการณ์และเดินทางถึง ${result.travel.location_name} แล้ว`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "เดินทางต่อไม่สำเร็จ");
    } finally {
      setTravelling(false);
    }
  }

  async function resolveVillageEvent(action: "participate" | "ignore") {
    if (!villageEvent) return;
    const response = await fetch("/api/world/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ characterId: character.id, eventId: villageEvent.id, action }) });
    const result = await response.json();
    if (!response.ok) return setMessage("เหตุการณ์นี้ถูกจัดการไปแล้ว");
    setVillageEvent((current) => current ? { ...current, status: result.event.status } : null);
    setMessage(action === "participate" ? `ชาวบ้านมอบ ${result.event.reward_copper} CP เป็นค่าตอบแทน` : "คุณเลือกไม่เข้าร่วมเหตุการณ์นี้");
  }

  return (
    <main className={`world-shell world-time-${worldTime.phase} weather-${weather.slug}`} data-time-phase={worldTime.phase} data-weather={weather.slug}>
      {travelling && (
        <div className="travel-loading" role="status">
          <div className="travel-road"><span>♞</span></div>
          <small>THE ROAD UNFOLDS</small>
          <strong>กำลังเดินทาง…</strong>
        </div>
      )}
      {journey && !travelling && (
        <div className="encounter-overlay" role="dialog" aria-modal="true">
          <section>
            <small>RANDOM ENCOUNTER · {journey.elapsedHours}/{journey.durationHours} HOURS</small>
            <h2>{journey.encounterName}</h2>
            <p>{journey.encounterDescription}</p>
            <button onClick={continueJourney}>จัดการเหตุการณ์ · เดินทางต่อ</button>
          </section>
        </div>
      )}
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
          <span className="world-clock">วันที่ {worldTime.day} · {worldTime.clock} · {worldTime.label}</span>
          <span>เวลาโลกสะสม {worldHours} ชั่วโมง</span>
        </div>
      </section>
      <section className="weather-panel"><b>{weather.symbol} {weather.name_th}</b><span>{weather.description_th}</span><small>ระดับ {weather.intensity}/3 · เปลี่ยนในอีก {weather.next_change_in_hours} ชม.</small><i>{weather.travel_note_th}</i></section>
      {villageEvent && <section className={`village-event ${villageEvent.status}`}><small>VILLAGE EVENT · DAY {villageEvent.world_day} · {villageEvent.event_type}</small><h3>{villageEvent.title_th}</h3><p>{villageEvent.description_th}</p>{villageEvent.status === "active" ? <div><button onClick={() => resolveVillageEvent("participate")}>เข้าร่วม · +{villageEvent.reward_copper} CP</button><button onClick={() => resolveVillageEvent("ignore")}>ผ่านไป</button></div> : <b>เหตุการณ์สิ้นสุดแล้ว</b>}</section>}
      {message && <p className="world-message">{message}</p>}
      <section className="interactive-map">
        <img alt="แผนที่ทวีปเอเธอร์รา" src="/assets/worldmap.png" />
        {points.map((location) => (
          <button
            aria-label={location.name_th}
            className={`map-marker ${location.location_type} ${selected?.id === location.id ? "selected" : ""}`}
            style={{ left: `${location.map_x}%`, top: `${location.map_y}%` }}
            onClick={() => setSelectedId(location.id)}
            disabled={Boolean(journey)}
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
