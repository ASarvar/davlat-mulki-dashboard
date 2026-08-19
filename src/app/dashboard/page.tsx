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
  Droplets,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, isAdmin, userSourceScope } from "@/lib/authz";
import {
  getDashboardStats,
  computeDistrictStats,
  buildDashboardColumns,
  buildJamiColumn,
  buildOnlyFreeOrPaidColumn,
  computeDistrictRentStats,
  computeUtilityStats,
  computeDistrictUtilityStats,
  type DashboardColumnSub,
  type RegionCategoryRow,
  type RegionStat,
  type RegionUtilityRow,
  type StatsScope,
} from "@/server/services/stats";
import { listSourceNames } from "@/server/services/sources";
import { isLandSplitSoha } from "@/lib/sourceLabel";
import { env } from "@/lib/env";
import { SyncRunStatusBadge } from "@/components/badges";
import { SourceFilter, ALL_SOHA, OWN_SOHA } from "./SourceFilter";

type Tone = "navy" | "gold" | "green" | "amber" | "red" | "cobalt";

const TONES: Record<Tone, { bg: string; color: string }> = {
  navy: { bg: "rgba(7,16,43,0.06)", color: "var(--navy)" },
  cobalt: { bg: "rgba(26,58,124,0.10)", color: "var(--cobalt)" },
  gold: { bg: "rgba(200,169,110,0.18)", color: "#8a6d34" },
  green: { bg: "rgba(16,185,129,0.12)", color: "#047857" },
  amber: { bg: "rgba(245,158,11,0.12)", color: "#b45309" },
  red: { bg: "rgba(239,68,68,0.10)", color: "#b91c1c" },
};

// ── Jadval uslubi — IKKALA jadval uchun umumiy tokenlar ──
// ⚠️ Jadvallar `border-separate border-spacing-0` bilan quriladi (`border-collapse`
// EMAS): faqat shunda muzlatilgan (sticky) ustunlarning chegaralari gorizontal
// aylantirishda ham to'g'ri chiziladi. Shu sabab chegara har bir KATAKKA qo'yiladi,
// qatorga emas.
const ROW_LINE = "border-b border-slate-100";
/** Kategoriya guruhlari orasidagi vertikal ajratkich. */
const GROUP_LINE = "border-l border-slate-200/70";
const CELL = "px-3 py-2.5 text-center tabular-nums";
/** Qator ustiga kelganda — oddiy kataklar uchun (fon `tr`da). */
const ROW_HOVER = "transition-colors hover:bg-[#eef4fc]";
/** ...va muzlatilgan kataklar uchun (ularda o'z foni bor, `tr` foni ko'rinmaydi). */
const CELL_HOVER = "transition-colors group-hover:bg-[#eef4fc]";
/** Muzlatilgan ustunlar chetidagi soya — aylantirish chegarasini bildiradi. */
const STICKY_EDGE = "shadow-[6px_0_10px_-8px_rgba(15,23,42,0.35)]";
const NUM_LINK = "font-medium text-[var(--cobalt)] underline-offset-2 hover:underline";
const ZERO = "text-slate-300";
// JAMI qatori — rasmiy hisobot shakli: BIRINCHI qator, oltin fon (CLAUDE.md).
// ⚠️ Zebra endi neytral (slate), oltin esa FAQAT shu qatorda — ilgari ikkalasi ham
// `--gold-lighter` edi va JAMI oddiy qatordan deyarli farq qilmasdi.
const TOTALS_BG = "bg-[var(--gold-lighter)]";
const TOTALS_ROW = `${TOTALS_BG} font-bold text-[var(--navy)]`;
const TOTALS_LINE = "border-b-2 border-[var(--gold)]";
/** Ochilgan tuman qatorlari — hudud qatoridan ko'kish tus bilan ajraladi. */
const DISTRICT_BG = "bg-[#f5f8fd]";
/** Muzlatilgan № ustunining kengligi — thead/tbody/JAMI da BIR XIL bo'lishi shart. */
const LEAD_W = "w-14 min-w-[3.5rem]";
const NAME_LEFT = "left-14";
/** Bo'lim kartasi. */
const CARD =
  "mt-6 rounded-2xl bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";
const EXPORT_BTN =
  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900 hover:ring-slate-300";
