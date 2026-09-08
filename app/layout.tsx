import type { Metadata } from "next";
import { Cinzel, Noto_Sans_Thai } from "next/font/google";
import "./tailwind.css";
import "./globals.css";
import "./dm-console.css";
import "./shop-haggle.css";
import "./relationships.css";
import "./guilds.css";
import "./cooking.css";
import "./brewing.css";
import "./forge.css";
import "./monster-forge.css";
import "./world.css";
import "./fast-travel.css";
import "./vehicle-travel.css";
import "./race-lore.css";
import "./bestiary.css";
import "./codex.css";
import "./rumor-board.css";
import "./homunculus.css";
import "./room-homunculus.css";
import "./solo.css";
import "./solo-life.css";
import "./ghost-mode.css";
import "./party-awareness.css";
import "./factions.css";
import "./life.css";
import "./persistent-party.css";
import "./player-trade.css";
import "./party-votes.css";
import "./dungeons.css";
import "./vtt.css";
import "./session-recaps.css";
import "./room-undo.css";
import "./dice-history.css";
import "./portrait-studio.css";
import "./theme-controller.css";
import { ThemeController } from "./theme-controller";
import "./sound-controller.css";
import { SoundController } from "./sound-controller";
import "./motion-experience.css";
import { MotionExperience } from "./motion-experience";

const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel" });
const thai = Noto_Sans_Thai({ subsets: ["thai"], variable: "--font-thai" });

export const metadata: Metadata = {
  title: "Mythweave — D&D Online Tabletop",
  description: "ออกผจญภัยในโลกแฟนตาซีพร้อมเพื่อนจากทุกที่",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className={`${cinzel.variable} ${thai.variable} selection:bg-amber-200 selection:text-emerald-950`}><MotionExperience>{children}</MotionExperience><ThemeController /><SoundController /></body>
    </html>
  );
}
