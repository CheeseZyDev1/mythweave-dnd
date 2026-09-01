"use client";
import { FormEvent, useState } from "react";
import { splitCoins, type WalletTransaction } from "../../../lib/wallet/types";
export function WalletPanel({
  characterId,
  initialBalance,
  initialTransactions,
}: {
  characterId: string;
  initialBalance: number;
  initialTransactions: WalletTransaction[];
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [amount, setAmount] = useState(1);
  const [denomination, setDenomination] = useState(100);
  const [direction, setDirection] = useState(1);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const coins = splitCoins(balance);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          amountCopper: amount * denomination * direction,
          reason,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error === "insufficient_funds"
            ? "เหรียญไม่เพียงพอ"
            : "ปรับยอดไม่สำเร็จ",
        );
      const tx = result.transaction as WalletTransaction;
      setBalance(tx.balance_after);
      setTransactions((current) => [tx, ...current].slice(0, 20));
      setReason("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ปรับยอดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="sheet-panel wallet-panel">
      <div className="sheet-section-title">
        <div>
          <small>CURRENCY LEDGER</small>
          <h2>กระเป๋าเหรียญ</h2>
        </div>
        <p>ทุกยอดถูกบันทึกในบัญชีตัวละคร</p>
      </div>
      <a className="wallet-shop-link" href={`/shop?character=${characterId}`}>
        เข้าสู่ร้านค้า NPC →
      </a>
      <a className="wallet-shop-link" href={`/quests?character=${characterId}`}>
        เปิด Quest Log →
      </a>
      <div className="coin-grid">
        {[
          ["PP", coins.platinum],
          ["GP", coins.gold],
          ["SP", coins.silver],
          ["CP", coins.copper],
        ].map(([label, value]) => (
          <article key={String(label)}>
            <strong>{value}</strong>
            <span>{label}</span>
          </article>
        ))}
      </div>
      <form onSubmit={submit}>
        <select
          value={direction}
          onChange={(event) => setDirection(Number(event.target.value))}
        >
          <option value={1}>รับเงิน</option>
          <option value={-1}>จ่ายเงิน</option>
        </select>
        <input
          aria-label="จำนวนเหรียญ"
          type="number"
          min="1"
          max="100000"
          value={amount}
          onChange={(event) =>
            setAmount(Math.max(1, Math.min(100000, Number(event.target.value))))
          }
        />
        <select
          value={denomination}
          onChange={(event) => setDenomination(Number(event.target.value))}
        >
          <option value={1000}>PP</option>
          <option value={100}>GP</option>
          <option value={10}>SP</option>
          <option value={1}>CP</option>
        </select>
        <input
          maxLength={120}
          placeholder="เหตุผล เช่น รางวัลภารกิจ"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <button disabled={busy || !reason.trim()}>
          {busy ? "…" : "บันทึก"}
        </button>
      </form>
      {error && <p className="dice-error">{error}</p>}
      <div className="wallet-ledger">
        {transactions.map((tx) => (
          <div key={tx.id}>
            <b className={tx.delta_copper > 0 ? "income" : "expense"}>
              {tx.delta_copper > 0 ? "+" : ""}
              {tx.delta_copper} CP
            </b>
            <span>{tx.reason}</span>
            <small>
              {tx.balance_after} CP ·{" "}
              {new Date(tx.created_at).toLocaleString("th-TH")}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
