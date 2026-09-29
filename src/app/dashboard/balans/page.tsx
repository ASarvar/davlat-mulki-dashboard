import Link from "next/link";
import { CalendarPlus, CircleHelp, Download, Layers3, List, MapPin } from "lucide-react";
import { requireSection } from "@/server/services/sectionAccess";
import { prisma } from "@/lib/prisma";
import { userSourceScope } from "@/lib/authz";
import { ALL_SOHA } from "../SourceFilter";
import { MonthPicker } from "./MonthPicker";
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

const CARD =
  "mt-6 rounded-2xl bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";
const BTN =
  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900 hover:ring-slate-300";

/** Eng erta tanlanadigan oy (foydalanuvchi talabi, 2026-09-29). */
const MIN_MONTH = "2026-01";

/** Manba ranglari — hudud chizig'idagi bo'laklar va legenda. */
const SOHA_COLOR: Record<string, string> = {
  "Ijara markazi": BRAND.cobalt,
  "Davlat aktivlari agentligi": BRAND.gold,
  Direksiya: "#4a90a4",
};
const sohaColor = (s: string) => SOHA_COLOR[s] ?? "#94a3b8";

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
  // Tanlash oralig'i: MIN_MONTH — joriy oy (`"YYYY-MM"` satr sifatida solishtiriladi).
  const oy = oyRaw && monthRange(oyRaw) && oyRaw >= MIN_MONTH && oyRaw <= current ? oyRaw : current;
  const range = monthRange(oy)!;
  const prev = monthRange(prevMonth(oy))!;

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

  const report = await balanceByRegion(user, {
    from: range.from,
    to: range.to,
    prevFrom: prev.from,
    prevTo: prev.to,
    soha,
    sohaList: sohaNames,
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

  const pageHref = (params: { oy?: string; soha: string }) => {
    const p = new URLSearchParams();
    if (params.oy && params.oy !== current) p.set("oy", params.oy);
    p.set("soha", params.soha);
    const qs = p.toString();
    return qs ? `/dashboard/balans?${qs}` : "/dashboard/balans";
  };

  const isCurrent = oy === current;
  // Bugun — Toshkent vaqti bo'yicha (server UTC'da): joriy oy kartasida sana oralig'i bugun bilan tugaydi.
  const today = parseIsoDay(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date()));

  // ⚠️ Hududlar RASMIY tartibda (`Region.sortOrder`, `balanceByRegion` shunday qaytaradi) —
  // son bo'yicha saralanmaydi (foydalanuvchi talabi, 2026-09-29).
  const ranked = report.rows;
  const maxTotal = Math.max(1, ...ranked.map((r) => r.total));
  const half = Math.ceil(ranked.length / 2);
  const multiSoha = report.sohas.length > 1;

  const sohaTabs: { key: string; label: string; href: string }[] = [
    ...[...sohaNames]
      .sort((a, b) => (a === "Ijara markazi" ? -1 : b === "Ijara markazi" ? 1 : 0))
      .map((n) => ({ key: n, label: n, href: pageHref({ oy, soha: n }) })),
    { key: ALL_SOHA, label: "Hammasi", href: pageHref({ oy, soha: ALL_SOHA }) },
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
          {/* ⚠️ "Hammasi" ham yuboriladi — aks holda oy o'zgarganda standart sohaga qaytib qolardi. */}
          <input type="hidden" name="soha" value={soha ?? ALL_SOHA} />
          {/* Yorliqsiz (foydalanuvchi talabi) — ekran o'quvchi uchun `aria-label`.
              Balandlik tugma bilan bir xil: ikkalasi ham `h-9`. */}
          {/* `key={oy}` — sahifa boshqa oy bilan qayta chizilganda tanlagich holati yangilanadi. */}
          <MonthPicker key={oy} name="oy" value={oy} min={MIN_MONTH} max={current} />
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

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label={`Balansga olingan — ${monthLabel(oy)}`}
          value={nf(report.totals.total)}
          accent={BRAND.cobalt}
          icon={CalendarPlus}
          href={report.totals.total > 0 ? listHref() : undefined}
          footer={`${dmy(parseIsoDay(range.from)!)} — ${dmy(isCurrent && today ? today : parseIsoDay(range.to)!)}`}
        />
        <KpiCard
          label={`O'tgan oy — ${monthLabel(prevMonth(oy))}`}
          value={nf(report.previousTotal)}
          accent={BRAND.navyMid}
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

        {multiSoha ? (
          <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-600">
            {report.sohas.map((s) => (
              <Link
                key={s}
                href={listHref({ soha: s })}
                className="inline-flex items-center gap-1.5 transition hover:text-slate-900"
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: sohaColor(s) }} />
                {s}
                <span className="font-semibold tabular-nums text-slate-900">
                  {nf(report.totals.bySoha[s] ?? 0)}
                </span>
              </Link>
            ))}
          </div>
        ) : null}

        {/* Rasmiy tartib; katta ekranda ikki ustun (ustun bo'yicha to'ladi: 1–7 chapda, 8–14 o'ngda). */}
        <ol
          className="grid grid-cols-1 gap-x-10 lg:grid-flow-col lg:grid-cols-2"
          style={{ gridTemplateRows: `repeat(${half}, auto)` }}
        >
          {ranked.map((r, i) => {
            const empty = r.total === 0;
            const body = (
              <>
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-400">{i + 1}</span>
                <span
                  className={`w-28 shrink-0 truncate text-sm sm:w-40 ${empty ? "text-slate-400" : "font-medium text-slate-700"}`}
                >
                  {r.regionName}
                </span>
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className="flex h-full" style={{ width: `${(r.total / maxTotal) * 100}%` }}>
                    {report.sohas.map((s) => {
                      const n = r.bySoha[s] ?? 0;
                      return n > 0 ? (
                        <span
                          key={s}
                          title={`${s}: ${nf(n)}`}
                          className="h-full first:rounded-l-full last:rounded-r-full"
                          style={{ width: `${(n / r.total) * 100}%`, background: sohaColor(s) }}
                        />
                      ) : null;
                    })}
                  </span>
                </span>
                <span
                  className={`w-10 shrink-0 text-right text-sm tabular-nums ${empty ? "text-slate-300" : "font-semibold text-[var(--navy)]"}`}
                >
                  {nf(r.total)}
                </span>
              </>
            );
            return (
              <li key={r.regionId} className="border-b border-slate-100">
                {empty ? (
                  <div className="flex items-center gap-3 px-2 py-2.5">{body}</div>
                ) : (
                  <Link
                    href={listHref({ region: r.regionId })}
                    className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-[#eef4fc]"
                  >
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
