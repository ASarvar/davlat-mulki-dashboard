import { Fragment } from "react";
import Link from "next/link";
import {
  Building2,
  TrendingDown,
  Percent,
  CheckCircle2,
  Clock3,
  XCircle,
  RefreshCw,
  MapPin,
  Tags,
  ArrowUpRight,
  Download,
  type LucideIcon,
  MapPinPlus,
  Layers,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, isAdmin } from "@/lib/authz";
import {
  getDashboardStats,
  computeDistrictStats,
  buildDashboardColumns,
  computeDistrictRentStats,
  type DashboardColumnSub,
  type RegionCategoryRow,
  type RegionStat,
} from "@/server/services/stats";
import { listSourceNames } from "@/server/services/sources";
import { SyncRunStatusBadge } from "@/components/badges";
import { SourceFilter, ALL_SOHA } from "./SourceFilter";

type Tone = "navy" | "gold" | "green" | "amber" | "red" | "cobalt";

const TONES: Record<Tone, { bg: string; color: string }> = {
  navy: { bg: "rgba(7,16,43,0.06)", color: "var(--navy)" },
  cobalt: { bg: "rgba(26,58,124,0.10)", color: "var(--cobalt)" },
  gold: { bg: "rgba(200,169,110,0.18)", color: "#8a6d34" },
  green: { bg: "rgba(16,185,129,0.12)", color: "#047857" },
  amber: { bg: "rgba(245,158,11,0.12)", color: "#b45309" },
  red: { bg: "rgba(239,68,68,0.10)", color: "#b91c1c" },
};

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone: Tone;
  href?: string;
}) {
  const t = TONES[tone];
  const card = (
    <div className="group h-full rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p
            className="mt-2 text-3xl font-bold tracking-tight"
            style={{ color: "var(--navy)" }}
          >
            {value}
          </p>
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ background: t.bg }}
        >
          <Icon className="h-5 w-5" style={{ color: t.color }} />
        </div>
      </div>
      {href ? (
        <p className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          Batafsil <ArrowUpRight className="h-3 w-3" />
        </p>
      ) : null}
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <h2
      className="flex items-center gap-2 text-sm font-semibold"
      style={{ color: "var(--navy)" }}
    >
      <Icon className="h-4 w-4" style={{ color: "var(--gold)" }} />
      {children}
    </h2>
  );
}

/**
 * Kategoriyalar jadvalining bitta qatori. Hudud va TUMAN qatorlari uchun BIR XIL —
 * shuning uchun ustun mantiqi (COLUMNS, kat 4/6 qo'shimcha ustunlari, "To'liq ijara")
 * faqat shu yerda yoziladi. `scope` — drill-down havolasining filtr qismi
 * ("region=..." yoki "region=...&district=...").
 */
function CategoryTableRow({
  row,
  columns,
  zebra,
  objHref,
  scope,
  nf,
  km,
  label,
  lead,
}: {
  row: RegionCategoryRow;
  columns: ReturnType<typeof buildDashboardColumns>;
  zebra: string;
  objHref: (qs?: string) => string;
  scope: string;
  nf: (n: number, digits?: number) => string;
  km: (m2: number) => string;
  label: React.ReactNode;
  lead: React.ReactNode;
}) {
  const numCell = (value: number, qs: string, extraCls = "") => (
    <td className={`px-2 py-2.5 text-center tabular-nums ${extraCls}`}>
      {value === 0 ? (
        <span className="text-slate-300">0</span>
      ) : (
        <Link href={objHref(qs)} className="hover:underline" style={{ color: "var(--cobalt)" }}>
          {nf(value)}
        </Link>
      )}
    </td>
  );

  return (
    <tr className={`group border-b border-border last:border-0 hover:bg-slate-50/70 ${zebra}`}>
      <td className={`sticky left-0 z-10 ${zebra} py-2.5 pr-3 tabular-nums text-muted-foreground group-hover:bg-slate-50`}>
        {lead}
      </td>
      <td className={`sticky left-4 right-4 z-10 ${zebra} py-2.5 pr-4 whitespace-nowrap group-hover:bg-slate-50`}>
        {label}
      </td>
      <td className="py-2.5 text-center font-semibold tabular-nums">{nf(row.total)}</td>
      {columns.map((c) => (
        <Fragment key={c.code}>
          {c.subs.map((sub, si) => {
            const v = sub.get(row);
            const cls = `px-2 py-2.5 text-center tabular-nums ${si === 0 ? "border-l border-border" : ""}`;
            if (v === 0) {
              return (
                <td key={`${c.code}-${sub.label}`} className={cls}>
                  <span className="text-slate-300">0</span>
                </td>
              );
            }
            // Faqat "Soni" katagi ro'yxatga havola bo'ladi (maydon ustunlari — matn).
            return (
              <td key={`${c.code}-${sub.label}`} className={cls}>
                {sub.area ? (
                  <span className="text-muted-foreground">{km(v)}</span>
                ) : (
                  <Link
                    href={objHref(`${scope}&category=${c.code}`)}
                    className="hover:underline"
                    style={{ color: "var(--cobalt)" }}
                  >
                    {nf(v)}
                  </Link>
                )}
              </td>
            );
          })}
          {c.code === 4
            ? numCell(row.rentBreakdown.onAnyAuction.count, `${scope}&onAnyAuction=1`, "border-l border-border")
            : null}
          {c.code === 6
            ? numCell(row.rentBreakdown.onlyFreeOrPaidCategory.count, `${scope}&hasRentContract=1`, "border-l border-border")
            : null}
        </Fragment>
      ))}
      {numCell(row.rentBreakdown.fullyRented.count, `${scope}&fullyRented=1`, "border-l border-border")}
    </tr>
  );
}