/** "Yaqinda to'lov" oynasi (oy) — sarlavhada ko'rsatiladi, `.env` dan sozlanadi. */
const RECENT_MONTHS = env.UTILITY_RECENT_PAYMENT_MONTHS;

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
  jamiSubs,
  onlyFreeOrPaidSubs,
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
  /** "default"da bitta ustun (jami), "landSplit"da Yer/Bino — `buildJamiColumn()`. */
  jamiSubs: DashboardColumnSub[];
  /** "Ijaraga berilgan obyektlar" ustuni — `buildOnlyFreeOrPaidColumn()`. */
  onlyFreeOrPaidSubs: DashboardColumnSub[];
  zebra: string;
  objHref: (qs?: string) => string;
  scope: string;
  nf: (n: number, digits?: number) => string;
  km: (m2: number) => string;
  label: React.ReactNode;
  lead: React.ReactNode;
}) {
  const numCell = (value: number, qs: string, extraCls = "") => (
    <td className={`${CELL} ${ROW_LINE} ${extraCls}`}>
      {value === 0 ? (
        <span className={ZERO}>0</span>
      ) : (
        <Link href={objHref(qs)} className={NUM_LINK}>
          {nf(value)}
        </Link>
      )}
    </td>
  );

  // Bir nechta sub-ustunga ajraladigan qo'shimcha ustunlar uchun umumiy render
  // ("Jami" va "Ijaraga berilgan obyektlar" — `landSplit`da ikkalasi ham Yer/Bino'ga
  // bo'linadi). `baseQs` — kategoriya/xususiyat filtri, `sub.qsExtra` (masalan
  // "&isLand=1") shunga qo'shiladi.
  const subGroupCells = (subs: DashboardColumnSub[], keyPrefix: string, baseQs: string, bold = false) =>
    subs.map((sub, si) => {
      const v = sub.get(row);
      const cls = `${CELL} ${ROW_LINE} ${bold ? "font-semibold" : ""} ${si === 0 ? "" : GROUP_LINE}`;
      return (
        <td key={`${keyPrefix}-${sub.label}`} className={cls}>
          {v === 0 ? (
            <span className={ZERO}>0</span>
          ) : (
            <Link href={objHref(`${baseQs}${sub.qsExtra ?? ""}`)} className={NUM_LINK}>
              {nf(v)}
            </Link>
          )}
        </td>
      );
    });

  return (
    <tr className={`group ${zebra} ${ROW_HOVER}`}>
      <td
        className={`sticky left-0 z-20 ${LEAD_W} ${zebra} ${ROW_LINE} ${CELL_HOVER} px-2 py-2.5 text-center tabular-nums text-slate-400`}
      >
        {lead}
      </td>
      <td
        className={`sticky ${NAME_LEFT} z-20 ${zebra} ${ROW_LINE} ${CELL_HOVER} ${STICKY_EDGE} whitespace-nowrap py-2.5 pl-1 pr-4`}
      >
        {label}
      </td>
      {jamiSubs.length > 1 ? (
        subGroupCells(jamiSubs, "jami", scope, true)
      ) : (
        <td className={`${CELL} ${ROW_LINE} font-semibold text-slate-900`}>{nf(row.total)}</td>
      )}
      {columns.map((c) => (
        <Fragment key={c.code}>
          {c.subs.map((sub, si) => {
            const v = sub.get(row);
            const cls = `${CELL} ${ROW_LINE} ${si === 0 ? GROUP_LINE : ""}`;
            if (v === 0) {
              return (
                <td key={`${c.code}-${sub.label}`} className={cls}>
                  <span className={ZERO}>0</span>
                </td>
              );
            }
            // Faqat "Soni" katagi ro'yxatga havola bo'ladi (maydon ustunlari — matn).
            return (
              <td key={`${c.code}-${sub.label}`} className={cls}>
                {sub.area ? (
                  <span className="text-slate-500">{km(v)}</span>
                ) : (
                  <Link
                    href={objHref(`${scope}&category=${c.code}${sub.qsExtra ?? ""}`)}
                    className={NUM_LINK}
                  >
                    {nf(v)}
                  </Link>
                )}
              </td>
            );
          })}
          {c.code === 4
            ? numCell(row.rentBreakdown.onAnyAuction.count, `${scope}&onAnyAuction=1`, GROUP_LINE)
            : null}
          {c.code === 6 ? subGroupCells(onlyFreeOrPaidSubs, "ofp", `${scope}&hasRentContract=1`) : null}
        </Fragment>
      ))}
      {numCell(row.rentBreakdown.fullyRented.count, `${scope}&fullyRented=1`, GROUP_LINE)}
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
  const num = (v: string) => (
    <td className={`${ROW_LINE} py-2.5 pr-4 text-center tabular-nums`}>{v}</td>
  );

  return (
    <tr className={`${zebra} ${ROW_HOVER}`}>
      <td className={`${ROW_LINE} ${LEAD_W} px-2 py-2.5 text-center tabular-nums text-slate-400`}>
        {lead}
      </td>
      <td className={`${ROW_LINE} py-2.5 pl-1 pr-4`}>{label}</td>
      <td className={`${ROW_LINE} py-2.5 pr-4 text-center font-semibold tabular-nums text-slate-900`}>
        {nf(row.total)}
      </td>
      {num(nf(row.rentedObjects))}
      {num(nf(row.contractCount))}
      {num(nf(row.rentArea, 1))}
      <td className={`${ROW_LINE} py-2.5 text-center tabular-nums`}>
        {nf(row.rentSum / 1_000_000, 1)}
      </td>
    </tr>
  );
}

/**
 * "Bo'sh turgan obyektlarda kommunal xizmatlar" jadvalining bitta qatori.
 * Hudud va TUMAN qatorlari uchun bir xil — ikkalasi ham `RegionUtilityRow` shaklida keladi.
 *
 * ⚠️ Qatordagi BARCHA sonlar faqat "Bo'sh turgan" (kat 11) obyektlar bo'yicha, shuning
 * uchun har bir havolaga `category=11` qo'shiladi — usiz ro'yxatdagi son jadvaldagidan
 * katta chiqardi.
 */
function UtilityTableRow({
  row,
  zebra,
  nf,
  km,
  label,
  lead,
  scopeQs,
  objHref,
  vacantSuffix,
}: {
  row: RegionUtilityRow;
  zebra: string;
  nf: (n: number, digits?: number) => string;
  km: (m2: number) => string;
  label: React.ReactNode;
  lead: React.ReactNode;
  /** Qator doirasi — `region=<id>` / `tashkilot=<id>` / `region=..&district=..` */
  scopeQs: string;
  objHref: (qs?: string) => string;
  /** `&category=11` dan keyingi qo'shimcha shart (landSplit sohada `&isLand=0`). */
  vacantSuffix: string;
}) {
  const vacantQs = `${scopeQs}&category=11${vacantSuffix}`;
  // Nol qiymatlar havola bo'lmaydi — bo'sh ro'yxatga olib borardi.
  const cell = (value: number, utility?: string, extra = "", strong = false) => (
    <td className={`${ROW_LINE} ${CELL} ${extra}`}>
      {value > 0 ? (
        <Link
          href={objHref(utility ? `${vacantQs}&utility=${utility}` : vacantQs)}
          className={`${NUM_LINK}${strong ? " font-semibold" : ""}`}
        >
          {nf(value)}
        </Link>
      ) : (
        <span className={ZERO}>0</span>
      )}
    </td>
  );

  return (
    <tr className={`${zebra} ${ROW_HOVER}`}>
      <td className={`${ROW_LINE} ${LEAD_W} px-2 py-2.5 text-center tabular-nums text-slate-400`}>
        {lead}
      </td>
      <td className={`${ROW_LINE} py-2.5 pl-1 pr-4`}>{label}</td>
      {/* ── Bo'sh turgan obyektlarning asosiy ma'lumoti ── */}
      {cell(row.count, undefined, "font-semibold text-slate-900")}
      <td className={`${ROW_LINE} ${CELL}`}>
        {row.usefulArea > 0 ? km(row.usefulArea) : <span className={ZERO}>0</span>}
      </td>
      {/* ── Shundan kommunal abonenti topilganlar ── */}
      {cell(row.water, "water", GROUP_LINE)}
      {cell(row.gas, "gas")}
      {cell(row.electric, "electric")}
      {cell(row.anyUtility, "any", GROUP_LINE, true)}
      {cell(row.recentlyPaid, "recentlyPaid", "", true)}
      {cell(row.unchecked, "unchecked")}
    </tr>
  );
}

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;

  // ── Rol doirasi ──
  // ⚠️ IJROCHI va MODERATOR uchun doira TURLICHA ishlaydi:
  //  - IJROCHI  → QAT'IY cheklov: boshqa tashkilotni umuman ko'ra olmaydi.
  //  - MODERATOR → faqat STANDART tanlov: sahifa ochilganda o'z tashkiloti ko'rinadi,
  //    lekin "Manba" tugmalaridan boshqasini (yoki "Hammasi"ni) tanlab, kuzatuvchi kabi
  //    hamma narsani ko'ra oladi (foydalanuvchi qarori, 2026-07-31). Tasdiqlash huquqi
  //    baribir o'z tashkilotlari bilan chegaralangan — u `assertSourceWriteAccess`da.
  const roleScope = await userSourceScope(user);
  const hardScope = user.role === "IJROCHI" ? roleScope : null;
  const defaultScope = user.role === "MODERATOR" ? roleScope : null;

  const ownSources =
    roleScope === null
      ? null
      : await prisma.organizationSource.findMany({
          where: { id: { in: roleScope } },
          select: { name: true, regionId: true },
        });

  // Manba (soha) kesimi. Obyektlar ro'yxatidagi filtr bilan bir xil `soha` nomi —
  // shunda jadvaldagi raqamni bosganda filtr saqlanib qoladi.
  // ⚠️ Faqat QAT'IY cheklangan (IJROCHI) uchun ro'yxat qisqartiriladi — moderator
  // barcha sohalarni ko'radi, aks holda boshqasiga o'ta olmasdi.
  const sohaList = hardScope && ownSources
    ? [...new Set(ownSources.map((s) => s.name))].sort()
    : await listSourceNames();
  const sohaRaw = str(sp.soha) || undefined;

  // ⚠️ MODERATOR "Manba" tugmalaridan biror narsa TANLAGAN bo'lsa (jumladan "Hammasi"),
  // uning standart doirasi bekor qilinadi — shunda u boshqa hududlarni ham ko'ra oladi.
  // Hech narsa tanlanmagan bo'lsa (sahifa endi ochilgan) standart doira qo'llanadi.
  const usingDefaultScope = defaultScope !== null && sohaRaw === undefined;
  const effectiveSourceIds = hardScope ?? (usingDefaultScope ? defaultScope : null);

  // ⚠️ Standart holat "Hammasi" emas — "Ijara markazi" (agar mavjud bo'lsa).
  // "Hammasi"ni ko'rish uchun ANIQ `?soha=__all__` kerak (SourceFilter shu havolani beradi).
  // ⚠️ Moderatorning standart doirasi ishlayotganda soha standarti QO'LLANMAYDI: uning
  // tashkiloti boshqa sohada bo'lsa (masalan "Davlat aktivlari agentligi"), ikkalasi AND
  // bo'lib natija bo'sh chiqardi. U holatda doira o'zi yetarli filtr.
  const soha =
    sohaRaw === ALL_SOHA
      ? undefined
      : sohaRaw && sohaList.includes(sohaRaw)
        ? sohaRaw
        : !sohaRaw && !usingDefaultScope && sohaList.includes("Ijara markazi")
          ? "Ijara markazi"
          : undefined;

  // Qaysi hudud tumanlarga ochilgan (`?tuman=<regionId>`). Bir vaqtda bittasi —
  // jadval juda keng, hammasini ochish o'qishni qiyinlashtirardi.
  //
  // ⚠️ Hududiy boshqarmaga biriktirilgan foydalanuvchi (masalan "Ijara markazi — Andijon")
  // uchun hudud jadvali bitta qatordan iborat bo'lardi, shuning uchun uning hududi
  // TUMANLAR kesimida avtomatik ochiladi. Respublika darajasidagi tashkilot (regionId
  // null) yoki bir nechta hudud bo'lsa — avtomatik ochilmaydi, foydalanuvchi o'zi tanlaydi.
  const scopedRegionIds =
    hardScope || usingDefaultScope ? [...new Set((ownSources ?? []).map((s) => s.regionId))] : [];
  // Rol doirasi bitta hududni ANIQLAB bermasa (masalan cheklovsiz admin), tanlangan
  // SOHA o'zi bitta hududga tegishli bo'lsa ham xuddi shunday avtomatik ochiladi —
  // masalan Direksiya endi doim faqat Toshkent sh.ga cheklangan (`restrictedRegionId`).
  const sohaSourceRegionIds =
    soha && scopedRegionIds.length !== 1
      ? [
          ...new Set(
            (
              await prisma.organizationSource.findMany({
                where: { name: soha, ...(effectiveSourceIds ? { id: { in: effectiveSourceIds } } : {}) },
                select: { regionId: true, restrictedRegionId: true },
              })
              // `regionId` bo'lmasa (respublika darajasidagi manba) `restrictedRegionId`ga
              // qaraymiz — masalan Direksiya doim regionId=null, lekin restrictedRegionId
              // Toshkent sh.ni ko'rsatadi (`enqueue.ts`dagi fan-out cheklovi bilan bir xil manba).
            ).map((s) => s.regionId ?? s.restrictedRegionId),
          ),
        ]
      : [];
  const singleRegionCandidates = scopedRegionIds.length > 0 ? scopedRegionIds : sohaSourceRegionIds;
  const autoTuman =
    singleRegionCandidates.length === 1 && singleRegionCandidates[0] != null
      ? singleRegionCandidates[0]
      : undefined;
  // `?tuman=none` — avtomatik ochilishni bekor qilish uchun (hudud qatorini yopish).
  const tumanRaw = str(sp.tuman) || undefined;
  const tuman = tumanRaw === "none" ? undefined : (tumanRaw ?? autoTuman);

  // Qaysi "Manba" tugmasi yonib turadi. Serverda hisoblanadi, chunki "Mening tashkilotim"
  // ham, "Hammasi" ham `soha = undefined` beradi — faqat `soha`dan ajratib bo'lmaydi.
  const activeSourceKey = usingDefaultScope ? OWN_SOHA : (soha ?? ALL_SOHA);

  // Soha filtri + rol doirasi BIRGA (AND) — kesh kaliti ikkalasini ham o'z ichiga oladi.
  const scope: StatsScope = { sourceName: soha, sourceIds: effectiveSourceIds };

  // Aggregatlar keshlangan (tag: dashboard, TTL 60s; kesh kaliti doiraga bog'liq).
  // Oxirgi run — jonli. Tuman kesimi faqat ochilgan hudud uchun so'raladi (keshlanmaydi:
  // arzon va kamdan-kam chaqiriladi).
  const [s, latestRun, districts, districtRent, utilityRows, districtUtility] = await Promise.all([
    getDashboardStats(scope),
    prisma.syncRun.findFirst({ orderBy: { createdAt: "desc" } }),
    tuman ? computeDistrictStats(tuman, scope) : Promise.resolve([] as RegionCategoryRow[]),
    tuman ? computeDistrictRentStats(tuman, scope) : Promise.resolve([] as RegionStat[]),
    // Kommunal jamlanma keshlanmaydi — u `getDashboardStats()` ichida emas, alohida
    // (o'z ustunlari bo'yicha mustaqil so'rov; boshqa jadvallarga ta'sir qilmaydi).
    computeUtilityStats(scope),
    tuman ? computeDistrictUtilityStats(tuman, scope) : Promise.resolve([] as RegionUtilityRow[]),
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
  // "landSplit" — FAQAT Davlat aktivlari agentligi/Direksiya tanlanganda (7/9/10 yo'q,
  // 1-4 va Jami Yer/Bino'ga ajraladi, 11/12 faqat bino bo'yicha).
  const variant = isLandSplitSoha(soha) ? "landSplit" : "default";
  const COLUMNS = buildDashboardColumns(variant);
  const jamiSubs = buildJamiColumn(variant);
  const onlyFreeOrPaidSubs = buildOnlyFreeOrPaidColumn(variant);

  // ⚠️ Cheklangan foydalanuvchi (bitta tashkilot) YOKI aniq bitta SOHA tanlanganda
  // (masalan Direksiya — endi doim bitta hududga cheklangan) bo'sh hududlar yashiriladi.
  // Cheklovsiz + "Hammasi"da har bir hududda obyekt bor, rasmiy hisobot shakli (14 hudud)
  // o'zgarmaydi.
  const hideZeroRows = effectiveSourceIds !== null || soha !== undefined;
  const catRows = hideZeroRows ? s.byRegionCategory.filter((r) => r.total > 0) : s.byRegionCategory;
  const rentRows = hideZeroRows ? s.byRegion.filter((r) => r.total > 0) : s.byRegion;
  // Bitta hudud qolganda JAMI qatori shu qatorning aynan nusxasi bo'lardi — ko'rsatmaymiz.
  const showCatTotals = catRows.length > 1;
  const showRentTotals = rentRows.length > 1;
  // Kommunal jadval — boshqa ikkitasi bilan bir xil qoida (bo'sh hududlar yashiriladi,
  // bitta qator qolganda JAMI ko'rsatilmaydi — u o'sha qatorning nusxasi bo'lardi).
  // ⚠️ Bu yerda `count` — bo'sh turgan obyektlar soni (jadvalning butun mazmuni shu),
  // shuning uchun filtr ham o'shanga qarab: bo'sh turgan obyekti yo'q hudud qatori
  // butunlay nol bo'lardi.
  const utilRows = hideZeroRows ? utilityRows.filter((r) => r.count > 0) : utilityRows;
  const showUtilTotals = utilRows.length > 1;
  const utilTotal = (f: (r: RegionUtilityRow) => number) => utilRows.reduce((a, r) => a + f(r), 0);
  // Kommunal modul hali umuman ishga tushirilmagan bo'lsa jadval o'rniga tushuntirish
  // ko'rsatiladi — 14 qator nol foydalanuvchini chalg'itardi. Mezon: bo'sh turgan
  // obyektlarning hammasi "tekshirilmagan" bo'lsa, demak modul hech qachon ishlamagan.
  const utilCheckedTotal = utilTotal((r) => r.count) - utilTotal((r) => r.unchecked);
  // ⚠️ landSplit sohada (Davlat aktivlari/Direksiya) kommunal jadval FAQAT binolarni
  // sanaydi (stats.ts → utilityRows), shuning uchun ro'yxat havolasi ham `isLand=0`
  // bilan cheklanishi SHART — aks holda bosilganda ro'yxatda yer uchastkalari ham
  // chiqib, son jadvaldagidan katta bo'lardi.
  const vacantSuffix = variant === "landSplit" ? "&isLand=0" : "";

  // Respublika darajasidagi qatorlar (masalan "Markaziy apparat") — `regionId` maydonida
  // haqiqiy hudud EMAS, `OrganizationSource.id` turadi: tuman ochish o'chiriladi va
  // drill-down "region=" o'rniga "tashkilot=" ishlatadi (properties.ts → buildWhere()).
  const isNational = (id: string) => s.nationalOrgIds.includes(id);

  // JAMI qatori — hududlar yig'indisi (har bir kichik ustun uchun alohida).
  const totalObjects = catRows.reduce((a, r) => a + r.total, 0);
  const sumSub = (sub: DashboardColumnSub) => catRows.reduce((a, r) => a + sub.get(r), 0);
  // "Bo'sh turgan" va "Bo'sh turgan maydoni" kartalari — kat 11 (Bo'sh turgan, ijarasi
  // umuman yo'q) obyektlari. `hasVacant.area` (kat 12 — "Bo'sh maydoni bor") BILAN
  // ARALASHTIRMANG: u ijara shartnomasi bor, lekin qisman bo'sh qolgan obyektlarning
  // bo'sh qismi — butunlay boshqa ustun.
  // ⚠️ "landSplit" variantida (Davlat aktivlari/Direksiya) kartalar ham jadvaldagi
  // 11-ustun bilan BIR XIL bo'lishi kerak — FAQAT bino (isLand=false), aks holda
  // kartada 2990 turib, jadvalda 600 chiqib, ikkalasi mos kelmasdi (foydalanuvchi topdi).
  const vacantCountTotal = catRows.reduce(
    (a, r) => a + (variant === "landSplit" ? r.rentBreakdown.vacant.buildingCount : r.counts["11"] ?? 0),
    0,
  );
  const vacantAreaTotal = catRows.reduce(
    (a, r) =>
      a + (variant === "landSplit" ? r.rentBreakdown.vacant.buildingUsefulArea : r.rentBreakdown.vacant.usefulArea),
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
          <SourceFilter names={sohaList} activeKey={activeSourceKey} showOwn={defaultScope !== null} />
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
          label={variant === "landSplit" ? "Bo'sh turgan (bino)" : "Bo'sh turgan"}
          value={vacantCountTotal}
          icon={TrendingDown}
          tone="gold"
          href={objHref(variant === "landSplit" ? "inefficient=1&isLand=0" : "inefficient=1")}
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
      <section className={CARD}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon={Tags}>
            {soha ? `${soha} balansidagi obyektlar` : "Davlat mulki balansidagi obyektlar"}
          </SectionTitle>
          <a
            href={`/api/export/dashboard-categories${sohaParam ? `?${sohaParam}` : ""}`}
            className={EXPORT_BTN}
          >
            <Download className="h-3.5 w-3.5" />
            Excelga eksport
          </a>
        </div>
        <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
          <table className="w-full border-separate border-spacing-0 text-sm">
            {/* 1-qator — navy (guruh nomlari), 2-qator — kobalt (kichik ustunlar):
                ikki daraja rangda ham ajralib turadi. */}
            <thead className="text-white">
              {/* 1-qator: kategoriya nomlari (kengaytirilganlari colSpan bilan) */}
              <tr className="text-center">
                <th
                  className={`sticky left-0 z-30 ${LEAD_W} bg-[var(--navy-mid)] px-2 py-2.5 text-center align-middle text-xs font-semibold uppercase tracking-wide`}
                  rowSpan={2}
                >
                  №
                </th>
                <th
                  className={`sticky ${NAME_LEFT} z-30 bg-[var(--navy-mid)] ${STICKY_EDGE} py-2.5 pl-1 pr-4 text-left align-middle text-xs font-semibold uppercase tracking-wide`}
                  rowSpan={2}
                >
                  Hududlar nomi
                </th>
                {jamiSubs.length > 1 ? (
                  <th
                    colSpan={jamiSubs.length}
                    className="bg-[var(--navy-mid)] px-3 py-2.5 text-center align-middle text-xs font-semibold uppercase tracking-wide"
                  >
                    Jami
                  </th>
                ) : (
                  <th
                    className="bg-[var(--navy-mid)] px-3 py-2.5 text-center align-middle text-xs font-semibold uppercase tracking-wide"
                    rowSpan={2}
                  >
                    Jami
                  </th>
                )}
                {COLUMNS.map((c) => (
                  <Fragment key={c.code}>
                    <th
                      colSpan={c.subs.length}
                      title={`${c.code}. ${c.nameUz}`}
                      className="border-l border-white/10 bg-[var(--navy-mid)] px-3 py-2.5 text-center align-middle"
                    >
                      <span className="block text-[12px] font-medium leading-tight">{c.short}</span>
                    </th>
                    {c.code === 4 ? (
                      <th
                        className="border-l border-white/10 bg-[var(--navy-mid)] px-3 py-2.5 text-center align-middle"
                        rowSpan={2}
                        title="Xususiylashtirish yoki ijara savdosida turgan obyektlar (ikkalasida ham bo'lgan obyekt faqat bir marta sanaladi)"
                      >
                        <span className="block max-w-[9rem] text-[12px] font-medium leading-tight">
                          Auksion savdolarida (Xususiy. va Ijara)
                        </span>
                      </th>
                    ) : null}
                    {c.code === 6 ? (
                      <th
                        className="border-l border-white/10 bg-[var(--navy-mid)] px-3 py-2.5 text-center align-middle"
                        colSpan={onlyFreeOrPaidSubs.length}
                        rowSpan={onlyFreeOrPaidSubs.length > 1 ? 1 : 2}
                        title="Tekin foydalanish yoki Ijara shartnomasi bor kategoriyalaridan biriga tegishli obyektlar"
                      >
                        <span className="block max-w-[10rem] text-[12px] font-medium leading-tight">
                          Ijaraga berilgan obyektlar (Sotilgan / Savdodagilardan tashqari)
                        </span>
                      </th>
                    ) : null}
                  </Fragment>
                ))}
                <th
                  className="border-l border-white/10 bg-[var(--navy-mid)] px-3 py-2.5 text-center align-middle"
                  rowSpan={2}
                  title="Ijara shartnomasi bor (tekin foydalanish yoki pullik) VA foydali maydon to'liq band"
                >
                  <span className="block max-w-[7rem] text-[12px] font-medium leading-tight">
                    To&apos;liq ijara berilgan
                  </span>
                </th>
              </tr>
              {/* 2-qator: kichik ustunlar */}
              <tr className="text-center">
                {jamiSubs.length > 1
                  ? jamiSubs.map((sub, si) => (
                      <th
                        key={`jami-${sub.label}`}
                        className={`bg-[var(--cobalt)]  px-3 py-1.5 text-center align-middle text-[10px] font-medium tracking-wide text-white/75 ${si === 0 ? "" : "border-l border-white/10"}`}
                      >
                        {sub.label}
                      </th>
                    ))
                  : null}
                {COLUMNS.map((c) => (
                  <Fragment key={c.code}>
                    {c.subs.map((sub, si) => (
                      <th
                        key={`${c.code}-${sub.label}`}
                        className={`bg-[var(--cobalt)]  px-3 py-1.5 text-center align-middle text-[10px] font-medium tracking-wide text-white/75 ${si === 0 ? "border-l border-white/10" : ""}`}
                      >
                        {c.subs.length > 1 ? sub.label : ""}
                      </th>
                    ))}
                    {c.code === 6 && onlyFreeOrPaidSubs.length > 1
                      ? onlyFreeOrPaidSubs.map((sub, si) => (
                          <th
                            key={`ofp-${sub.label}`}
                            className={`bg-[var(--cobalt)]  px-3 py-1.5 text-center align-middle text-[10px] font-medium tracking-wide text-white/75 ${si === 0 ? "border-l border-white/10" : ""}`}
                          >
                            {sub.label}
                          </th>
                        ))
                      : null}
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* JAMI — birinchi qator. Bitta hudud qolganda ko'rsatilmaydi (nusxa bo'lardi). */}
              {showCatTotals ? (
              <tr className={TOTALS_ROW}>
                <td className={`sticky left-0 z-20 ${LEAD_W} ${TOTALS_BG} ${TOTALS_LINE} px-2 py-3`} />
                <td
                  className={`sticky ${NAME_LEFT} z-20 ${TOTALS_BG} ${TOTALS_LINE} ${STICKY_EDGE} whitespace-nowrap py-3 pl-1 pr-4 tracking-wide`}
                >
                  J A M I:
                </td>
                {jamiSubs.length > 1 ? (
                  jamiSubs.map((sub, si) => (
                    <td
                      key={`jami-${sub.label}`}
                      className={`${CELL} ${TOTALS_LINE} py-3 ${si === 0 ? "" : GROUP_LINE}`}
                    >
                      {nf(sumSub(sub))}
                    </td>
                  ))
                ) : (
                  <td className={`${CELL} ${TOTALS_LINE} py-3`}>{nf(totalObjects)}</td>
                )}
                {COLUMNS.map((c) => (
                  <Fragment key={c.code}>
                    {c.subs.map((sub, si) => (
                      <td
                        key={`${c.code}-${sub.label}`}
                        className={`${CELL} ${TOTALS_LINE} py-3 ${si === 0 ? GROUP_LINE : ""}`}
                      >
                        {sub.area ? km(sumSub(sub)) : nf(sumSub(sub))}
                      </td>
                    ))}
                    {c.code === 4 ? (
                      <td className={`${CELL} ${TOTALS_LINE} ${GROUP_LINE} py-3`}>
                        {nf(catRows.reduce((a, r) => a + r.rentBreakdown.onAnyAuction.count, 0))}
                      </td>
                    ) : null}
                    {c.code === 6
                      ? onlyFreeOrPaidSubs.map((sub, si) => (
                          <td
                            key={`ofp-${sub.label}`}
                            className={`${CELL} ${TOTALS_LINE} py-3 ${si === 0 ? GROUP_LINE : ""}`}
                          >
                            {nf(catRows.reduce((a, r) => a + sub.get(r), 0))}
                          </td>
                        ))
                      : null}
                  </Fragment>
                ))}
                <td className={`${CELL} ${TOTALS_LINE} ${GROUP_LINE} py-3`}>
                  {nf(catRows.reduce((a, r) => a + r.rentBreakdown.fullyRented.count, 0))}
                </td>
              </tr>
              ) : null}

              {catRows.map((r, i) => {
                // Zebra: neytral (oltin FAQAT JAMI qatorida — TOTALS_BG izohiga qarang).
                // ⚠️ Fon SHAFFOF BO'LMASLIGI shart: muzlatilgan (sticky) ustunlar
                // ostidan gorizontal aylantirilgan kataklar ko'rinib qolardi.
                const zebra = i % 2 === 1 ? "bg-slate-50" : "bg-white";
                const national = isNational(r.regionId);
                const expanded = !national && tuman === r.regionId;
                // Respublika darajasidagi qator (masalan "Markaziy apparat") haqiqiy
                // hudud EMAS — tumanlarga ochilmaydi, drill-down "tashkilot=" bilan.
                const rowScope = national ? `tashkilot=${r.regionId}` : `region=${r.regionId}`;
                return (
                  <Fragment key={r.regionId}>
                    <CategoryTableRow
                      row={r}
                      columns={COLUMNS}
                      jamiSubs={jamiSubs}
                      onlyFreeOrPaidSubs={onlyFreeOrPaidSubs}
                      zebra={zebra}
                      objHref={objHref}
                      scope={rowScope}
                      nf={nf}
                      km={km}
                      label={
                        <Link
                          href={objHref(rowScope)}
                          className="font-medium hover:underline"
                          style={{ color: "var(--cobalt)" }}
                        >
                          {r.name}
                        </Link>
                      }
                      lead={
                        national ? (
                          <span className="tabular-nums">{i + 1}</span>
                        ) : (
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
                        )
                      }
                    />
                    {expanded
                      ? districts.map((d) => (
                          <CategoryTableRow
                            key={d.regionId}
                            row={d}
                            columns={COLUMNS}
                            jamiSubs={jamiSubs}
                            onlyFreeOrPaidSubs={onlyFreeOrPaidSubs}
                            zebra={DISTRICT_BG}
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
              {catRows.length === 0 ? (
                <tr>
                  <td colSpan={99} className="py-10 text-center text-sm text-muted-foreground">
                    Sizning tashkilotingiz bo'yicha obyekt topilmadi.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Maydonlar <strong>ming m²</strong>da, "Soni" — obyektlar soni (bosilsa
          ro'yxat ochiladi).
        </p>
      </section>

      {/* Hududlar kesimi — rasmiy hisobot shakli (JAMI yuqorida) */}
      <section className={CARD}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon={MapPin}>
            Hududlar kesimi — ijara shartnomalari
          </SectionTitle>
          <a href="/api/export/dashboard-rent" className={EXPORT_BTN}>
            <Download className="h-3.5 w-3.5" />
            Excelga eksport
          </a>
        </div>
        <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-[var(--navy-mid)] text-white">
              <tr className="text-xs tracking-wide">
                <th className={`${LEAD_W} px-2 py-2.5 text-center align-middle font-semibold`}>
                  №
                </th>
                <th className="py-2.5 pl-1 pr-4 text-left align-middle font-semibold">
                  Hududlar nomi
                </th>
                <th className="py-2.5 pr-4 text-center align-middle font-semibold">
                  Obyektlar soni
                  <span className="block text-[10px] font-normal normal-case text-white/60">
                    (Kadastr agentligi)
                  </span>
                </th>
                <th className="py-2.5 pr-4 text-right align-middle font-semibold">
                  Obyekt soni
                  <span className="block text-[10px] font-normal normal-case text-white/60">
                    (ijaraga berilgan)
                  </span>
                </th>
                {/* <th className="py-2 pr-4 text-right font-medium">Ijaraga berilishi (%)</th> */}
                <th className="py-2.5 pr-4 text-center align-middle font-semibold">
                  Shartnoma soni
                </th>
                <th className="py-2.5 pr-4 text-center align-middle font-semibold">
                  Maydoni (kv.m)
                </th>
                <th className="py-2.5 pr-4 text-center align-middle font-semibold">
                  Yillik ijara summasi
                </th>
              </tr>
            </thead>
            <tbody>
              {/* JAMI — birinchi qator. Bitta hudud qolganda ko'rsatilmaydi (nusxa bo'lardi). */}
              {showRentTotals ? (
              <tr className={TOTALS_ROW}>
                <td className={`${TOTALS_LINE} ${LEAD_W} px-2 py-3`} />
                <td className={`${TOTALS_LINE} whitespace-nowrap py-3 pl-1 pr-4 tracking-wide`}>
                  J A M I:
                </td>
                <td className={`${TOTALS_LINE} py-3 pr-4 text-center tabular-nums`}>
                  {nf(s.totals.total)}
                </td>
                <td className={`${TOTALS_LINE} py-3 pr-4 text-center tabular-nums`}>
                  {nf(s.totals.rentedObjects)}
                </td>
                {/* <td className="py-3 pr-4 text-center tabular-nums">{s.totals.rentedPct}</td> */}
                <td className={`${TOTALS_LINE} py-3 pr-4 text-center tabular-nums`}>
                  {nf(s.totals.contractCount)}
                </td>
                <td className={`${TOTALS_LINE} py-3 pr-4 text-center tabular-nums`}>
                  {nf(s.totals.rentArea, 1)}
                </td>
                <td className={`${TOTALS_LINE} py-3 pr-4 text-center tabular-nums`}>
                  {nf(s.totals.rentSum / 1_000_000, 1)}
                </td>
              </tr>
              ) : null}

              {rentRows.map((r, i) => {
                // Zebra: neytral (oltin FAQAT JAMI qatorida — TOTALS_BG izohiga qarang).
                // ⚠️ Fon SHAFFOF BO'LMASLIGI shart: muzlatilgan (sticky) ustunlar
                // ostidan gorizontal aylantirilgan kataklar ko'rinib qolardi.
                const zebra = i % 2 === 1 ? "bg-slate-50" : "bg-white";
                const national = isNational(r.regionId);
                const expanded = !national && tuman === r.regionId;
                const rowScope = national ? `tashkilot=${r.regionId}` : `region=${r.regionId}`;
                return (
                  <Fragment key={r.regionId}>
                    <RentTableRow
                      row={r}
                      zebra={zebra}
                      nf={nf}
                      label={
                        <Link
                          href={objHref(rowScope)}
                          className="font-medium hover:underline"
                          style={{ color: "var(--cobalt)" }}
                        >
                          {r.name}
                        </Link>
                      }
                      lead={
                        national ? (
                          <span className="tabular-nums">{i + 1}</span>
                        ) : (
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
                        )
                      }
                    />
                    {expanded
                      ? districtRent.map((d) => (
                          <RentTableRow
                            key={d.regionId}
                            row={d}
                            zebra={DISTRICT_BG}
                            nf={nf}
                            lead={<span className="text-slate-300">·</span>}
                            label={
                              <Link
                                href={objHref(`region=${r.regionId}&district=${d.regionId}`)}
                                className="text-center text-[13px] hover:underline"
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
              {rentRows.length === 0 ? (
                <tr>
                  <td colSpan={99} className="py-10 text-center text-sm text-muted-foreground">
                    Sizning tashkilotingiz bo'yicha obyekt topilmadi.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Yillik ijara summasi — <strong>mln so'm</strong>da. Maydon — kv.m.
        </p>
      </section>

      {/* Bo'sh turgan obyektlar × kommunal xizmatlar */}
      <section className={CARD}>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon={Droplets}>
            Bo&apos;sh turgan obyektlarda kommunal xizmatlar mavjudligi
          </SectionTitle>
          <a href="/api/export/dashboard-utility" className={EXPORT_BTN}>
            <Download className="h-3.5 w-3.5" />
            Excelga eksport
          </a>
        </div>

        {utilCheckedTotal === 0 ? (
          <div className="rounded-xl bg-slate-50 px-5 py-8 text-center text-sm text-muted-foreground ring-1 ring-slate-200">
            Kommunal tekshiruv hali o'tkazilmagan. Sinxronizatsiya sahifasidagi{" "}
            <strong>&quot;Faqat holat yangilash&quot;</strong> bo'limida{" "}
            <strong>&quot;Kommunal: suv/gaz/elektr&quot;</strong> belgisini tanlab ishga tushiring.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead className="bg-[var(--navy-mid)] text-white">
                <tr className="text-xs tracking-wide">
                  <th rowSpan={2} className={`${LEAD_W} px-2 py-2.5 text-center align-middle font-semibold`}>
                    №
                  </th>
                  <th rowSpan={2} className="py-2.5 pl-1 pr-4 text-left align-middle font-semibold">
                    Hududlar nomi
                  </th>
                  <th colSpan={2} className="px-3 py-2 text-center font-semibold">
                    Bo&apos;sh turgan obyektlar
                  </th>
                  <th colSpan={3} className={`px-3 py-2 text-center font-semibold ${GROUP_LINE}`}>
                    Shundan kommunal abonenti bor
                  </th>
                  <th colSpan={3} className={`px-3 py-2 text-center font-semibold ${GROUP_LINE}`}>
                    Jamlanma
                  </th>
                </tr>
                <tr className="text-[11px] font-normal">
                  <th className="px-3 py-2 text-center font-medium">Soni</th>
                  <th className="px-3 py-2 text-center font-medium">
                    Foydali maydoni
                    <span className="block text-[10px] text-white/60">ming m²</span>
                  </th>
                  <th className={`px-3 py-2 text-center font-medium ${GROUP_LINE}`}>Suv</th>
                  <th className="px-3 py-2 text-center font-medium">Gaz</th>
                  <th className="px-3 py-2 text-center font-medium">Elektr</th>
                  <th className={`px-3 py-2 text-center font-medium ${GROUP_LINE}`}>
                    Kamida
                    <span className="block text-[10px] text-white/60">bittasi</span>
                  </th>
                  <th className="px-3 py-2 text-center font-medium">
                    Yaqinda
                    <span className="block text-[10px] text-white/60">to&apos;lov ({RECENT_MONTHS} oy)</span>
                  </th>
                  <th className="px-3 py-2 text-center font-medium">
                    Tekshiril-
                    <span className="block text-[10px] text-white/60">magan</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {showUtilTotals ? (
                  // JAMI qatoridagi sonlar ham havola — hududsiz, ya'ni butun doira
                  // bo'yicha ro'yxatni ochadi (foydalanuvchi talabi, 2026-08-17).
                  (() => {
                    const tCell = (value: number, utility?: string, extra = "") => (
                      <td className={`${TOTALS_LINE} ${CELL} ${extra}`}>
                        {value > 0 ? (
                          <Link
                            href={objHref(`category=11${vacantSuffix}${utility ? `&utility=${utility}` : ""}`)}
                            className="underline-offset-2 hover:underline"
                          >
                            {nf(value)}
                          </Link>
                        ) : (
                          nf(value)
                        )}
                      </td>
                    );
                    return (
                      <tr className={TOTALS_ROW}>
                        <td className={`${TOTALS_LINE} ${LEAD_W} px-2 py-3`} />
                        <td className={`${TOTALS_LINE} whitespace-nowrap py-3 pl-1 pr-4 tracking-wide`}>
                          J A M I:
                        </td>
                        {tCell(utilTotal((r) => r.count))}
                        <td className={`${TOTALS_LINE} ${CELL}`}>{km(utilTotal((r) => r.usefulArea))}</td>
                        {tCell(utilTotal((r) => r.water), "water", GROUP_LINE)}
                        {tCell(utilTotal((r) => r.gas), "gas")}
                        {tCell(utilTotal((r) => r.electric), "electric")}
                        {tCell(utilTotal((r) => r.anyUtility), "any", GROUP_LINE)}
                        {tCell(utilTotal((r) => r.recentlyPaid), "recentlyPaid")}
                        {tCell(utilTotal((r) => r.unchecked), "unchecked")}
                      </tr>
                    );
                  })()
                ) : null}

                {utilRows.map((r, i) => {
                  const zebra = i % 2 === 1 ? "bg-slate-50" : "bg-white";
                  const national = isNational(r.regionId);
                  const expanded = !national && tuman === r.regionId;
                  const rowScope = national ? `tashkilot=${r.regionId}` : `region=${r.regionId}`;
                  return (
                    <Fragment key={r.regionId}>
                      <UtilityTableRow
                        row={r}
                        zebra={zebra}
                        nf={nf}
                        km={km}
                        scopeQs={rowScope}
                        objHref={objHref}
                        vacantSuffix={vacantSuffix}
                        label={
                          // ⚠️ `category=11` SHART: bu jadvalda hamma son bo'sh turganlar
                          // bo'yicha, shuning uchun hudud nomi ham faqat o'shalarni ochadi
                          // (aks holda umumiy ro'yxat chiqib, jadval bilan mos kelmasdi).
                          <Link
                            href={objHref(`${rowScope}&category=11${vacantSuffix}`)}
                            className="font-medium hover:underline"
                            style={{ color: "var(--cobalt)" }}
                          >
                            {r.name}
                          </Link>
                        }
                        lead={
                          national ? (
                            <span className="tabular-nums">{i + 1}</span>
                          ) : (
                            // Boshqa ikkala jadval bilan BIR XIL `?tuman=` parametri —
                            // bittasini ochsangiz uchalasi ham o'sha tumanlarni ko'rsatadi.
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
                          )
                        }
                      />
                      {expanded
                        ? districtUtility.map((d) => (
                            <UtilityTableRow
                              key={d.regionId}
                              row={d}
                              zebra={DISTRICT_BG}
                              nf={nf}
                              km={km}
                              scopeQs={`region=${r.regionId}&district=${d.regionId}`}
                              objHref={objHref}
                              vacantSuffix={vacantSuffix}
                              lead={<span className="text-slate-300">·</span>}
                              label={
                                <Link
                                  href={objHref(`region=${r.regionId}&district=${d.regionId}&category=11${vacantSuffix}`)}
                                  className="text-[13px] hover:underline"
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
                {utilRows.length === 0 ? (
                  <tr>
                    <td colSpan={99} className="py-10 text-center text-sm text-muted-foreground">
                      Sizning tashkilotingiz bo&apos;yicha obyekt topilmadi.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
