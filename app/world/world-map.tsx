"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Appearance } from "../../lib/characters/catalog";
import { createClient } from "../../lib/supabase/client";
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
  travel_mode: "fast_travel" | "foot" | "carriage" | "griffin";
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
type WorldControlEvent = { id: string; action_type: string; title_th: string; description_th: string; location_id: number | null; expires_at: string };
type Discovery = { id: string; location_id: number; title_th: string; description_th: string; category: string; rarity: string; discovered_at: string; is_new?: boolean;loot?:{item_name:string;rarity:string;roll:number;rates:{common:number;uncommon:number;rare:number}}|null };
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
  initialWorldEvents,
  initialDiscoveries,
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
  initialWorldEvents: WorldControlEvent[];
  initialDiscoveries: Discovery[];
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
  const [worldEvents, setWorldEvents] = useState(initialWorldEvents);
  const [discoveries,setDiscoveries]=useState(initialDiscoveries);
  const worldTime = getWorldTime(worldHours);
  const current = locations.find((location) => location.id === currentId) ?? points[0];
  const selected = locations.find((location) => location.id === selectedId) ?? current;
  const activeWorldEvent = worldEvents.find((event) => new Date(event.expires_at).getTime() > Date.now() && event.location_id === currentId) ?? worldEvents.find((event) => new Date(event.expires_at).getTime() > Date.now() && event.location_id === null);
  const reachableIds = useMemo(() => new Set(routes.flatMap(route => route.from_location_id === currentId ? [route.to_location_id] : route.to_location_id === currentId ? [route.from_location_id] : [])), [currentId, routes]);
  const routeSegments = useMemo(() => {
    const grouped = new Map<string, Route>();
    const priority: Record<Route["travel_mode"], number> = { foot: 1, carriage: 2, griffin: 3, fast_travel: 4 };
    for (const route of routes) {
      const key = [route.from_location_id, route.to_location_id].sort((a, b) => a - b).join("-");
      const previous = grouped.get(key);
      if (!previous || priority[route.travel_mode] < priority[previous.travel_mode]) grouped.set(key, route);
    }
    return [...grouped.values()].flatMap(route => {
      const from = locations.find(location => location.id === route.from_location_id);
      const to = locations.find(location => location.id === route.to_location_id);
      if (from?.map_x == null || from.map_y == null || to?.map_x == null || to.map_y == null) return [];
      const bend = ((route.from_location_id + route.to_location_id) % 2 ? 1 : -1) * 3.2;
      return [{ route, from, to, path: `M ${from.map_x} ${from.map_y} Q ${(from.map_x + to.map_x) / 2 + bend} ${(from.map_y + to.map_y) / 2 - bend} ${to.map_x} ${to.map_y}` }];
    });
  }, [locations, routes]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`world-control-${character.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "world_control_events" }, (payload) => {
      const incoming = payload.new as WorldControlEvent;
      setWorldEvents((existing) => [incoming, ...existing.filter((item) => item.id !== incoming.id)].slice(0, 12));
      if (incoming.action_type === "weather") void refreshWorldContext();
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  // The subscription is scoped to this character's mounted world view.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id]);

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
        if(result.discovery)setDiscoveries(current=>[{...result.discovery,loot:result.loot},...current.filter(item=>item.id!==result.discovery.id)]);
        setMessage(`เดินทางถึง ${result.travel.location_name} · ใช้เวลา ${result.travel.duration_hours} ชั่วโมง · เสบียง ${result.travel.food_cost}${result.discovery?` · ค้นพบ: ${result.discovery.title_th}`:""}${result.loot?` · ได้รับ ${result.loot.item_name} (${result.loot.rarity})`:""}`);
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
      if(result.discovery)setDiscoveries(current=>[{...result.discovery,loot:result.loot},...current.filter(item=>item.id!==result.discovery.id)]);
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
            {points.length} จุดสำรวจ · {routeSegments.length} เส้นทาง · เลือกเดินได้หลายสาย
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
      {activeWorldEvent && <section className={`world-control-banner ${activeWorldEvent.action_type}`}><small>GOD MODE · {activeWorldEvent.action_type.toUpperCase()}</small><b>{activeWorldEvent.title_th}</b><span>{activeWorldEvent.description_th}</span></section>}
      {villageEvent && <section className={`village-event ${villageEvent.status}`}><small>VILLAGE EVENT · DAY {villageEvent.world_day} · {villageEvent.event_type}</small><h3>{villageEvent.title_th}</h3><p>{villageEvent.description_th}</p>{villageEvent.status === "active" ? <div><button onClick={() => resolveVillageEvent("participate")}>เข้าร่วม · +{villageEvent.reward_copper} CP</button><button onClick={() => resolveVillageEvent("ignore")}>ผ่านไป</button></div> : <b>เหตุการณ์สิ้นสุดแล้ว</b>}</section>}
      {message && <p className="world-message">{message}</p>}
      {discoveries.length>0&&<section className={`world-discovery ${discoveries[0].rarity}`}><small>UNEXPECTED DISCOVERY · {discoveries[0].category.toUpperCase()}</small><h3>{discoveries[0].title_th}</h3><p>{discoveries[0].description_th}</p>{discoveries[0].loot&&<div className="discovery-loot"><b>LOOT · {discoveries[0].loot.item_name}</b><span>{discoveries[0].loot.rarity} · roll {discoveries[0].loot.roll}/100</span></div>}<details><summary>บันทึกสิ่งแปลกที่เคยพบ · {discoveries.length}</summary>{discoveries.map(discovery=><article key={discovery.id}><b>{discovery.title_th}</b><span>{locations.find(location=>location.id===discovery.location_id)?.name_th??"ดินแดนไร้นาม"}</span></article>)}</details></section>}
      <section className="map-scroll" aria-label="แผนที่เส้นทางแบบจุดต่อจุด">
      <div className="interactive-map">
        <img alt="แผนที่ทวีปเอเธอร์รา" src="/assets/worldmap.png" />
        <svg className="route-network" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {routeSegments.map(({route,path}) => <path className={`${route.travel_mode} ${route.from_location_id === currentId || route.to_location_id === currentId ? "reachable" : ""}`} d={path} vectorEffect="non-scaling-stroke" key={`${route.from_location_id}-${route.to_location_id}`} />)}
        </svg>
        {points.map((location) => (
          <button
            aria-label={location.name_th}
            className={`map-marker ${location.location_type} ${selected?.id === location.id ? "selected" : ""} ${location.id === currentId ? "current" : reachableIds.has(location.id) ? "reachable" : "distant"}`}
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
        <div className="map-legend"><span><i /> ไปได้ตอนนี้</span><span><i /> เส้นทางอื่น</span><span><i /> ตำแหน่งคุณ</span></div>
      </div>
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
            <div className="local-drop-rates">DROP RATE · Common {100-Math.min(15,3+selected.danger_level)-Math.min(35,20+selected.danger_level*2)}% · Uncommon {Math.min(35,20+selected.danger_level*2)}% · Rare {Math.min(15,3+selected.danger_level)}%</div>
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
                        : `${route.travel_mode === "foot" ? "เดินเท้า" : route.travel_mode === "carriage" ? "รถม้า" : "กริฟฟิน"} · ${route.duration_hours} ชม. · ${route.cost_copper ? `${route.cost_copper} CP · ` : ""}เสบียง ${route.food_cost}`}
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