/**
 * "Hududlar kesimi — ijara shartnomalari" jadvalining bitta qatori.
 * Hudud va TUMAN qatorlari uchun bir xil — ikkalasi ham `RegionStat` shaklida keladi.
 */
function RentTableRow({
  row,
  zebra,
  nf,
  label,
  lead,
}: {
  row: RegionStat;
  zebra: string;
  nf: (n: number, digits?: number) => string;
  label: React.ReactNode;
  lead: React.ReactNode;
}) {
  return (
    <tr className={`border-b border-border last:border-0 hover:bg-slate-50/70 ${zebra}`}>
      <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">{lead}</td>
      <td className="py-2.5 pr-4">{label}</td>
      <td className="py-2.5 pr-4 text-right tabular-nums">{nf(row.total)}</td>
      <td className="py-2.5 pr-4 text-right tabular-nums">{nf(row.rentedObjects)}</td>
      <td className="py-2.5 pr-4 text-right tabular-nums">{nf(row.contractCount)}</td>
      <td className="py-2.5 pr-4 text-right tabular-nums">{nf(row.rentArea, 1)}</td>
      <td className="py-2.5 text-right tabular-nums">{nf(row.rentSum / 1_000_000, 1)}</td>
    </tr>
  );
}

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;

  // Manba (soha) kesimi. Obyektlar ro'yxatidagi filtr bilan bir xil `soha` nomi —
  // shunda jadvaldagi raqamni bosganda filtr saqlanib qoladi.
  const sohaList = await listSourceNames();
  const sohaRaw = str(sp.soha) || undefined;
  // ⚠️ Standart holat "Hammasi" emas — "Ijara markazi" (agar mavjud bo'lsa).
  // "Hammasi"ni ko'rish uchun ANIQ `?soha=__all__` kerak (SourceFilter shu havolani beradi);
  // aks holda sahifa birinchi ochilganda "Ijara markazi" tanlangan bo'lib turadi.
  const soha =
    sohaRaw === ALL_SOHA
      ? undefined
      : sohaRaw && sohaList.includes(sohaRaw)
        ? sohaRaw
        : !sohaRaw && sohaList.includes("Ijara markazi")
          ? "Ijara markazi"
          : undefined;

  // Qaysi hudud tumanlarga ochilgan (`?tuman=<regionId>`). Bir vaqtda bittasi —
  // jadval juda keng, hammasini ochish o'qishni qiyinlashtirardi.
  const tuman = str(sp.tuman) || undefined;

  // Aggregatlar keshlangan (tag: dashboard, TTL 60s; kesh kaliti manbaga bog'liq).
  // Oxirgi run — jonli. Tuman kesimi faqat ochilgan hudud uchun so'raladi (keshlanmaydi:
  // arzon va kamdan-kam chaqiriladi).
  const [s, latestRun, districts, districtRent] = await Promise.all([
    getDashboardStats(soha),
    prisma.syncRun.findFirst({ orderBy: { createdAt: "desc" } }),
    tuman ? computeDistrictStats(tuman, soha) : Promise.resolve([] as RegionCategoryRow[]),
    tuman ? computeDistrictRentStats(tuman, soha) : Promise.resolve([] as RegionStat[]),
  ]);

  // Drill-down havolalari manba filtrini olib yuradi.
  const sohaParam = soha ? `soha=${encodeURIComponent(soha)}` : "";
  const objHref = (qs = "") => {
    const parts = [qs, sohaParam].filter(Boolean);
    return `/dashboard/objects${parts.length ? `?${parts.join("&")}` : ""}`;
  };
  // Dashboard'ning o'ziga havola — manba tanlovini saqlab, tuman ochish/yopish.
  const dashHref = (expandRegionId?: string) => {
    const parts = [sohaParam, expandRegionId ? `tuman=${expandRegionId}` : ""].filter(Boolean);
    return `/dashboard${parts.length ? `?${parts.join("&")}` : ""}`;
  };

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
  // Rasmiy hisobot shakli: mingliklar ajratilgan, kerak bo'lsa o'nlik bilan.
  const nf = (n: number, digits = 0) =>
    n.toLocaleString("uz-UZ", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

  // 5 (Tekin foydalanish), 6 (Ijara shartnomasi bor) va 12 (Bo'sh maydoni bor) ustunlari
  // EFFEKTIV kategoriyadan emas, ijara XUSUSIYATIDAN hisoblanadi: obyekt sotilgan yoki
  // savdoda bo'lsa ham, ijara shartnomasi bo'lsa shu ustunda ko'rinadi.
  /** Maydonni ming m² da ko'rsatamiz (hisobot shakli shunday). */
  const km = (m2: number) => nf(m2 / 1000, 1);

  // Ustun tuzilishi markazlashtirilgan (stats.ts) — UI va Excel eksporti bir xil
  // mantiqni ishlatadi, aks holda ikkisi orasida tafovut paydo bo'lishi mumkin.
  const COLUMNS = buildDashboardColumns();

  // JAMI qatori — hududlar yig'indisi (har bir kichik ustun uchun alohida).
  const totalObjects = s.byRegionCategory.reduce((a, r) => a + r.total, 0);
  const sumSub = (sub: DashboardColumnSub) =>
    s.byRegionCategory.reduce((a, r) => a + sub.get(r), 0);
  // "Bo'sh turgan maydoni" kartasi — kat 11 (Bo'sh turgan, ijarasi umuman yo'q)
  // obyektlarining FOYDALI MAYDONI. `hasVacant.area` (kat 12 — "Bo'sh maydoni bor")
  // BILAN ARALASHTIRMANG: u ijara shartnomasi bor, lekin qisman bo'sh qolgan
  // obyektlarning bo'sh qismi — butunlay boshqa ustun.
  const vacantAreaTotal = s.byRegionCategory.reduce(
    (a, r) => a + r.rentBreakdown.vacant.usefulArea,
    0,
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            className="text-xl font-bold tracking-tight"
            style={{ color: "var(--navy)" }}
          >
            Boshqaruv paneli
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {soha
              ? `Manba kesimi: ${soha}`
              : "Davlat mulki obyektlari bo'yicha umumiy holat"}
          </p>
        </div>
        {/* SourceFilter + Sinxronizatsiya bitta guruh sifatida o'ng chetga tekislanadi —
            aks holda soha o'zgarganda sarlavha ostidagi matn uzunligi o'zgarib,
            `justify-between` bu ikkisini gorizontal siljitib qo'yardi. */}
        <div className="ml-auto flex items-center gap-3">
          <SourceFilter names={sohaList} current={soha} />
          {isAdmin(user.role) ? (
            <Link
              href="/dashboard/sync"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              style={{ background: "var(--cobalt)" }}
            >
              <RefreshCw className="h-4 w-4" />
              Sinxronizatsiya
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4  md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Jami obyektlar"
          value={s.total}
          icon={Building2}
          tone="navy"
          href={objHref()}
        />
        <StatCard
          label="Bo'sh turgan"
          value={s.inefficient}
          icon={TrendingDown}
          tone="gold"
          href={objHref("inefficient=1")}
        />
        <StatCard
          label="Bo'sh turgan maydoni"
          value={
            <span>
              {km(vacantAreaTotal)}{" "}
              <span className="text-sm font-normal">ming m²</span>
            </span>
          }
          icon={Layers}
          tone="cobalt"
        />
        {/* <StatCard label="Sinxronlangan" value={s.synced} icon={CheckCircle2} tone="green" /> */}
        {/* <StatCard label="Kutilmoqda" value={s.pending} icon={Clock3} tone="amber" /> */}
        {/* <StatCard label="Xato" value={s.failed} icon={XCircle} tone="red" /> */}
      </div>

      {/* Kategoriyalar kesimi — hududlar bo'yicha (JAMI yuqorida) */}
      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon={Tags}>
            Davlat obyektlaridan foydalanish markazi balansidagi obyektlar
          </SectionTitle>
          <a
            href={`/api/export/dashboard-categories${sohaParam ? `?${sohaParam}` : ""}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-slate-50 hover:text-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            Excelga eksport
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm left-4">
            <thead style={{ background: "var(--cobalt)", color: "#fff" }}>
              {/* 1-qator: kategoriya nomlari (kengaytirilganlari colSpan bilan) */}
              <tr className="text-center text-xs uppercase tracking-wide">
                <th
                  className="sticky left-0 z-10 py-2 pr-3 text-center align-middle font-bold"
                  style={{ background: "var(--cobalt)" }}
                  rowSpan={2}
                >
                  №
                </th>
                <th
                  className="sticky left-8 z-10 py-2 pr-4 text-center align-middle font-bold"
                  style={{ background: "var(--cobalt)" }}
                  rowSpan={2}
                >
                  Hududlar nomi
                </th>
                <th
                  className="py-2 px-4 text-center align-middle font-bold"
                  rowSpan={2}
                >
                  Jami
                </th>
                {COLUMNS.map((c) => (
                  <Fragment key={c.code}>
                    <th
                      colSpan={c.subs.length}
                      title={`${c.code}. ${c.nameUz}`}
                      className="border-l border-border px-2 py-2 text-center align-middle font-bold"
                    >
                      <span className="block text-[12px] font-medium normal-case leading-tight">
                        {c.short}
                      </span>
                    </th>
                    {c.code === 4 ? (
                      <th
                        className="border-l border-border px-2 py-2 text-center align-middle font-bold"
                        rowSpan={2}
                        title="Xususiylashtirish yoki ijara savdosida turgan obyektlar (ikkalasida ham bo'lgan obyekt faqat bir marta sanaladi)"
                      >
                        <span className="block text-[12px] font-medium normal-case leading-tight">
                          Auksion savdolarida (Xususiy. va Ijara)
                        </span>
                      </th>
                    ) : null}
                    {c.code === 6 ? (
                      <th
                        className="border-l border-border px-2 py-2 text-center align-middle font-bold"
                        rowSpan={2}
                        title="Tekin foydalanish yoki Ijara shartnomasi bor kategoriyalaridan biriga tegishli obyektlar"
                      >
                        <span className="block text-[12px] font-medium normal-case leading-tight">
                          Ijaraga berilgan obyektlar (Sotilgan / Savdodagilardan
                          tashqari)
                        </span>
                      </th>
                    ) : null}
                  </Fragment>
                ))}
                <th
                  className="border-l border-border px-2 py-2 text-center align-middle font-bold"
                  rowSpan={2}
                  title="Ijara shartnomasi bor (tekin foydalanish yoki pullik) VA foydali maydon to'liq band"
                >
                  <span className="block text-[12px] font-medium normal-case leading-tight">
                    To'liq ijara berilgan
                  </span>
                </th>
              </tr>
              {/* 2-qator: kichik ustunlar */}
              <tr className="border-b border-border text-center text-[10px]">
                {COLUMNS.map((c) =>
                  c.subs.map((sub, si) => (
                    <th
                      key={`${c.code}-${sub.label}`}
                      className={`px-2 py-1 text-center align-middle font-normal ${si === 0 ? "border-l border-border" : ""}`}
                    >
                      {c.subs.length > 1 ? sub.label : ""}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {/* JAMI — birinchi qator */}
              <tr
                className="border-b-2 font-bold"
                style={{
                  background: "rgba(200,169,110,0.14)",
                  borderColor: "var(--gold)",
                }}
              >
                <td
                  className="sticky left-0 z-10 py-3 pr-3"
                  style={{ background: "var(--gold-lighter)" }}
                />
                <td
                  className="sticky left-8 z-10 py-3 pr-4"
                  style={{
                    background: "var(--gold-lighter)",
                    color: "var(--navy)",
                  }}
                >
                  J A M I:
                </td>
                <td
                  className="py-3 text-center tabular-nums"
                  style={{ color: "var(--navy)" }}
                >
                  {nf(totalObjects)}
                </td>
                {COLUMNS.map((c) => (
                  <Fragment key={c.code}>
                    {c.subs.map((sub, si) => (
                      <td
                        key={`${c.code}-${sub.label}`}
                        className={`px-2 py-3 text-center tabular-nums ${si === 0 ? "border-l border-border" : ""}`}
                        style={{ color: "var(--navy)" }}
                      >
                        {sub.area ? km(sumSub(sub)) : nf(sumSub(sub))}
                      </td>
                    ))}
                    {c.code === 4 ? (
                      <td
                        className="border-l border-border px-2 py-3 text-center tabular-nums"
                        style={{ color: "var(--navy)" }}
                      >
                        {nf(
                          s.byRegionCategory.reduce(
                            (a, r) => a + r.rentBreakdown.onAnyAuction.count,
                            0,
                          ),
                        )}
                      </td>
                    ) : null}
                    {c.code === 6 ? (
                      <td
                        className="border-l border-border px-2 py-3 text-center tabular-nums"
                        style={{ color: "var(--navy)" }}
                      >
                        {nf(
                          s.byRegionCategory.reduce(
                            (a, r) =>
                              a + r.rentBreakdown.onlyFreeOrPaidCategory.count,
                            0,
                          ),
                        )}
                      </td>
                    ) : null}
                  </Fragment>
                ))}
                <td
                  className="border-l border-border px-2 py-3 text-center tabular-nums"
                  style={{ color: "var(--navy)" }}
                >
                  {nf(
                    s.byRegionCategory.reduce(
                      (a, r) => a + r.rentBreakdown.fullyRented.count,
                      0,
                    ),
                  )}
                </td>
              </tr>

              {s.byRegionCategory.map((r, i) => {
                // Zebra: juft qatorlar oq, toq qatorlar och-oltin (light-golden).
                const zebra =
                  i % 2 === 1 ? "bg-[var(--gold-lighter)]" : "bg-white";
                const expanded = tuman === r.regionId;
                return (
                  <Fragment key={r.regionId}>
                    <CategoryTableRow
                      row={r}
                      columns={COLUMNS}
                      zebra={zebra}
                      objHref={objHref}
                      scope={`region=${r.regionId}`}
                      nf={nf}
                      km={km}
                      label={
                        <Link
                          href={objHref(`region=${r.regionId}`)}
                          className="font-medium hover:underline"
                          style={{ color: "var(--cobalt)" }}
                        >
                          {r.name}
                        </Link>
                      }
                      lead={
                        // Tumanlarni ochish/yopish — server tomonda, `?tuman=` orqali.
                        <Link
                          href={expanded ? dashHref() : dashHref(r.regionId)}
                          scroll={false}
                          title={expanded ? "Tumanlarni yopish" : "Tumanlar bo'yicha"}
                          className="inline-flex items-center gap-1 tabular-nums text-muted-foreground hover:text-slate-700"
                        >
                          {expanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          {i + 1}
                        </Link>
                      }
                    />
                    {expanded
                      ? districts.map((d) => (
                          <CategoryTableRow
                            key={d.regionId}
                            row={d}
                            columns={COLUMNS}
                            zebra="bg-slate-50/60"
                            objHref={objHref}
                            scope={`region=${r.regionId}&district=${d.regionId}`}
                            nf={nf}
                            km={km}
                            lead={<span className="text-slate-300">·</span>}
                            label={
                              <Link
                                href={objHref(`region=${r.regionId}&district=${d.regionId}`)}
                                className="pl-4 text-[13px] hover:underline"
                                style={{ color: "var(--cobalt)" }}
                              >
                                {d.name}
                              </Link>
                            }
                          />
                        ))
                      : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Maydonlar <strong>ming m²</strong>da, "Soni" — obyektlar soni (bosilsa
          ro'yxat ochiladi).
        </p>
      </section>

      {/* Hududlar kesimi — rasmiy hisobot shakli (JAMI yuqorida) */}
      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon={MapPin}>
            Hududlar kesimi — ijara shartnomalari
          </SectionTitle>
          <a
            href="/api/export/dashboard-rent"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-slate-50 hover:text-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            Excelga eksport
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "var(--cobalt)", color: "#fff" }}>
              <tr className="text-xs uppercase tracking-wide">
                <th className="py-2 pr-3 text-center align-middle font-medium">
                  №
                </th>
                <th className="py-2 pr-4 text-left align-middle font-medium">
                  Hududlar nomi
                </th>
                <th className="py-2 pr-4 text-right align-middle font-medium">
                  Obyektlar soni
                  <span className="block text-[10px] font-normal normal-case">
                    (Kadastr agentligi)
                  </span>
                </th>
                <th className="py-2 pr-4 text-right align-middle font-medium">
                  Obyekt soni
                  <span className="block text-[10px] font-normal normal-case">
                    (ijaraga berilgan)
                  </span>
                </th>
                {/* <th className="py-2 pr-4 text-right font-medium">Ijaraga berilishi (%)</th> */}
                <th className="py-2 pr-4 text-right align-middle font-medium">
                  Shartnoma soni
                </th>
                <th className="py-2 pr-4 text-right align-middle font-medium">
                  Maydoni (kv.m)
                </th>
                <th className="py-2 text-right align-middle font-medium">
                  Yillik ijara summasi
                </th>
              </tr>
            </thead>
            <tbody>
              {/* JAMI — birinchi qator */}
              <tr
                className="border-b-2 font-bold"
                style={{
                  background: "rgba(200,169,110,0.14)",
                  borderColor: "var(--gold)",
                }}
              >
                <td className="py-3 pr-3" />
                <td className="py-3 pr-4" style={{ color: "var(--navy)" }}>
                  J A M I:
                </td>
                <td
                  className="py-3 pr-4 text-right tabular-nums"
                  style={{ color: "var(--navy)" }}
                >
                  {nf(s.totals.total)}
                </td>
                <td
                  className="py-3 pr-4 text-right tabular-nums"
                  style={{ color: "var(--navy)" }}
                >
                  {nf(s.totals.rentedObjects)}
                </td>
                {/* <td className="py-3 pr-4 text-right tabular-nums" style={{ color: "var(--navy)" }}>{s.totals.rentedPct}</td> */}
                <td
                  className="py-3 pr-4 text-right tabular-nums"
                  style={{ color: "var(--navy)" }}
                >
                  {nf(s.totals.contractCount)}
                </td>
                <td
                  className="py-3 pr-4 text-right tabular-nums"
                  style={{ color: "var(--navy)" }}
                >
                  {nf(s.totals.rentArea, 1)}
                </td>
                <td
                  className="py-3 text-right tabular-nums"
                  style={{ color: "var(--navy)" }}
                >
                  {nf(s.totals.rentSum / 1_000_000, 1)}
                </td>
              </tr>

              {s.byRegion.map((r, i) => {
                // Zebra: juft qatorlar oq, toq qatorlar och-oltin (light-golden).
                const zebra =
                  i % 2 === 1 ? "bg-[var(--gold-lighter)]" : "bg-white";
                const expanded = tuman === r.regionId;
                return (
                  <Fragment key={r.regionId}>
                    <RentTableRow
                      row={r}
                      zebra={zebra}
                      nf={nf}
                      label={
                        <Link
                          href={objHref(`region=${r.regionId}`)}
                          className="font-medium hover:underline"
                          style={{ color: "var(--cobalt)" }}
                        >
                          {r.name}
                        </Link>
                      }
                      lead={
                        // Birinchi jadval bilan BIR XIL `?tuman=` parametri — bittasini
                        // ochsangiz ikkalasi ham o'sha hududning tumanlarini ko'rsatadi.
                        <Link
                          href={expanded ? dashHref() : dashHref(r.regionId)}
                          scroll={false}
                          title={expanded ? "Tumanlarni yopish" : "Tumanlar bo'yicha"}
                          className="inline-flex items-center gap-1 tabular-nums text-muted-foreground hover:text-slate-700"
                        >
                          {expanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          {i + 1}
                        </Link>
                      }
                    />
                    {expanded
                      ? districtRent.map((d) => (
                          <RentTableRow
                            key={d.regionId}
                            row={d}
                            zebra="bg-slate-50/60"
                            nf={nf}
                            lead={<span className="text-slate-300">·</span>}
                            label={
                              <Link
                                href={objHref(`region=${r.regionId}&district=${d.regionId}`)}
                                className="pl-4 text-[13px] hover:underline"
                                style={{ color: "var(--cobalt)" }}
                              >
                                {d.name}
                              </Link>
                            }
                          />
                        ))
                      : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Yillik ijara summasi — <strong>mln so'm</strong>da. Maydon — kv.m.
        </p>
      </section>
    </div>
  );
}
