import type { Metadata } from "next";
import { Cinzel, Noto_Sans_Thai } from "next/font/google";
import "./tailwind.css";
import "./globals.css";
import "./dm-console.css";

const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel" });
const thai = Noto_Sans_Thai({ subsets: ["thai"], variable: "--font-thai" });

export const metadata: Metadata = {
  title: "Mythweave — D&D Online Tabletop",
  description: "ออกผจญภัยในโลกแฟนตาซีพร้อมเพื่อนจากทุกที่",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className={`${cinzel.variable} ${thai.variable} selection:bg-amber-200 selection:text-emerald-950`}>{children}</body>
    </html>
  );
}
