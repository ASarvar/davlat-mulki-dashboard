"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { triggerAuctionSync, getAuctionSyncStatus, type AuctionSyncStatus } from "./actions";

/**
 * Reyestrni yangilash tugmasi + JONLI jarayon ko'rsatkichi.
 *
 * ⚠️ Job navbatga qo'yiladi va worker uni fon rejimida bajaradi — natija darhol
 * ko'rinmaydi. Ko'rsatkichsiz foydalanuvchi sahifani yangilab, o'zgarish yo'qligini
 * ko'rib "ishlamadi" deb o'ylardi (foydalanuvchi so'ragan, 2026-09-07).
 *
 * ⚠️ So'rov faqat RUNNING holatida yuboriladi va jarayon tugagach TO'XTAYDI —
 * bo'sh sahifada har 3 soniyada server action chaqirish keraksiz yuk bo'lardi.
 */
const POLL_MS = 3000;

export function SyncPanel({ initial }: { initial: AuctionSyncStatus | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [st, setSt] = useState<AuctionSyncStatus | null>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  /**
   * ⚠️ Tugma bosilgandan keyin worker job'ni olib, `AuctionSyncRun` yozuvini
   * yaratguncha ~1 soniya o'tadi. Shu oraliqda `getAuctionSyncStatus()` hali
   * OLDINGI run'ni qaytaradi — natijada panel "Xato: …" deb turar, tugma esa
   * yana bosiladigan bo'lib qolardi (ishlab chiqishda aynan shu ko'rindi).
   * Bu bayroq oraliqni yopadi: yangi run paydo bo'lgunicha "boshlanmoqda".
   */
  const [queued, setQueued] = useState(false);

  const running = st?.running ?? false;
  const busy = running || queued;

  // Navbatga qo'yilgach yangi run paydo bo'lishini kutamiz.
  useEffect(() => {
    if (!queued) return;
    if (running) {
      setQueued(false);
      return;
    }
    const startedAt = st?.startedAt ?? null;
    let alive = true;
    const id = setInterval(async () => {
      const next = await getAuctionSyncStatus();
      if (!alive) return;
      setSt(next);
      // Yangi run — boshqa `startedAt` yoki RUNNING holati.
      if (next?.running || (next && next.startedAt !== startedAt)) setQueued(false);
    }, 1500);
    // ⚠️ Cheksiz kutmaymiz: worker o'chiq bo'lsa job navbatda qolaveradi va
    // tugma abadiy bloklanardi.
    const stop = setTimeout(() => setQueued(false), 30_000);
    return () => {
      alive = false;
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [queued, running, st?.startedAt]);

  useEffect(() => {
    if (!running) return;
    let alive = true;
    const id = setInterval(async () => {
      const next = await getAuctionSyncStatus();
      if (!alive) return;
      setSt(next);
      // ⚠️ Jarayon tugaganda jadval ESKI ma'lumotni ko'rsatib turardi — sahifani
      // yangilaymiz, aks holda "68 196 yozuv saqlandi" yozuvi ostida 20 ta qator
      // turardi.
      if (next && !next.running) router.refresh();
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [running, router]);

  const label = () => {
    if (!st) return null;
    if (st.running) {
      const acc = st.credential ? `${st.credential} (${st.credentialIndex}/${st.credentialTotal})` : "boshlanmoqda…";
      const pg = st.pages > 0 ? ` — ${st.page}/${st.pages} sahifa` : "";
      return `${acc}${pg} · ${st.savedLabel} yozuv`;
    }
    if (st.stale) return "Oldingi yangilash yakunlanmagan (worker to'xtagan bo'lishi mumkin)";
    if (st.status === "DONE") return `Yakunlandi — ${st.savedLabel} yozuv`;
    if (st.status === "PARTIAL")
      return `Qisman: ${st.savedLabel} yozuv, xato akkauntlar — ${st.failedCredentials.join(", ")}`;
    if (st.status === "FAILED") return st.error ? `Xato: ${st.error}` : "Yangilash muvaffaqiyatsiz";
    return null;
  };

  const tone =
    busy || pending
      ? "text-slate-600"
      : st?.stale || st?.status === "PARTIAL"
        ? "text-amber-700"
        : st?.status === "FAILED"
          ? "text-red-600"
          : "text-emerald-700";

  const Icon = st?.running
    ? Loader2
    : st?.stale || st?.status === "PARTIAL" || st?.status === "FAILED"
      ? AlertTriangle
      : CheckCircle2;

  return (
    <div className="flex min-w-[260px] flex-col items-end gap-1.5">
      <button
        type="button"
        disabled={pending || busy}
        onClick={() =>
          start(async () => {
            const r = await triggerAuctionSync();
            setMsg(r.message);
            if (r.ok) setQueued(true);
            setSt(await getAuctionSyncStatus());
          })
        }
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${pending || busy ? "animate-spin" : ""}`} />
        {running ? "Yangilanmoqda…" : queued ? "Boshlanmoqda…" : pending ? "Yuborilmoqda…" : "Yangilash"}
      </button>

      {running && (
        <div className="w-full">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${st?.percent ?? 0}%`, background: "var(--cobalt)" }}
            />
          </div>
        </div>
      )}

      {/* ⚠️ Navbatda turganda ESKI run holati ko'rsatilmaydi — "Xato: …" yozuvi
          yangi urinish ustida turib, foydalanuvchini chalg'itardi. */}
      {st && !queued && (
        <span className={`flex items-center gap-1.5 text-right text-[12px] ${tone}`}>
          <Icon className={`h-3.5 w-3.5 shrink-0 ${st.running ? "animate-spin" : ""}`} />
          <span>{label()}</span>
        </span>
      )}
      {queued && <span className="text-[12px] text-muted-foreground">Navbatga qo&apos;yildi, worker boshlamoqda…</span>}
      {msg && !busy && <span className="text-[12px] text-muted-foreground">{msg}</span>}
    </div>
  );
}
