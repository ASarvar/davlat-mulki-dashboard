import Link from "next/link";
import { CalendarPlus, CalendarRange, CircleHelp, Download, Layers3, List, MapPin } from "lucide-react";
import { requireSection } from "@/server/services/sectionAccess";
import { balanceByRegion } from "@/server/services/balance";
import { listSourceNames } from "@/server/services/sources";
import { KpiCard } from "@/components/ui/KpiCard";
import { BRAND } from "@/lib/chartColors";
import { nf } from "@/lib/format";
import { withBase } from "@/lib/basePath";
import { currentMonthTashkent, dmy, monthLabel, monthRange, parseIsoDay } from "@/lib/balance";

/**
 * Balansga olingan obyektlar — oy bo'yicha, hududlar kesimida (KPI uchun, 2026-09-28).
 *
 * Sana — kadastrdagi huquq ro'yxatdan o'tgan sana (`Property.balanceDate`,
 * `lib/balance.ts`), tizim obyektni ko'rgan kun EMAS. Har bir son obyektlar
 * ro'yxatiga havola: `balansFrom`/`balansTo` filtri AYNAN shu `buildWhere()` bilan
 * ishlaydi (`services/balance.ts`), ya'ni ro'yxatda aynan shuncha obyekt chiqadi.
 *
 * ⚠️ Hudud havolalarida `hududiy=1` YO'Q — ataylab: bu hisobotda hudud obyekt
 * JOYLASHGAN hudud (respublika tashkilotlari obyektlari ham kiradi), hisobotdagi
 * rasmiy jadval qoidasidan farqli.
 */

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const CELL = "px-3 py-2.5 text-center tabular-nums";
const ROW_LINE = "border-b border-slate-100";
const NUM_LINK = "font-medium text-[var(--cobalt)] underline-offset-2 hover:underline";
const ZERO = "text-slate-300";
const TOTALS_ROW = "bg-[var(--gold-lighter)] font-bold text-[var(--navy)]";
const TOTALS_LINE = "border-b-2 border-[var(--gold)]";
const CARD =
  "mt-6 rounded-2xl bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";
const BTN =
  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900 hover:ring-slate-300";

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

