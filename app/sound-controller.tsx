"use client";
import { useEffect, useRef, useState } from "react";
import type { Howl as HowlType } from "howler";
import type { RollTier } from "../lib/dice/feedback";
type SoundPrefs = {
  music: number;
  effects: number;
  muted: boolean;
  track: "forest" | "tavern" | "arcane";
};
const defaults: SoundPrefs = {
  music: 0.28,
  effects: 0.65,
  muted: false,
  track: "forest",
};
function wavData(
  duration: number,
  sample: (time: number, index: number) => number,
) {
  const rate = 8000,
    count = Math.floor(duration * rate),
    buffer = new ArrayBuffer(44 + count * 2),
    view = new DataView(buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((char, index) =>
      view.setUint8(offset + index, char.charCodeAt(0)),
    );
  text(0, "RIFF");
  view.setUint32(4, 36 + count * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++)
    view.setInt16(
      44 + i * 2,
      Math.max(-1, Math.min(1, sample(i / rate, i))) * 32767,
      true,
    );
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let start = 0; start < bytes.length; start += 8192)
    binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  return `data:audio/wav;base64,${btoa(binary)}`;
}
function ambient(track: SoundPrefs["track"]) {
  const roots = {
    forest: [110, 164.81, 220],
    tavern: [130.81, 196, 261.63],
    arcane: [98, 146.83, 233.08],
  }[track];
  return wavData(8, (time) => {
    const fade = Math.min(1, time / 0.6, (8 - time) / 0.6),
      pulse = 0.72 + 0.18 * Math.sin((Math.PI * time) / 4);
    return (
      fade *
      pulse *
      (Math.sin(2 * Math.PI * roots[0] * time) * 0.12 +
        Math.sin(2 * Math.PI * roots[1] * time) * 0.065 +
        Math.sin(2 * Math.PI * roots[2] * time) * 0.035)
    );
  });
}
function diceEffect() {
  return wavData(0.72, (time, index) => {
    const impacts = [0, 0.13, 0.27, 0.43, 0.57].reduce(
      (sum, at) => sum + (time >= at ? Math.exp(-(time - at) * 28) : 0),
      0,
    );
    const noise = Math.sin(index * 12.9898) * Math.sin(index * 78.233);
    return noise * impacts * 0.34;
  });
}

function resultEffect(tier: RollTier) {
  const settings: Record<
    RollTier,
    { duration: number; notes: number[]; volume: number; rough?: boolean }
  > = {
    doom: { duration: 1.05, notes: [118, 82, 55], volume: 0.42, rough: true },
    poor: { duration: 0.7, notes: [180, 132], volume: 0.3, rough: true },
    neutral: { duration: 0.55, notes: [246.94, 293.66], volume: 0.22 },
    good: { duration: 0.72, notes: [261.63, 329.63, 392], volume: 0.27 },
    critical: {
      duration: 1.05,
      notes: [392, 523.25, 659.25, 783.99],
      volume: 0.3,
    },
  };
  const config = settings[tier];
  return wavData(config.duration, (time, index) => {
    const noteLength = config.duration / config.notes.length;
    const noteIndex = Math.min(
      config.notes.length - 1,
      Math.floor(time / noteLength),
    );
    const localTime = time - noteIndex * noteLength;
    const envelope = Math.exp(-localTime * (tier === "doom" ? 3.2 : 6));
    const pitch = config.notes[noteIndex];
    const tone =
      Math.sin(2 * Math.PI * pitch * time) +
      Math.sin(2 * Math.PI * pitch * 1.5 * time) * 0.25;
    const grit = config.rough
      ? Math.sin(index * 7.13) * Math.sin(index * 31.7) * 0.24
      : 0;
    return (tone * 0.6 + grit) * envelope * config.volume;
  });
}

