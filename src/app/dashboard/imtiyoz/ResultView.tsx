"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Printer, RotateCw, Search } from "lucide-react";
import {
  VERDICT,
  WORKER_STATUS_LABEL,
  buildReasons,
  verdictSentence,
  type ImtiyozResult,
  type ImtiyozWorkerStatus,
} from "@/lib/imtiyoz";
import { cn } from "@/lib/utils";

/**
 * Natijani chizadigan YAGONA komponent.
 *
 * ⚠️ Tekshirish sahifasi ham, tarixdagi arxiv nusxasi ham SHUNI ishlatadi — shuning
 * uchun saqlangan natija jonli natija bilan hech qachon ajralib qolmaydi. Ikkinchi
 * "faqat tarix uchun" ko'rinish yozmang.
 *
 * ⚠️ Butun mantiq FAQAT `data.resultCode` ga tayanadi; xabar matni solishtirilmaydi.
 *
 * Ko'rinish tamoyili: operator birinchi navbatda BITTA narsani ko'rishi kerak —
 * imtiyoz beriladimi yoki yo'q. Xodimlar ro'yxati va texnik ma'lumot yopiq
 * panellarda, faqat kerak bo'lganda ochiladi.
 */

const TONE: Record<string, { card: string; mark: string; title: string }> = {
  ok: { card: "border-emerald-200 bg-emerald-50", mark: "bg-emerald-600", title: "text-emerald-900" },
  no: { card: "border-red-200 bg-red-50", mark: "bg-red-600", title: "text-red-900" },
  info: { card: "border-slate-200 bg-slate-50", mark: "bg-slate-500", title: "text-slate-900" },
  wait: { card: "border-amber-200 bg-amber-50", mark: "bg-amber-500", title: "text-amber-900" },
};

const STATUS_TONE: Record<ImtiyozWorkerStatus, string> = {
  disabled: "bg-emerald-100 text-emerald-800",
  not_disabled: "bg-slate-100 text-slate-700",
  not_found: "bg-slate-100 text-slate-500",
  failed: "bg-amber-100 text-amber-900",
};

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export interface ResultViewOptions {
  /** Arxiv nusxasi — qayta urinish va chop etishdan boshqa amal bo'lmaydi. */
  readonly?: boolean;
  attempts?: number;
  lastAttemptAt?: string | null;
  operator?: string;
  onRetry?: () => void;
}

