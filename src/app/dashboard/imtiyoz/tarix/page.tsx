import Link from "next/link";
import { ArrowLeft, Download, History, Search } from "lucide-react";
import type { ImtiyozResultCode as DbResultCode } from "@prisma/client";
import { requireSection } from "@/server/services/sectionAccess";
import { withBase } from "@/lib/basePath";
import { RESULT_SHORT, type ImtiyozResultCode } from "@/lib/imtiyoz";
import { listChecks } from "@/server/services/imtiyoz/audit";
import { Pagination } from "@/components/Pagination";
import { cn } from "@/lib/utils";

/**
 * Imtiyoz tekshiruvlari tarixi (audit jurnali).
 *
 * ⚠️ Bu sahifa HECH QACHON tekshiruvni qayta ishga tushirmaydi — u faqat SAQLANGAN
 * yozuvni ko'rsatadi: nima qaror qilingani, qachon va kim tomonidan. Tashqi
 * bazalarga birorta so'rov ketmaydi.
 */

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const PAGE_SIZE = 50;

const RESULT_TONE: Record<ImtiyozResultCode, string> = {
  ELIGIBLE: "bg-emerald-100 text-emerald-800",
  NOT_ELIGIBLE: "bg-red-100 text-red-800",
  NO_WORKERS: "bg-slate-100 text-slate-600",
  INCONCLUSIVE_SOLIQ: "bg-amber-100 text-amber-900",
  INCONCLUSIVE_TIEK: "bg-amber-100 text-amber-900",
  INCONCLUSIVE_YATT_INDEX: "bg-amber-100 text-amber-900",
};

const RESULT_OPTIONS: ImtiyozResultCode[] = [
  "ELIGIBLE",
  "NOT_ELIGIBLE",
  "NO_WORKERS",
  "INCONCLUSIVE_SOLIQ",
  "INCONCLUSIVE_TIEK",
  "INCONCLUSIVE_YATT_INDEX",
];

const inputCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-cobalt focus:ring-2 focus:ring-cobalt/20";

function fmtDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function ImtiyozHistoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireSection("imtiyoz");
  const sp = await searchParams;

  const subjectId = str(sp.subjectId)?.replace(/\D/g, "") || "";
  const resultCode = (str(sp.resultCode) || "") as ImtiyozResultCode | "";
  const from = str(sp.from) || "";
  const to = str(sp.to) || "";
  const page = Math.max(1, Number(str(sp.page)) || 1);

  const { rows, total } = await listChecks({
    subjectId: subjectId || null,
    resultCode: (resultCode || null) as DbResultCode | null,
    // ⚠️ Sana maydoni faqat KUNni beradi, saqlash esa to'liq vaqt — kunning
    // boshi/oxiriga aylantiramiz, aks holda "sanagacha" o'sha kunni tashlab ketardi.
    from: from ? new Date(`${from}T00:00:00.000Z`) : null,
    to: to ? new Date(`${to}T23:59:59.999Z`) : null,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Sahifalash va eksport havolalari uchun joriy filtrlar.
  const baseParams = new URLSearchParams();
  if (subjectId) baseParams.set("subjectId", subjectId);
  if (resultCode) baseParams.set("resultCode", resultCode);
  if (from) baseParams.set("from", from);
  if (to) baseParams.set("to", to);

  const hrefFor = (p: number) => {
    const params = new URLSearchParams(baseParams);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/dashboard/imtiyoz/tarix${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1
            className="mb-1 flex items-center gap-2 text-xl font-bold tracking-tight"
            style={{ color: "var(--navy)" }}
          >
            <History className="h-5 w-5" style={{ color: "var(--gold)" }} />
            Imtiyoz tekshiruvlari tarixi
          </h1>
          <p className="text-sm text-muted-foreground">
            Faqat saqlangan yozuvlar ko&apos;rsatiladi — tekshiruv qayta ishga tushirilmaydi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/imtiyoz"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Tekshirishga qaytish
          </Link>
          <a
            href={withBase(`/api/export/imtiyoz-history?${baseParams}`)}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ background: "var(--cobalt)" }}
          >
            <Download className="h-4 w-4" />
            CSV eksport
          </a>
        </div>
      </div>

      {/* Oddiy GET forma — `action` berilmaydi, joriy URL'ga (basePath bilan) yuboriladi */}
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-muted-foreground">STIR / JSHSHIR</label>
          <input name="subjectId" defaultValue={subjectId} placeholder="306781314" className={`${inputCls} w-40 font-mono`} />
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-muted-foreground">Natija</label>
          <select name="resultCode" defaultValue={resultCode} className={`${inputCls} w-52`}>
            <option value="">Barchasi</option>
            {RESULT_OPTIONS.map((code) => (
              <option key={code} value={code}>
                {RESULT_SHORT[code]}
                {code.startsWith("INCONCLUSIVE_") ? ` (${code.replace("INCONCLUSIVE_", "").toLowerCase()})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-muted-foreground">Sanadan</label>
          <input type="date" name="from" defaultValue={from} className={inputCls} />
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-muted-foreground">Sanagacha</label>
          <input type="date" name="to" defaultValue={to} className={inputCls} />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          style={{ background: "var(--cobalt)" }}
        >
          <Search className="h-4 w-4" />
          Qidirish
        </button>
        <Link
          href="/dashboard/imtiyoz/tarix"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          Tozalash
        </Link>
      </form>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5">Sana va vaqt</th>
                <th className="px-3 py-2.5">STIR / JSHSHIR</th>
                <th className="px-3 py-2.5">Natija</th>
                <th className="px-3 py-2.5 text-right">Xodim</th>
                <th className="px-3 py-2.5 text-right">Nogiron</th>
                <th className="px-3 py-2.5 text-right">Ulush</th>
                <th className="px-3 py-2.5">Tekshirgan</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    Bu shartlar bo&apos;yicha yozuv topilmadi. Filtrlarni o&apos;zgartirib ko&apos;ring.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.requestId} className="border-b border-border/60 transition hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2">
                      <Link href={`/dashboard/imtiyoz/tarix/${r.requestId}`} className="hover:underline">
                        {fmtDateTime(r.createdAt)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                      <Link href={`/dashboard/imtiyoz/tarix/${r.requestId}`} className="hover:underline">
                        {r.subjectId}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
                          RESULT_TONE[r.resultCode],
                        )}
                      >
                        {RESULT_SHORT[r.resultCode]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{r.totalWorkers}</td>
                    <td className="px-3 py-2 text-right">{r.disabledCount}</td>
                    <td className="px-3 py-2 text-right">
                      {r.disabledPercentage != null ? `${r.disabledPercentage.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{r.username}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.fromCache ? "keshdan" : ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={PAGE_SIZE}
        hrefFor={hrefFor}
        emptyLabel="Yozuv topilmadi"
      />
    </div>
  );
}