export function SoundController() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [prefs, setPrefs] = useState<SoundPrefs>(defaults);
  const musicRef = useRef<HowlType | null>(null),
    effectRef = useRef<HowlType | null>(null),
    resultEffectsRef = useRef<Record<RollTier, HowlType> | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("mythweave-sound") ?? "null",
      ) as Partial<SoundPrefs> | null;
      if (saved) setPrefs({ ...defaults, ...saved });
    } catch {}
  }, []);
  useEffect(() => {
    const play = (event: Event) => {
      if (!enabled || prefs.muted) return;
      const detail = (event as CustomEvent<{ tier?: RollTier }>).detail;
      const tier = detail?.tier ?? "neutral";
      effectRef.current?.play();
      window.setTimeout(() => resultEffectsRef.current?.[tier].play(), 390);
    };
    window.addEventListener("mythweave:dice-sfx", play);
    return () => window.removeEventListener("mythweave:dice-sfx", play);
  }, [enabled, prefs.muted]);
  function save(next: SoundPrefs) {
    setPrefs(next);
    localStorage.setItem("mythweave-sound", JSON.stringify(next));
    musicRef.current?.volume(next.music);
    effectRef.current?.volume(next.effects);
    Object.values(resultEffectsRef.current ?? {}).forEach((effect) =>
      effect.volume(next.effects),
    );
    if (next.muted) {
      musicRef.current?.mute(true);
      effectRef.current?.mute(true);
      Object.values(resultEffectsRef.current ?? {}).forEach((effect) =>
        effect.mute(true),
      );
    } else {
      musicRef.current?.mute(false);
      effectRef.current?.mute(false);
      Object.values(resultEffectsRef.current ?? {}).forEach((effect) =>
        effect.mute(false),
      );
    }
  }
  async function start(track = prefs.track) {
    const { Howl } = await import("howler");
    musicRef.current?.unload();
    musicRef.current = new Howl({
      src: [ambient(track)],
      format: ["wav"],
      loop: true,
      volume: prefs.music,
    });
    if (!effectRef.current)
      effectRef.current = new Howl({
        src: [diceEffect()],
        format: ["wav"],
        volume: prefs.effects,
      });
    if (!resultEffectsRef.current) {
      resultEffectsRef.current = Object.fromEntries(
        (["doom", "poor", "neutral", "good", "critical"] as const).map(
          (tier) => [
            tier,
            new Howl({
              src: [resultEffect(tier)],
              format: ["wav"],
              volume: prefs.effects,
            }),
          ],
        ),
      ) as Record<RollTier, HowlType>;
    }
    if (!prefs.muted) musicRef.current.play();
    setEnabled(true);
  }
  async function chooseTrack(track: SoundPrefs["track"]) {
    save({ ...prefs, track });
    if (enabled) await start(track);
  }
  function toggleMute() {
    const next = { ...prefs, muted: !prefs.muted };
    save(next);
    if (!next.muted && enabled && !musicRef.current?.playing())
      musicRef.current?.play();
  }
  return (
    <aside className={`sound-dock ${open ? "open" : ""}`}>
      <button
        className="sound-orb"
        aria-label="เปิดแผงควบคุมเสียง"
        onClick={() => setOpen((value) => !value)}
      >
        {prefs.muted ? "♩" : "♫"}
      </button>
      {open && (
        <section>
          <header>
            <div>
              <small>HOWLER AUDIO MIXER</small>
              <h2>เสียงแห่งการผจญภัย</h2>
            </div>
            <button onClick={() => setOpen(false)}>×</button>
          </header>
          {!enabled ? (
            <button className="sound-start" onClick={() => void start()}>
              เริ่มเสียงบรรยากาศ
            </button>
          ) : (
            <button className="sound-mute" onClick={toggleMute}>
              {prefs.muted ? "เปิดเสียง" : "ปิดเสียงทั้งหมด"}
            </button>
          )}
          <label>
            เพลงบรรยากาศ <b>{Math.round(prefs.music * 100)}%</b>
          </label>
          <input
            aria-label="ระดับเสียงเพลง"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={prefs.music}
            onChange={(event) =>
              save({ ...prefs, music: Number(event.target.value) })
            }
          />
          <label>
            เอฟเฟกต์เต๋า <b>{Math.round(prefs.effects * 100)}%</b>
          </label>
          <input
            aria-label="ระดับเสียงเอฟเฟกต์"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={prefs.effects}
            onChange={(event) =>
              save({ ...prefs, effects: Number(event.target.value) })
            }
          />
          <div className="sound-tracks">
            {(["forest", "tavern", "arcane"] as const).map((track) => (
              <button
                className={prefs.track === track ? "selected" : ""}
                key={track}
                onClick={() => void chooseTrack(track)}
              >
                {track === "forest"
                  ? "พงไพร"
                  : track === "tavern"
                    ? "โรงเตี๊ยม"
                    : "หอคอยเวท"}
              </button>
            ))}
          </div>
          <p>
            🎲 เสียงผลทอยจะเปลี่ยนตามระดับโชค · ☠️ ผลแย่มากมีเสียงเตือนพิเศษ ·
            การตั้งค่าจะถูกจำอัตโนมัติ
          </p>
        </section>
      )}
    </aside>
  );
}
