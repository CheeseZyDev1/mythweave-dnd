"use client";

import { useEffect, useRef, useState } from "react";

type VoicePrefs = {
  autoRead: boolean;
  rate: number;
  volume: number;
  voiceURI: string;
};

const STORAGE_KEY = "mythweave:narration-voice";
const defaults: VoicePrefs = {
  autoRead: false,
  rate: 0.95,
  volume: 0.9,
  voiceURI: "",
};

function cleanNarration(text: string) {
  return text
    .replace(/[*_#`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function NarrationSpeaker({
  narrationId,
  text,
}: {
  narrationId: string;
  text: string;
}) {
  const [prefs, setPrefs] = useState<VoicePrefs>(defaults);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const firstNarration = useRef(narrationId);
  const prefsRef = useRef(prefs);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }
    setSupported(true);
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? "null",
      ) as Partial<VoicePrefs> | null;
      if (saved) {
        const next = { ...defaults, ...saved };
        prefsRef.current = next;
        setPrefs(next);
      }
    } catch {}
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(
        [...available].sort((a, b) => {
          const aThai = a.lang.toLowerCase().startsWith("th") ? 0 : 1;
          const bThai = b.lang.toLowerCase().startsWith("th") ? 0 : 1;
          return aThai - bThai || a.name.localeCompare(b.name);
        }),
      );
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  function save(next: VoicePrefs) {
    prefsRef.current = next;
    setPrefs(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function speak(narration: string, replaceQueue = false) {
    if (!("speechSynthesis" in window)) return;
    if (replaceQueue) window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanNarration(narration));
    const current = prefsRef.current;
    const voice = voices.find((item) => item.voiceURI === current.voiceURI);
    const thaiVoice = voices.find((item) =>
      item.lang.toLowerCase().startsWith("th"),
    );
    utterance.voice = voice ?? thaiVoice ?? null;
    utterance.lang = utterance.voice?.lang ?? "th-TH";
    utterance.rate = current.rate;
    utterance.volume = current.volume;
    utterance.onstart = () => {
      setSpeaking(true);
      setPaused(false);
    };
    utterance.onend = () => {
      window.setTimeout(() => {
        setSpeaking(window.speechSynthesis.speaking);
        setPaused(window.speechSynthesis.paused);
      });
    };
    utterance.onerror = () => {
      setSpeaking(false);
      setPaused(false);
    };
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    if (firstNarration.current === narrationId) return;
    firstNarration.current = narrationId;
    if (prefsRef.current.autoRead) speak(text);
    // Narration id is the realtime trigger. Voice changes must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrationId, text]);

  function togglePause() {
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  }

  function stop() {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  }

  if (supported === false)
    return (
      <div className="narration-speaker unavailable">
        🔇 เครื่องนี้ไม่รองรับเสียงอ่าน
      </div>
    );

  return (
    <section className="narration-speaker" aria-label="เสียงอ่านคำบรรยาย">
      <header>
        <b>🔊 เสียงผู้บรรยาย</b>
        <button
          disabled={supported !== true}
          className={prefs.autoRead ? "active" : ""}
          onClick={() => {
            const autoRead = !prefs.autoRead;
            save({ ...prefs, autoRead });
            if (autoRead) speak(text, true);
            else stop();
          }}
        >
          {prefs.autoRead ? "อ่านอัตโนมัติ · เปิด" : "เปิดอ่านอัตโนมัติ"}
        </button>
      </header>
      <div className="narration-actions">
        <button disabled={supported !== true} onClick={() => speak(text, true)}>
          ▶ อ่าน/อ่านซ้ำ
        </button>
        <button
          disabled={supported !== true || !speaking}
          onClick={togglePause}
        >
          {paused ? "▶ อ่านต่อ" : "⏸ พัก"}
        </button>
        <button disabled={supported !== true || !speaking} onClick={stop}>
          ⏹ หยุด
        </button>
      </div>
      <details>
        <summary>ปรับเสียงและความเร็ว</summary>
        <label>
          <span>เสียงพูด</span>
          <select
            value={prefs.voiceURI}
            onChange={(event) =>
              save({ ...prefs, voiceURI: event.target.value })
            }
          >
            <option value="">อัตโนมัติ · เลือกเสียงไทยก่อน</option>
            {voices.map((voice) => (
              <option value={voice.voiceURI} key={voice.voiceURI}>
                {voice.lang.toLowerCase().startsWith("th") ? "🇹🇭 " : ""}
                {voice.name} · {voice.lang}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>ความเร็ว {prefs.rate.toFixed(2)}×</span>
          <input
            type="range"
            min="0.6"
            max="1.5"
            step="0.05"
            value={prefs.rate}
            onChange={(event) =>
              save({ ...prefs, rate: Number(event.target.value) })
            }
          />
        </label>
        <label>
          <span>ระดับเสียง {Math.round(prefs.volume * 100)}%</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={prefs.volume}
            onChange={(event) =>
              save({ ...prefs, volume: Number(event.target.value) })
            }
          />
        </label>
      </details>
    </section>
  );
}
