import Link from "next/link";
import { CalendarCheck, CalendarPlus, CircleHelp, Download, History, Layers3, List, MapPin } from "lucide-react";
import { requireSection } from "@/server/services/sectionAccess";
import { prisma } from "@/lib/prisma";
import { userSourceScope } from "@/lib/authz";
import { ALL_SOHA } from "../SourceFilter";
import { DatePicker } from "./DatePicker";
import { balanceByRegion, type Period, type PeriodKey } from "@/server/services/balance";
import { listSourceNames } from "@/server/services/sources";
import { KpiCard } from "@/components/ui/KpiCard";
import { BRAND } from "@/lib/chartColors";
import { nf } from "@/lib/format";
import { withBase } from "@/lib/basePath";
import { dmy, monthLabel, monthRange, parseIsoDay, todayTashkent } from "@/lib/balance";

/**
 * Balansga olingan obyektlar — hududlar kesimida (KPI uchun, 2026-09-28).
 *
 * Jadvalda uch ustun (2026-09-30): tanlangan kunning oyi, o'tgan oy va tanlangan kun.
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

/** Eng erta tanlanadigan sana (foydalanuvchi talabi, 2026-09-29: 2026-yil yanvaridan). */
const MIN_DAY = "2026-01-01";

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

export default async function BalansPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireSection("balans");
  const sp = await searchParams;

  const today = todayTashkent();
  // Tanlash oralig'i: MIN_DAY — bugun (`"YYYY-MM-DD"` satr sifatida solishtiriladi).
  // Eski `?oy=YYYY-MM` havolalari ham ishlaydi: o'sha oyning oxirgi kuni (joriy oyda — bugun).
  const kunRaw = str(sp.kun);
  const oyRaw = monthRange(str(sp.oy));
  const candidate = kunRaw && parseIsoDay(kunRaw) ? kunRaw.slice(0, 10) : oyRaw?.to;
  const kun = candidate && candidate >= MIN_DAY ? (candidate > today ? today : candidate) : today;
  const oy = kun.slice(0, 7);
  const po = prevMonth(oy);

  // Soha — hisobot bilan bir xil qoida: standart "Ijara markazi", "Hammasi" uchun ANIQ
  // `?soha=__all__`. Faqat mavjud nom qabul qilinadi (aks holda jimgina bo'sh jadval).
  // ⚠️ IJROCHI boshqa tashkilotni ko'rmaydi (`buildWhere`) — unga faqat o'z sohasi
  // ko'rsatiladi, aks holda Direksiya ijrochisi standart "Ijara markazi"da 0 ko'rardi.
  const ownScope = user.role === "IJROCHI" ? await userSourceScope(user) : null;
  const sohaNames = ownScope
    ? (
        await prisma.organizationSource.findMany({
          where: { id: { in: ownScope } },
          distinct: ["name"],
          select: { name: true },
        })
      ).map((s) => s.name)
    : await listSourceNames();
  const sohaRaw = str(sp.soha);
  const soha =
    sohaRaw === ALL_SOHA
      ? undefined
      : sohaRaw && sohaNames.includes(sohaRaw)
        ? sohaRaw
        : sohaNames.includes("Ijara markazi")
          ? "Ijara markazi"
          : undefined;

  const periods: Record<PeriodKey, Period> = {
    month: monthRange(oy)!,
    prev: monthRange(po)!,
    day: { from: kun, to: kun },
  };
  const report = await balanceByRegion(user, { periods, soha });

  // Ro'yxat havolasi — hisobot bilan AYNAN bir xil filtr.
  const listParams = (period: Period, extra: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams({ balansFrom: period.from, balansTo: period.to });
    for (const [k, v] of Object.entries({ soha, ...extra })) if (v) p.set(k, v);
    return p.toString();
  };
  const listHref = (key: PeriodKey, extra?: Record<string, string | undefined>) =>
    `/dashboard/objects?${listParams(periods[key], extra)}`;
  const exportHref = withBase(`/api/export/objects?${listParams(periods.month)}`);

  const pageHref = (params: { kun: string; soha: string }) => {
    const p = new URLSearchParams();
    if (params.kun !== today) p.set("kun", params.kun);
    p.set("soha", params.soha);
    return `/dashboard/balans?${p}`;
  };

  const kunLabel = dmy(parseIsoDay(kun)!);
  const monthEnd = oy === today.slice(0, 7) ? today : periods.month.to;

  const num = (n: number, href: string) =>
    n > 0 ? (
      <Link href={href} className={NUM_LINK}>
        {nf(n)}
      </Link>
    ) : (
      <span className={ZERO}>0</span>
    );

  const columns: { key: PeriodKey; label: string }[] = [
    { key: "month", label: monthLabel(oy) },
    { key: "prev", label: monthLabel(po) },
    { key: "day", label: kunLabel },
  ];

  const sohaTabs: { key: string; label: string; href: string }[] = [
    ...[...sohaNames]
      .sort((a, b) => (a === "Ijara markazi" ? -1 : b === "Ijara markazi" ? 1 : 0))
      .map((n) => ({ key: n, label: n, href: pageHref({ kun, soha: n }) })),
    { key: ALL_SOHA, label: "Hammasi", href: pageHref({ kun, soha: ALL_SOHA }) },
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
            {monthLabel(oy)} · {soha ?? "Barcha manbalar"}
          </p>
        </div>

        {/* Oddiy GET forma — `action` berilmaydi (basePath saqlanadi, CLAUDE.md). */}
        <form className="flex flex-wrap items-center gap-2">
          {/* ⚠️ "Hammasi" ham yuboriladi — aks holda sana o'zgarganda standart sohaga qaytib qolardi. */}
          <input type="hidden" name="soha" value={soha ?? ALL_SOHA} />
          {/* `key={kun}` — sahifa boshqa sana bilan qayta chizilganda tanlagich holati yangilanadi. */}
          <DatePicker key={kun} name="kun" value={kun} min={MIN_DAY} max={today} />
          <button
            type="submit"
            className="h-9 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
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
              const active = t.key === (soha ?? ALL_SOHA);
              return (
                <Link
                  key={t.key}
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

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={monthLabel(oy)}
          value={nf(report.totals.month)}
          accent={BRAND.cobalt}
          icon={CalendarPlus}
          href={report.totals.month > 0 ? listHref("month") : undefined}
          footer={`${dmy(parseIsoDay(periods.month.from)!)} — ${dmy(parseIsoDay(monthEnd)!)}`}
        />
        <KpiCard
          label={`O'tgan oy — ${monthLabel(po)}`}
          value={nf(report.totals.prev)}
          accent={BRAND.navyMid}
          icon={History}
          href={report.totals.prev > 0 ? listHref("prev") : undefined}
        />
        <KpiCard
          label={kunLabel}
          value={nf(report.totals.day)}
          accent={BRAND.cobalt}
          icon={CalendarCheck}
          href={report.totals.day > 0 ? listHref("day") : undefined}
        />
        <KpiCard
          label="Sanasi aniqlanmagan"
          value={nf(report.undated)}
          accent={BRAND.gold}
          icon={CircleHelp}
          href={
            report.undated > 0
              ? `/dashboard/objects?${new URLSearchParams({ balansNone: "1", ...(soha ? { soha } : {}) })}`
              : undefined
          }
        />
      </div>

      <section className={CARD}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--navy)" }}>
            <MapPin className="h-4 w-4" style={{ color: "var(--gold)" }} />
            Hududlar kesimi
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link href={listHref("month")} className={BTN}>
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
                {columns.map((c) => (
                  <th key={c.key} className="w-40 px-3 py-2.5 text-center font-semibold">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* JAMI — birinchi qator (rasmiy hisobot shakli). */}
              <tr className={TOTALS_ROW}>
                <td className={`${TOTALS_LINE} px-2 py-3`} />
                <td className={`${TOTALS_LINE} whitespace-nowrap py-3 pl-1 pr-4 tracking-wide`}>J A M I:</td>
                {columns.map((c) => (
                  <td key={c.key} className={`${CELL} ${TOTALS_LINE} py-3`}>
                    {num(report.totals[c.key], listHref(c.key))}
                  </td>
                ))}
              </tr>
              {report.rows.map((r, i) => (
                <tr key={r.regionId} className="transition-colors hover:bg-[#eef4fc]">
                  <td className={`${ROW_LINE} px-2 py-2.5 text-center text-xs text-muted-foreground`}>{i + 1}</td>
                  <td className={`${ROW_LINE} whitespace-nowrap py-2.5 pl-1 pr-4`}>{r.regionName}</td>
                  {columns.map((c) => (
                    <td key={c.key} className={`${CELL} ${ROW_LINE}`}>
                      {num(r[c.key], listHref(c.key, { region: r.regionId }))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
