import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LineChart,
  AlertTriangle,
  Building2,
  DoorClosed,
  KeyRound,
  FileSignature,
  LandPlot,
  Banknote,
} from "lucide-react";
import { canAccess, firstOpenSectionHref, requireSection } from "@/server/services/sectionAccess";
import { getDashboardStats, getUtilityStats } from "@/server/services/stats";
import { getRentContractTrend } from "@/server/services/trends";
import { getMapData } from "@/server/services/map";
import { getKpiHistory, MIN_DAYS } from "@/server/services/snapshots";
import { CATEGORIES } from "@/lib/categories";
import { isLandSplitSoha } from "@/lib/sourceLabel";
import { nf, km, pct1, money } from "@/lib/format";
import { BRAND, categoryColor } from "@/lib/chartColors";
import { KpiCard, Tag } from "@/components/ui/KpiCard";
import { Card, ChartCard } from "@/components/ui/Card";
import { CategoryDonut } from "@/components/charts/CategoryDonut";
import { CategoryCards } from "@/components/charts/CategoryCards";
import { RegionRanking } from "@/components/charts/RegionRanking";
import { AreaBalance } from "@/components/charts/AreaBalance";
import { UtilityCoverage } from "@/components/charts/UtilityCoverage";
import { RentTrendChart } from "@/components/charts/RentTrendChart";
import { KpiHistoryChart } from "@/components/charts/KpiHistoryChart";
import { EmptyState } from "@/components/ui/EmptyState";
import { MapSection } from "@/components/map/MapSection";
import { env } from "@/lib/env";
import { BASE_PATH } from "@/lib/basePath";
import { SourceFilter } from "./SourceFilter";
import { resolveDashboardScope } from "./scope";

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Boshqaruv paneli — vizual xulosa.
 *
 * ⚠️ Rasmiy hisobot shakli (uchta jadval) BU YERDA EMAS — u `/dashboard/hisobot` da.
 * Ikkalasi bir xil `resolveDashboardScope()` va bir xil `getDashboardStats()` dan
 * oziqlanadi, ya'ni ekrandagi sonlar hech qachon ajralib qolmaydi.
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  // ⚠️ `/dashboard` — `core` marshrut, u HECH QACHON yopilmaydi (kirish sahifasi).
  // Lekin bu yerda ko'rsatiladigan VIZUAL PANEL alohida bo'lim (`panel`) va u
  // standart holatda faqat super adminga ochiq. Ruxsat bo'lmasa foydalanuvchi eski
  // ko'rinishga (rasmiy hisobot) yo'naltiriladi — ya'ni u uchun hech narsa
  // o'zgarmaydi, super admin `/dashboard/sections` dan ochmaguncha.
  const user = await requireSection("dashboard");
  if (!(await canAccess(user, "panel"))) redirect(await firstOpenSectionHref(user));

  const sp = await searchParams;

  const { scope, soha, sohaList, activeSourceKey, showOwn } = await resolveDashboardScope(
    user,
    str(sp.soha) || undefined,
  );
  const [s, utility, rentTrend, mapData, kpiHistory] = await Promise.all([
    getDashboardStats(scope),
    getUtilityStats(scope),
    getRentContractTrend(scope),
    getMapData(scope),
    getKpiHistory(scope),
  ]);

  // Xarita rejimi URL'da — server-render, havolasi ulashsa bo'ladi.
  const mapMode: "nuqta" | "hudud" = str(sp.xarita) === "hudud" ? "hudud" : "nuqta";
  const mapHref = (m: "nuqta" | "hudud") => {
    const parts = [sohaParam, m === "hudud" ? "xarita=hudud" : ""].filter(Boolean);
    return `/dashboard${parts.length ? `?${parts.join("&")}` : ""}`;
  };

  // Drill-down havolalari manba filtrini olib yuradi (hisobotdagi `objHref()` bilan bir xil).
  const sohaParam = soha ? `soha=${encodeURIComponent(soha)}` : "";
  const objHref = (qs = "") => {
    const parts = [qs, sohaParam].filter(Boolean);
    return `/dashboard/objects${parts.length ? `?${parts.join("&")}` : ""}`;
  };

  // ⚠️ "landSplit" sohalarda (Davlat aktivlari agentligi / Direksiya) bo'sh turganlar
  // FAQAT bino bo'yicha sanaladi — rasmiy hisobotdagi 11-ustun bilan aynan bir xil
  // mezon. Busiz kartadagi son hisobotdagidan katta chiqardi.
  const landSplit = isLandSplitSoha(soha);
  const vacantCount = landSplit
    ? s.byRegionCategory.reduce((a, r) => a + r.rentBreakdown.vacant.buildingCount, 0)
    : s.inefficient;
  const vacantHref = objHref(landSplit ? "inefficient=1&isLand=0" : "inefficient=1");

  const t = s.totals;
  const rentSum = money(t.rentSum);

  // ── Grafiklar uchun ma'lumot ─────────────────────────────────────────────
  // Hammasi MAVJUD agregatlardan quriladi — yangi SQL yozilmagan.

  const catLabel = new Map<number, string>(CATEGORIES.map((c) => [c.code, c.short] as [number, string]));
  const donut = s.byCategory
    // ⚠️ `code: null` — tipda mumkin, amalda bo'lmasligi kerak (kategoriyasiz obyekt
    // 11 ga tushadi, `CAT_VACANT` default). Majburlab `!` qo'yish o'rniga ochiq
    // tashlab yuboramiz: bunday qator paydo bo'lsa grafik jim buzilmasin.
    .filter((c): c is { code: number; count: number } => c.code !== null)
    .map((c) => ({
      code: c.code,
      label: catLabel.get(c.code) ?? `Kategoriya ${c.code}`,
      count: c.count,
      // ⚠️ Matnlar SERVERDA formatlanadi — "uz-UZ" Node va brauzerda turlicha
      // chiqib, gidratsiyani buzardi (client komponentiga tayyor satr boradi).
      countLabel: nf(c.count),
      pctLabel: pct1(c.count, t.total),
      // ⚠️ `effectiveCategory`, `category` EMAS. `category=N` 3/5/6/12 uchun
      // XUSUSIYAT bo'yicha filtrlaydi (rasmiy hisobot ustunlari shunday), donut esa
      // effektiv kategoriya taqsimoti — jonli o'lchovda farq katta edi (kat 3: 522↔599).
      href: objHref(`effectiveCategory=${c.code}`),
    }))
    .sort((a, b) => b.count - a.count);

  // ⚠️ Respublika darajasidagi tashkilotlar qatorlari hudud EMAS (`regionId` da
  // `OrganizationSource.id` turadi) — hududlar reytingiga qo'shilmaydi.
  const nationalIds = new Set(s.nationalOrgIds);
  const regionRows = s.byRegion.filter((r) => !nationalIds.has(r.regionId));

  const catByRegion = new Map(s.byRegionCategory.map((r) => [r.regionId, r]));

  // ⚠️ `landSplit` sohalarida (Agentlik / Direksiya) reyting BUTUNLAY binolar
  // bo'yicha quriladi — soni ham, jami ham, havolalar ham. Ilgari ustun balandligi
  // `r.inefficient` (yer + bino) dan olinib, havola esa `&isLand=0` bilan ochilardi:
  // Andijonda ustun 256 ni ko'rsatib, ro'yxat 9 ta obyekt berardi. Ikkalasi bitta
  // mezondan olinmasa bu xato jimgina qaytadi (loyihaning eng ko'p uchragan sinfi).
  const ranking = [...regionRows]
    .map((r) => {
      const c = catByRegion.get(r.regionId);
      const total = landSplit ? (c?.landSplit.total.building ?? 0) : r.total;
      const vacant = landSplit ? (c?.rentBreakdown.vacant.buildingCount ?? 0) : r.inefficient;
      const landQs = landSplit ? "&isLand=0" : "";
      // ⚠️ `hududiy=1` — hudud qatorlari respublika darajasidagi tashkilotlarni
      // ("Markaziy apparat") hisobga OLMAYDI, lekin ularning obyektlari kadastr
      // prefiksi orqali oddiy hududlarga tarqalgan. Usiz Toshkent sh. ustuni 47 ni
      // ko'rsatib, ro'yxat 71 ta obyekt berardi.
      return {
        name: r.name,
        vacant,
        used: Math.max(total - vacant, 0),
        total,
        vacantHref: objHref(`region=${r.regionId}&hududiy=1&inefficient=1${landQs}`),
        totalHref: objHref(`region=${r.regionId}&hududiy=1${landQs}`),
      };
    })
    .sort((a, b) => b.total - a.total);
  const areaBalance = [...regionRows]
    .map((r) => {
      const c = catByRegion.get(r.regionId);
      const rented = (c?.rentBreakdown.free.rentedArea ?? 0) + (c?.rentBreakdown.paid.rentedArea ?? 0);
      const vacant = c?.rentBreakdown.vacant.usefulArea ?? 0;
      return { name: r.name, rented: rented / 1000, vacant: vacant / 1000 };
    })
    .filter((d) => d.rented > 0 || d.vacant > 0)
    .sort((a, b) => b.rented + b.vacant - (a.rented + a.vacant));

  // ⚠️ Kommunal — FAQAT kat 11 bo'yicha, shuning uchun har bir havolada
  // `category=11` MAJBURIY (kommunal jadvaldagi qoida bilan bir xil).
  const u = utility.reduce(
    (a, r) => ({
      count: a.count + r.count,
      water: a.water + r.water,
      gas: a.gas + r.gas,
      electric: a.electric + r.electric,
      any: a.any + r.anyUtility,
      recent: a.recent + r.recentlyPaid,
      unchecked: a.unchecked + r.unchecked,
    }),
    { count: 0, water: 0, gas: 0, electric: 0, any: 0, recent: 0, unchecked: 0 },
  );
  const utilQs = (extra: string) => objHref(`category=11${landSplit ? "&isLand=0" : ""}&${extra}`);
  // ⚠️ Oy yorlig'i SERVERDA quriladi: `toLocaleString` Node va brauzerda turlicha
  // chiqib gidratsiyani buzardi (donutda aynan shu xato bo'lgan edi).
  const OY = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];
  const trendRows = rentTrend.points.map((p) => {
    const [y, m] = p.month.split("-");
    return { label: `${OY[Number(m) - 1]} ${y.slice(2)}`, count: p.count, area: p.area / 1000 };
  });

  // ── Kunlik snapshot (F6) ────────────────────────────────────────────────
  // ⚠️ Sana yorlig'i ham SERVERDA quriladi (trend grafigidagi bilan bir xil sabab).
  // "YYYY-MM-DD" satridan to'g'ridan-to'g'ri kesiladi — `new Date()` ga o'tkazilsa
  // Node va brauzer vaqt zonasi farqi kunni bir kunga siljitishi mumkin edi.
  const dayLabel = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  const kpiRows = kpiHistory.map((p) => ({
    label: dayLabel(p.day),
    total: p.total,
    // ⚠️ Kartadagi "Bo'sh turgan" bilan AYNAN bir xil mezon: landSplit sohalarida
    // faqat binolar sanaladi. Ikkalasi ajralib qolsa grafik kartani inkor qilardi.
    vacant: landSplit ? p.vacantBuildings : p.vacant,
    rented: p.rentedObjects,
  }));
  const firstDay = kpiHistory[0] ? dayLabel(kpiHistory[0].day) : null;

  const utilityBars = [
    { name: "Suv", value: u.water, color: "#4a90a4", href: utilQs("utility=water") },
    { name: "Gaz", value: u.gas, color: BRAND.gold, href: utilQs("utility=gas") },
    { name: "Elektr", value: u.electric, color: "#3b5fa8", href: utilQs("utility=electric") },
    { name: "Kamida bittasi", value: u.any, color: BRAND.navyMid, href: utilQs("utility=any") },
    { name: "Yaqinda to'lov", value: u.recent, color: "#b45309", href: utilQs("utility=recentlyPaid") },
    { name: "Tekshirilmagan", value: u.unchecked, color: "#94a3b8", href: utilQs("utility=unchecked") },
  ];

  return (
    <div>
      {/* Sarlavha + manba kesimi */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
            Boshqaruv paneli
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Davlat mulki obyektlaridan foydalanish samaradorligi
            {soha ? ` — ${soha}` : ""}
          </p>
        </div>
        <SourceFilter
          names={sohaList}
          activeKey={activeSourceKey}
          showOwn={showOwn}
          basePath="/dashboard"
        />
      </div>

      {/* Asosiy ko'rsatkichlar */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Jami obyektlar"
          value={nf(t.total)}
          accent={BRAND.cobalt}
          href={objHref()}
          icon={Building2}
          footer="balansdagi obyektlar"
        />
        <KpiCard
          label={landSplit ? "Bo'sh turgan (bino)" : "Bo'sh turgan"}
          value={nf(vacantCount)}
          accent={BRAND.gold}
          href={vacantHref}
          icon={DoorClosed}
          footer={
            <>
              <Tag>{pct1(vacantCount, t.total)}%</Tag> jami obyektdan
            </>
          }
        />
        {/* ⚠️ `totals.rentedObjects` mezoni — `rentContractCount > 0`, ya'ni kategoriyadan
            MUSTAQIL. Ro'yxat filtri ham aynan shu (`hasAnyRentContract`), `hasRentContract`
            EMAS: u effektiv kategoriya 5/6 ni talab qiladi va BOSHQA son berardi. */}
        <KpiCard
          label="Ijaraga berilgan"
          value={nf(t.rentedObjects)}
          accent="#2c6e8a"
          href={objHref("hasAnyRentContract=1")}
          icon={KeyRound}
          footer="obyektda shartnoma bor"
        />
        <KpiCard
          label="Ijara shartnomalari"
          value={nf(t.contractCount)}
          accent="#2c6e8a"
          icon={FileSignature}
          footer={
            t.rentedObjects > 0
              ? `o'rtacha ${nf(t.contractCount / t.rentedObjects, 1)} ta obyektiga`
              : "shartnoma yo'q"
          }
        />
        {/* ⚠️ "Foydali maydonning N%" ATAYLAB ko'rsatilmaydi: `totals` da butun doira
            bo'yicha foydali maydon yig'indisi yo'q, faqat 5/6/11-kategoriyalarniki bor.
            O'sha qisman maxraj bilan hisoblansa nisbat ~100% chiqib, "hamma maydon
            ijarada" degan YOLG'ON xulosa berardi (mahalliy o'lchovda aynan shunday
            chiqdi). To'g'ri maxraj kerak bo'lsa `stats.ts` ga alohida agregat qo'shiladi. */}
        <KpiCard
          label="Ijaradagi maydon"
          value={km(t.rentArea)}
          unit="ming m²"
          accent="#2e7d5b"
          icon={LandPlot}
          footer="shartnomalar bo'yicha jami"
        />
        <KpiCard
          label="Shartnomalar summasi"
          value={rentSum.value}
          unit={rentSum.unit}
          accent="#2e7d5b"
          icon={Banknote}
          footer="yillik ijara to'lovi"
        />
      </div>

      {/* Kategoriya taqsimoti — to'liq kenglik: kartalar chapda, halqa o'ngda */}
      <div className="mt-4">
        <ChartCard
          title="Kategoriya taqsimoti"
          subtitle={`Effektiv kategoriya bo'yicha, ${nf(t.total)} obyekt`}
          footnote="Har bir kartani yoki halqa bo'lagini bosganda o'sha kategoriyaning obyektlar ro'yxati ochiladi."
        >
          {/* ⚠️ Kartalar CHAPDA (2/3), halqa O'NGDA (1/3) — foydalanuvchi tanlovi, 2026-09-06.
              Flex emas, GRID: `basis-2/3` + `basis-1/3` + gap yig'indisi 100% dan oshib
              ketardi va nisbat buzilardi; grid'da ustunlar gap'dan keyin bo'linadi. */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-center lg:gap-8">
            <div className="min-w-0 lg:col-span-2">
              <CategoryCards data={donut} />
            </div>
            <div className="flex justify-center">
              <CategoryDonut data={donut} totalLabel={nf(t.total)} showLegend={false} size={280} />
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Hududlar reytingi — to'liq kenglik */}
      <div className="mt-4">
        <ChartCard
          title="Hududlar reytingi"
          subtitle={
            landSplit
              ? "Binolar soni — bo'sh turganlar ulushi bilan (yer uchastkalari kirmaydi)"
              : "Obyektlar soni — bo'sh turganlar ulushi bilan"
          }
          action={
            <div className="flex items-center gap-3 text-[11.5px] text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-sm" style={{ background: BRAND.gold }} />
                Bo&apos;sh turgan
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-sm" style={{ background: BRAND.cobalt }} />
                Foydalanilmoqda
              </span>
            </div>
          }
        >
          <RegionRanking data={ranking} />
        </ChartCard>
      </div>

      {/* Maydon balansi + kommunal qamrov */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Maydon balansi"
          subtitle="Ijaradagi va bo'sh maydon, ming m²"
          footnote="Maydon bir nechta kategoriyaga tarqalgani uchun bu grafikda ro'yxatga havola yo'q — mos keladigan yagona filtr mavjud emas."
        >
          <AreaBalance data={areaBalance} />
        </ChartCard>

        <ChartCard
          title="Kommunal qamrov"
          subtitle={`Faqat "Bo'sh turgan" ${nf(u.count)} obyekt bo'yicha`}
          footnote={
            <>
              Abonent topilgan {nf(u.any)} obyekt ({pct1(u.any, u.count)}%) — &laquo;bo&apos;sh&raquo; deb
              belgilangan bo&apos;lsa-da, kommunal hisobi bor. Bu dalil emas, tekshirish uchun signal:
              abonent ijarachi yoki qo&apos;shni bo&apos;lishi mumkin.
            </>
          }
        >
          <UtilityCoverage data={utilityBars} vacantTotal={u.count} />
        </ChartCard>
      </div>

      {/* Xarita */}
      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3 md:p-5 md:pb-3">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--navy)" }}>
              Obyektlar xaritasi
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {mapMode === "hudud"
                ? "Hududlar kesimi — barcha obyektlar"
                : "Auksionga chiqarilgan obyektlarning joylashuvi"}
            </p>
          </div>
          {/* Rejim URL'da saqlanadi — sahifa yangilanganda ham qoladi, havolasi ulashiladi. */}
          <div className="inline-flex overflow-hidden rounded-lg border border-border bg-muted text-[12.5px] font-medium">
            <Link
              href={mapHref("nuqta")}
              className={`px-3.5 py-1.5 transition-colors ${mapMode === "nuqta" ? "bg-card text-[color:var(--navy)] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Xarita
            </Link>
            <Link
              href={mapHref("hudud")}
              className={`px-3.5 py-1.5 transition-colors ${mapMode === "hudud" ? "bg-card text-[color:var(--navy)] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Hududlar
            </Link>
          </div>
        </div>

        {/* ⚠️ Qamrov cheklovi DOIM ko'rinadi — yashirilsa xaritadagi bo'shliq
            "obyekt yo'q" deb tushunilardi. */}
        {mapMode === "nuqta" ? (
          <div
            className="mx-4 mb-3 flex gap-2 rounded-lg border px-3 py-2 text-xs md:mx-5"
            style={{ background: "var(--gold-lighter)", borderColor: "var(--gold-light)", color: "#7a5f28" }}
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <b>
                {nf(mapData.withCoords)} / {nf(mapData.total)} obyektda koordinata bor (
                {pct1(mapData.withCoords, mapData.total)}%).
              </b>{" "}
              {/* ⚠️ Matn MANBAGA qarab o'zgaradi. Ilgari u qattiq "faqat auksionga
                  chiqqan obyektlarda" deb yozilgan edi — kadastr API'siga ko'chgandan
                  keyin (2026-09-06) bu YOLG'ON bo'lib qolardi. */}
              {mapData.bySource.cadastre >= mapData.bySource.auction ? (
                <>
                  Asosiy manba — <b>kadastr chegarasining markazi</b>
                  {mapData.bySource.auction > 0
                    ? `; ${nf(mapData.bySource.auction)} tasida esa auksion lotining nuqtasi`
                    : ""}
                  .
                </>
              ) : (
                <>
                  Koordinata asosan auksionga chiqarilgan obyektlarda mavjud va u{" "}
                  <b>auksion lotining nuqtasi</b>, kadastr chegarasi emas
                  {mapData.bySource.cadastre > 0
                    ? `; ${nf(mapData.bySource.cadastre)} tasida kadastr markazi`
                    : ""}
                  .
                </>
              )}{" "}
              Qolgan {nf(mapData.nationalHidden)} obyekt xaritada ko&apos;rsatilmagan —{" "}
              <Link href={mapHref("hudud")} className="underline">
                «Hududlar» rejimida
              </Link>{" "}
              ular ham hisobga olinadi.
            </span>
          </div>
        ) : null}

        <MapSection
          points={mapMode === "nuqta" ? mapData.points : []}
          bubbles={mapMode === "hudud" ? mapData.bubbles : []}
          mode={mapMode}
          tileUrl={env.MAP_TILE_URL}
          tileAttribution={env.MAP_TILE_ATTRIBUTION}
          basePath={BASE_PATH}
        />
      </Card>

      {/* Vaqt kesimi */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Ijara shartnomalari — oylar kesimi"
          subtitle="Oxirgi 24 oy, tuzilgan shartnomalar"
          footnote={
            <>
              Manba — <b>RentContract.contractDate</b>, haqiqiy hodisa sanasi.
              {rentTrend.undated > 0
                ? ` Sanasi ko'rsatilmagan shartnoma: ${nf(rentTrend.undated)} ta — ular grafikka kirmaydi, shuning uchun ustunlar yig'indisi yuqoridagi "Ijara shartnomalari" kartasidan kichik chiqadi.`
                : " Sanasi ko'rsatilmagan shartnoma yo'q."}
            </>
          }
        >
          <RentTrendChart data={trendRows} />
        </ChartCard>

        <ChartCard
          title="Asosiy ko'rsatkichlar dinamikasi"
          subtitle={
            kpiRows.length >= MIN_DAYS
              ? `Kunlik o'lchov, ${nf(kpiRows.length)} kun`
              : "Kunlik snapshot asosida"
          }
          footnote={
            kpiRows.length >= MIN_DAYS
              ? "Manba — har kuni 02:00 da olinadigan o'lchov (kunlik sinxronizatsiyadan oldin). O'q nol'dan boshlanmaydi: kunlik o'zgarish ko'rinishi uchun."
              : "Obyekt ustunlari har sinxronizatsiyada ustidan yoziladi, shuning uchun o'tmish uchun ma'lumot yo'q. Nol chiziq chizib «hech narsa o'zgarmadi» degan yolg'on taassurot berilmaydi."
          }
        >
          {/* ⚠️ `< MIN_DAYS` da grafik UMUMAN chizilmaydi — bitta nuqtadan chiqadigan
              tekis chiziq "hech narsa o'zgarmadi" degan yolg'on xulosa berardi.
              Tarixni backfill qilib bo'lmaydi, shuning uchun kutishdan boshqa yo'l yo'q. */}
          {kpiRows.length >= MIN_DAYS ? (
            <KpiHistoryChart data={kpiRows} />
          ) : (
            <EmptyState
              icon={<LineChart className="h-7 w-7" strokeWidth={1.6} />}
              title="Tarix hali to'planmagan"
              description={
                firstDay
                  ? `Birinchi o'lchov: ${firstDay}. Grafik ikkinchi kunlik o'lchovdan keyin ochiladi — o'lchov har kuni 02:00 da avtomatik olinadi.`
                  : "«Bo'sh turgan», «Ijaraga berilgan» va «Jami» ko'rsatkichlari har kuni 02:00 da saqlanadi. Kamida ikki kunlik o'lchov to'plangach grafik shu yerda ochiladi."
              }
            />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
