import Link from "next/link";

const foundations = [
  { mark: "N", title: "Next.js Foundation", detail: "App Router · TypeScript · Server Components", state: "พร้อมแล้ว" },
  { mark: "S", title: "Supabase Platform", detail: "Auth · Database · Realtime · Storage", state: "เชื่อมแล้ว" },
  { mark: "V", title: "Vercel Delivery", detail: "Preview · Production · Automatic Deploy", state: "ออนไลน์" },
];

export default function Home() {
  return (
    <main className="foundation-page">
      <header className="foundation-nav">
        <div className="brand-mark">M</div>
        <div className="brand-copy"><strong>MYTHWEAVE</strong><span>ONLINE TABLETOP</span></div>
        <div className="phase-pill"><i /> PHASE 0 · ONLINE</div>
      </header>

      <section className="foundation-hero">
        <div className="hero-copy">
          <p className="eyebrow">A NEW CHAPTER BEGINS</p>
          <h1>โลกเดิม<br /><em>รากฐานพร้อมแล้ว</em></h1>
          <p className="intro">Mythweave พร้อมเข้าสู่การสร้างระบบบัญชีผู้เล่น ห้องออนไลน์แบบเรียลไทม์ และการผจญภัยที่บันทึกไว้เล่นต่อได้</p>
          <div className="migration-status"><span>01</span><div><b>Phase 0 พร้อมใช้งานบนเว็บ</b><small>Next.js, Supabase และ Vercel เชื่อมต่อสำเร็จ</small></div></div>
          <Link className="foundation-cta" href="/auth">เข้าสู่ห้องผจญภัย <span>→</span></Link>
        </div>

        <div className="world-window" aria-label="แผนที่เอเธอเรีย">
          <div className="world-glow" />
          <div className="world-badge"><span>✦</span><div><small>ดินแดนแห่งเอเธอเรีย</small><b>การผจญภัยจะกลับมาในรากฐานใหม่</b></div></div>
        </div>
      </section>

      <section className="foundation-grid">
        {foundations.map((item, index) => (
          <article className="active" key={item.mark}>
            <span className="card-mark">{item.mark}</span>
            <div><small>0{index + 1}</small><h2>{item.title}</h2><p>{item.detail}</p></div>
            <b>{item.state}</b>
          </article>
        ))}
      </section>

      <footer><span>MYTHWEAVE REFORGED</span><small>Phase 0 — Foundation online</small></footer>
    </main>
  );
}