export function ResultView({ data, opts = {} }: { data: ImtiyozResult; opts?: ResultViewOptions }) {
  const meta = VERDICT[data.resultCode] ?? { tone: "wait" as const, mark: "?", title: "Noma'lum natija" };
  const tone = TONE[meta.tone];
  const reasons = data.inconclusive ? buildReasons(data) : [];
  const canRetry = !opts.readonly && typeof opts.onRetry === "function";

  return (
    <div className="space-y-4">
      {/* ─── 1. Xulosa ─── */}
      <div className={cn("rounded-xl border p-5 shadow-sm", tone.card)}>
        {/* Kesh eslatmasi natija BOSHIDA: bu javob aynan qachon jonli tekshiruvdan
            olinganini ko'rsatadi va pastdagi umumiy holat paneli bilan chalkashmaydi. */}
        {data.fromCache ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-white/60 bg-white/70 px-3 py-2 text-xs text-slate-600">
            <span>
              Bu javob keshdan olindi — oxirgi muvaffaqiyatli tekshiruv: {fmtDateTime(data.computedAt)}.
            </span>
            {canRetry ? (
              <button
                onClick={opts.onRetry}
                className="font-semibold text-cobalt underline underline-offset-2 hover:opacity-80"
                style={{ color: "var(--cobalt)" }}
              >
                Qayta tekshirish
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-bold text-white",
              tone.mark,
            )}
          >
            {meta.mark}
          </span>
          <h2 className={cn("text-lg font-bold tracking-tight", tone.title)}>{meta.title}</h2>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-slate-700">{verdictSentence(data)}</p>

        {reasons.length > 0 ? (
          <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
            {reasons.map((r, i) => (
              <li key={i} className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {/* ⚠️ "Qayta tekshirish" FAQAT "aniqlanmadi" holatida chiqadi. Rad javobida
            bu tugma umuman bo'lmasligi kerak — aks holda operator rad javobini ham
            "vaqtinchalik nosozlik" deb tushunishi mumkin. */}
        {data.inconclusive && canRetry ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
            <button
              onClick={opts.onRetry}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              style={{ background: "var(--cobalt)" }}
            >
              <RotateCw className="h-4 w-4" />
              {data.failedChecks.length > 0
                ? `Qayta tekshirish (${data.failedChecks.length} ta xodim)`
                : "Qayta tekshirish"}
            </button>
            {(opts.attempts ?? 0) > 1 ? (
              <span className="text-xs text-slate-500">
                {opts.attempts}-urinish · oxirgisi {fmtDateTime(opts.lastAttemptAt)}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 font-mono text-xs text-slate-500">
          {data.subjectType === "JSHSHIR" ? "JSHSHIR" : "STIR"} {data.subjectId || data.tin}
        </div>
      </div>

      {/* ─── 2. Xodimlar (yopiq) ─── */}
      {data.workers.length > 0 ? <WorkersPanel data={data} /> : null}

      {/* ─── 3. Tafsilotlar (yopiq) ─── */}
      <FactsPanel data={data} opts={opts} />
    </div>
  );
}

/**
 * Xodimlar paneli. Ichida saralash yoki ustunlar bo'yicha filtr YO'Q: operatorga
 * kerak bo'ladigan yagona filtr — "tekshirilmaganlar", va u faqat shundaylar
 * bo'lganda chiqadi.
 */
function WorkersPanel({ data }: { data: ImtiyozResult }) {
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [query, setQuery] = useState("");
  const total = data.workers.length;
  const c = data.counts;

  const rows = useMemo(() => {
    let list = data.workers.slice();
    // "Aniqlanmadi" holatida tekshirilmagan qatorlar YUQORIGA — aynan ular sabab.
    if (data.inconclusive) {
      list.sort((a, b) => (a.status === "failed" ? 0 : 1) - (b.status === "failed" ? 0 : 1));
    }
    if (onlyFailed) list = list.filter((w) => w.status === "failed");
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (w) =>
          w.pinfl.includes(q) ||
          (w.fullName ?? "").toLowerCase().includes(q) ||
          (w.position ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [data.workers, data.inconclusive, onlyFailed, query]);

  const notes: string[] = [];
  if (rows.length !== total) notes.push(`Ko'rsatilmoqda: ${rows.length} / ${total}`);
  if (data.subjectType === "JSHSHIR") {
    notes.push("YATT uchun lavozim ko'rsatilmaydi — Soliq bazasining bu bo'limida bunday maydon yo'q.");
  }

  return (
    <details className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
        Xodimlar ro&apos;yxati
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {total} ta
        </span>
      </summary>

      <div className="border-t border-border p-4">
        {/* Qisqa sanoq — kataklar emas, bitta qator matn */}
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <span>
            Nogironligi bor: <b className="text-slate-900">{c.disabled}</b>
          </span>
          <span>
            Nogironligi yo&apos;q: <b className="text-slate-900">{c.notDisabled}</b>
          </span>
          <span>
            Reyestrda topilmadi: <b className="text-slate-900">{c.notFound}</b>
          </span>
          {c.failed > 0 ? (
            <span className="text-amber-700">
              Tekshirilmadi: <b>{c.failed}</b>
            </span>
          ) : null}
        </div>

        {/* Faqat kerak bo'lganda chiqadigan boshqaruvlar */}
        {c.failed > 0 || total > 25 ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
            {c.failed > 0 ? (
              <button
                onClick={() => setOnlyFailed((v) => !v)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                {onlyFailed ? "Hammasini ko'rsatish" : "Faqat tekshirilmaganlar"}
              </button>
            ) : null}
            {total > 25 ? (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="PINFL yoki F.I.Sh. bo'yicha qidirish"
                  className="w-64 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs shadow-sm outline-none focus:border-cobalt"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2 text-right">№</th>
                <th className="px-2 py-2">PINFL</th>
                <th className="px-2 py-2">Lavozim</th>
                <th className="px-2 py-2">F.I.Sh.</th>
                <th className="px-2 py-2">Holat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w, i) => {
                // Nogironlik guruhi alohida ustun EMAS — holat matniga qo'shiladi,
                // shunda jadval torroq va o'qish osonroq.
                let statusText: string = WORKER_STATUS_LABEL[w.status];
                if (w.status === "disabled" && w.disabilityGroup) {
                  statusText += ` · ${w.disabilityGroup}-guruh`;
                }
                return (
                  <tr
                    key={`${w.pinfl}-${i}`}
                    className={cn("border-b border-border/60", w.status === "failed" && "bg-amber-50/60")}
                  >
                    <td className="px-2 py-1.5 text-right text-xs text-slate-400">{i + 1}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-mono text-xs">{w.pinfl}</td>
                    <td className="px-2 py-1.5 text-slate-600">{w.position || "—"}</td>
                    <td className="px-2 py-1.5">{w.fullName || "—"}</td>
                    <td className="px-2 py-1.5">
                      <span
                        title={w.error ?? undefined}
                        className={cn(
                          "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_TONE[w.status],
                        )}
                      >
                        {statusText}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {notes.length > 0 ? <p className="mt-2 text-xs text-muted-foreground">{notes.join(" · ")}</p> : null}
      </div>
    </details>
  );
}

/**
 * Tafsilotlar — kim, qachon, hujjat raqami va chop etish. Kundalik ishda kerak emas,
 * lekin nizo chiqqanda aynan shu ma'lumot kerak bo'ladi.
 */
function FactsPanel({ data, opts }: { data: ImtiyozResult; opts: ResultViewOptions }) {
  const operator = opts.operator || data.auditUsername;
  const facts: [string, string][] = [];
  if (operator) facts.push(["Tekshirgan", operator]);
  facts.push(["Vaqt", fmtDateTime(data.servedAt)]);
  if (data.fromCache) facts.push(["Hisoblangan", fmtDateTime(data.computedAt)]);
  facts.push(["Tekshirilgan xodim", `${data.checkedCount} / ${data.totalWorkers}`]);
  facts.push(["Yil / oy", `${data.year} / ${data.period}`]);
  facts.push(["Hujjat raqami", data.requestId]);

  return (
    <details className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
        Tafsilotlar
      </summary>
      <div className="border-t border-border p-4">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className={cn("text-sm text-slate-800", k === "Hujjat raqami" && "break-all font-mono text-xs")}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
        <button
          onClick={() => window.print()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 print:hidden"
        >
          <Printer className="h-4 w-4" />
          Chop etish
        </button>
      </div>
    </details>
  );
}