export default async function BalansPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireSection("balans");
  const sp = await searchParams;

  const current = currentMonthTashkent();
  const oyRaw = str(sp.oy);
  const oy = oyRaw && monthRange(oyRaw) ? oyRaw : current;
  const range = monthRange(oy)!;
  const prev = monthRange(prevMonth(oy))!;

  // Soha — faqat mavjud nom qabul qilinadi (aks holda jimgina bo'sh jadval chiqardi).
  const sohaNames = await listSourceNames();
  const sohaRaw = str(sp.soha);
  const soha = sohaRaw && sohaNames.includes(sohaRaw) ? sohaRaw : undefined;

  const report = await balanceByRegion(user, {
    from: range.from,
    to: range.to,
    prevFrom: prev.from,
    prevTo: prev.to,
    soha,
  });

  // Ro'yxat havolasi — hisobot bilan AYNAN bir xil filtr.
  const listParams = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ balansFrom: range.from, balansTo: range.to });
    for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
    return p.toString();
  };
  const listHref = (extra: Record<string, string | undefined> = {}) =>
    `/dashboard/objects?${listParams({ soha, ...extra })}`;
  const exportHref = withBase(`/api/export/objects?${listParams({ soha })}`);

  const pageHref = (params: { oy?: string; soha?: string }) => {
    const p = new URLSearchParams();
    if (params.oy && params.oy !== current) p.set("oy", params.oy);
    if (params.soha) p.set("soha", params.soha);
    const qs = p.toString();
    return qs ? `/dashboard/balans?${qs}` : "/dashboard/balans";
  };

  const diff = report.totals.total - report.previousTotal;
  const isCurrent = oy === current;
  // Bugun — Toshkent vaqti bo'yicha (server UTC'da; "oy tugamagan" izohi uchun).
  const today = parseIsoDay(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date()));

  const num = (n: number, href: string) =>
    n > 0 ? (
      <Link href={href} className={NUM_LINK}>
        {nf(n)}
      </Link>
    ) : (
      <span className={ZERO}>0</span>
    );

  const sohaTabs: { key: string; label: string; href: string }[] = [
    ...[...sohaNames]
      .sort((a, b) => (a === "Ijara markazi" ? -1 : b === "Ijara markazi" ? 1 : 0))
      .map((n) => ({ key: n, label: n, href: pageHref({ oy, soha: n }) })),
    { key: "", label: "Hammasi", href: pageHref({ oy }) },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
            <CalendarPlus className="h-5 w-5" style={{ color: "var(--gold)" }} />
            Balansga olinganlar
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {monthLabel(oy)} · {soha ?? "barcha manbalar"} · hududlar kesimida
          </p>
        </div>

        {/* Oddiy GET forma — `action` berilmaydi (basePath saqlanadi, CLAUDE.md). */}
        <form className="flex flex-wrap items-end gap-2">
          {soha ? <input type="hidden" name="soha" value={soha} /> : null}
          <label className="text-xs font-medium text-slate-600">
            <span className="mb-1 flex items-center gap-1">
              <CalendarRange className="h-3.5 w-3.5" style={{ color: "var(--gold)" }} />
              Oy
            </span>
            <input
              type="month"
              name="oy"
              defaultValue={oy}
              max={current}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ background: "var(--navy)" }}
          >
            Ko'rsatish
          </button>
        </form>
      </div>

      {sohaNames.length > 1 ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Layers3 className="h-3.5 w-3.5" style={{ color: "var(--gold)" }} />
            Manba
          </span>
          <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
            {sohaTabs.map((t) => {
              const active = t.key === (soha ?? "");
              return (
                <Link
                  key={t.key || "all"}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all duration-150 ease-out",
                    active
                      ? "text-white shadow-[0_2px_10px_-3px_rgba(26,58,124,0.6)]"
                      : "text-slate-500 hover:bg-muted hover:text-slate-900",
                  ].join(" ")}
                  style={active ? { background: "var(--cobalt)" } : undefined}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label={`Balansga olingan — ${monthLabel(oy)}`}
          value={nf(report.totals.total)}
          accent={BRAND.cobalt}
          icon={CalendarPlus}
          href={report.totals.total > 0 ? listHref() : undefined}
          footer={
            isCurrent && today
              ? `${dmy(parseIsoDay(range.from)!)} — ${dmy(today)} (oy tugamagan)`
              : `${dmy(parseIsoDay(range.from)!)} — ${dmy(parseIsoDay(range.to)!)}`
          }
        />
        <KpiCard
          label={`O'tgan oy — ${monthLabel(prevMonth(oy))}`}
          value={nf(report.previousTotal)}
          accent={BRAND.navyMid}
          footer={
            diff === 0
              ? "o'zgarish yo'q"
              : `${diff > 0 ? "+" : "−"}${nf(Math.abs(diff))} (tanlangan oyda ${diff > 0 ? "ko'proq" : "kamroq"})`
          }
        />
        <KpiCard
          label="Sanasi aniqlanmagan"
          value={nf(report.undated)}
          accent={BRAND.gold}
          icon={CircleHelp}
          footer="kadastrda huquq sanasi yo'q — hisobotga kirmaydi"
        />
      </div>

      <section className={CARD}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--navy)" }}>
            <MapPin className="h-4 w-4" style={{ color: "var(--gold)" }} />
            Hududlar kesimi — {monthLabel(oy)}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link href={listHref()} className={BTN}>
              <List className="h-3.5 w-3.5" />
              Ro'yxatni ko'rish
            </Link>
            <a href={exportHref} className={BTN}>
              <Download className="h-3.5 w-3.5" />
              Ro'yxatni Excel'ga yuklash
            </a>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-[var(--navy-mid)] text-white">
              <tr className="text-xs tracking-wide">
                <th className="w-14 px-2 py-2.5 text-center font-semibold">№</th>
                <th className="py-2.5 pl-1 pr-4 text-left font-semibold">Hududlar nomi</th>
                {report.sohas.length > 1
                  ? report.sohas.map((s) => (
                      <th key={s} className="px-3 py-2.5 text-center font-semibold">
                        {s}
                      </th>
                    ))
                  : null}
                <th className="px-3 py-2.5 text-center font-semibold">Jami</th>
              </tr>
            </thead>
            <tbody>
              {/* JAMI — birinchi qator (rasmiy hisobot shakli). */}
              <tr className={TOTALS_ROW}>
                <td className={`${TOTALS_LINE} px-2 py-3`} />
                <td className={`${TOTALS_LINE} whitespace-nowrap py-3 pl-1 pr-4 tracking-wide`}>J A M I:</td>
                {report.sohas.length > 1
                  ? report.sohas.map((s) => (
                      <td key={s} className={`${CELL} ${TOTALS_LINE} py-3`}>
                        {num(report.totals.bySoha[s] ?? 0, listHref({ soha: s }))}
                      </td>
                    ))
                  : null}
                <td className={`${CELL} ${TOTALS_LINE} py-3`}>{num(report.totals.total, listHref())}</td>
              </tr>
              {report.rows.map((r, i) => (
                <tr key={r.regionId} className="transition-colors hover:bg-[#eef4fc]">
                  <td className={`${ROW_LINE} px-2 py-2.5 text-center text-xs text-muted-foreground`}>{i + 1}</td>
                  <td className={`${ROW_LINE} whitespace-nowrap py-2.5 pl-1 pr-4`}>{r.regionName}</td>
                  {report.sohas.length > 1
                    ? report.sohas.map((s) => (
                        <td key={s} className={`${CELL} ${ROW_LINE}`}>
                          {num(r.bySoha[s] ?? 0, listHref({ soha: s, region: r.regionId }))}
                        </td>
                      ))
                    : null}
                  <td className={`${CELL} ${ROW_LINE} font-semibold`}>
                    {num(r.total, listHref({ region: r.regionId }))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          <strong>Sana</strong> — kadastrda obyektga huquq (doimiy foydalanish, operativ boshqaruv va h.k.)
          ro'yxatdan o'tgan eng oxirgi sana. Obyekt bir tashkilotdan boshqasiga o'tkazilganda huquq qayta
          ro'yxatdan o'tadi va qabul qiluvchi tashkilotda shu oyda hisoblanadi. <strong>Hudud</strong> — obyekt
          joylashgan hudud (respublika darajasidagi tashkilotlar obyektlari ham shu hududga kiradi). Balansdan
          chiqarilgan obyektlar kirmaydi. Son bosilsa — ro'yxat ochiladi.
        </p>
      </section>
    </div>
  );
}
