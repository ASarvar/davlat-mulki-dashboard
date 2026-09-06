"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2, AlertTriangle, Loader2, SlidersHorizontal } from "lucide-react";
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

/** Joriy yil boshi — "2026-01-01". Tugma bosilmaguncha hech narsaga ta'sir qilmaydi. */
function yearStart(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export function SyncPanel({
  initial,
  credentials,
}: {
  initial: AuctionSyncStatus | null;
  /** Bazada uchraydigan akkauntlar (`auctionFacets().credentials`). */
  credentials: string[];
}) {
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
  const [open, setOpen] = useState(false);
  // ⚠️ Standart — JORIY YIL. Diqqat: bu VAQTNI deyarli tejamaydi (o'lchangan:
  // to'liq 16d37s ↔ joriy yil 15d3s) — sahifalar baribir to'liq o'qiladi.
  // Foydasi bazaga keraksiz yozuvni kamaytirish (68 196 → 11 890).
  // Tezlik kerak bo'lsa VILOYAT tanlang: bitta viloyat ~26 soniya.
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState("");
  const [creds, setCreds] = useState<string[]>([]);

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
    if (st.status === "DONE") {
      // ⚠️ Sana filtri bilan ishlaganda FAQAT yozilgan sonni ko'rsatish
      // chalg'itardi ("502 yozuv" — 68 000 lik bazada bu kam ko'rinadi).
      // Nechtasi oraliqdan tashqarida qolgani ham aytiladi.
      const extra = st.filtered ? `, oraliqdan tashqari ${st.filteredLabel}` : "";
      return `Yakunlandi — ${st.savedLabel} yozuv${extra}`;
    }
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
    <div className="flex min-w-[280px] flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen((v) => !v)}
          title="Yangilash doirasi: sana va viloyat"
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-2 text-[12px] text-slate-600 shadow-sm transition hover:bg-muted disabled:opacity-50"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Doira
        </button>
      <button
        type="button"
        disabled={pending || busy}
        onClick={() =>
          start(async () => {
            const r = await triggerAuctionSync({ from, to, credentials: creds });
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
      </div>

      {/* ⚠️ Doira tanlagich jarayon ketayotganda yopiladi — o'zgartirish ayni
          paytdagi run'ga ta'sir qilmaydi va foydalanuvchini chalg'itardi. */}
      {!busy && open && (
        <div className="w-full space-y-2 rounded-lg border border-border bg-card p-3 text-left shadow-sm">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Sanadan</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-md border border-slate-200 px-2 py-1 text-[12px]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Gacha</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-md border border-slate-200 px-2 py-1 text-[12px]"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              className="rounded-md border border-border px-2 py-1 text-[11px] text-slate-600 transition hover:bg-muted"
            >
              To&apos;liq (sanasiz)
            </button>
          </div>

          {credentials.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Viloyatlar {creds.length === 0 && <span className="normal-case">(bo&apos;sh = hammasi)</span>}
              </div>
              <div className="flex flex-wrap gap-1">
                {credentials.map((c) => {
                  const on = creds.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCreds((v) => (on ? v.filter((x) => x !== c) : [...v, c]))}
                      className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                        on
                          ? "border-transparent bg-cobalt text-white"
                          : "border-border bg-card text-slate-600 hover:bg-muted"
                      }`}
                      style={on ? { background: "var(--cobalt)" } : undefined}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            ⚠️ Sana API&apos;ga yuborilmaydi — u filtrlashni qo&apos;llab-quvvatlamaydi:
            sahifalar baribir to&apos;liq o&apos;qiladi, shuning uchun sana{" "}
            <strong>vaqtni deyarli tejamaydi</strong> (to&apos;liq 16 daq ↔ joriy yil 15 daq),
            faqat bazaga keraksiz yozuvni kamaytiradi. Tez yangilash kerak bo&apos;lsa{" "}
            <strong>viloyat tanlang</strong> — bittasi ~26 soniya. Sanasi yo&apos;q buyurtmalar
            (yangi va bekor qilinganlar) HAR DOIM saqlanadi.
          </p>
        </div>
      )}

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
      {/* ⚠️ Doira ALBATTA ko'rsatiladi: usiz "502 yozuv" degan natija to'liq
          yangilash deb tushunilib, ma'lumot yo'qolgandek taassurot berardi. */}
      {st && !queued && st.scopeLabel && (
        <span className="text-right text-[11px] text-muted-foreground">doira: {st.scopeLabel}</span>
      )}
      {queued && <span className="text-[12px] text-muted-foreground">Navbatga qo&apos;yildi, worker boshlamoqda…</span>}
      {msg && !busy && <span className="text-[12px] text-muted-foreground">{msg}</span>}
    </div>
  );
}
