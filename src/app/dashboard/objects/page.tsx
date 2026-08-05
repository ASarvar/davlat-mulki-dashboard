import Link from "next/link";
import { Building2, Download, ExternalLink } from "lucide-react";
import { lotUrl } from "@/server/integrations/auction";
import { SyncStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { listProperties, PROPERTY_PAGE_SIZE, type PropertyFilters } from "@/server/services/properties";
import { listSourceNames, listSources } from "@/server/services/sources";
import { listDistricts } from "@/server/services/districts";
import { CAT_HAS_VACANT_AREA } from "@/server/services/classification";
import { objectHref } from "@/lib/cadastre";
import { sourceScopeLabel } from "@/lib/sourceLabel";
import { CategoryBadge, InefficientBadge, SyncStatusBadge } from "@/components/badges";
import { Pagination } from "@/components/Pagination";
import { ObjectFilters, type FilterChip } from "./ObjectFilters";

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ObjectsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;

  const q = str(sp.q)?.trim() || undefined;
  const regionRaw = str(sp.region) || undefined;
  // "mine" — Hudud select'idagi maxsus variant (faqat MODERATOR), haqiqiy hudud ID emas.
  const myRegionsOnly = regionRaw === "mine";
  const region = myRegionsOnly ? undefined : regionRaw;
  const district = str(sp.district) || undefined;
  const soha = str(sp.soha) || undefined;
  const tashkilot = str(sp.tashkilot) || undefined;
  const categoryStr = str(sp.category);
  const inefficientStr = str(sp.inefficient);
  const fullyRentedStr = str(sp.fullyRented);
  const hasRentContractStr = str(sp.hasRentContract);
  const onAnyAuctionStr = str(sp.onAnyAuction);
  const isLandStr = str(sp.isLand);
  const requestedPage = Number(str(sp.page) ?? 1);
  const statusRaw = str(sp.status);
  const syncStatus = statusRaw && statusRaw in SyncStatus ? (statusRaw as SyncStatus) : undefined;

  const filters: PropertyFilters = {
    q,
    regionId: region,
    districtId: district,
    soha,
    sourceId: tashkilot,
    categoryCode: categoryStr ? Number(categoryStr) : undefined,
    inefficient: inefficientStr === "1" ? true : inefficientStr === "0" ? false : undefined,
    syncStatus,
    fullyRented: fullyRentedStr === "1" ? true : undefined,
    hasRentContract: hasRentContractStr === "1" ? true : undefined,
    onAnyAuction: onAnyAuctionStr === "1" ? true : undefined,
    isLand: isLandStr === "1" ? true : isLandStr === "0" ? false : undefined,
    myRegionsOnly: myRegionsOnly || undefined,
  };

  // "Bo'sh maydoni bor" (kat 12) filtri tanlansa, maydon ustunida bo'sh maydon ko'rsatiladi.
  const showVacant = filters.categoryCode === CAT_HAS_VACANT_AREA;

  // MODERATOR "Faqat mening tashkilotlarim" bilan o'ziga biriktirilganlar bo'yicha
  // saralay oladi (myRegionsOnly, buildWhere()da qo'llanadi).
  const showMyRegionsToggle = user.role === "MODERATOR";
  // Tuman tanlagichi tanlangan HUDUDGA bog'liq: hudud tanlanmasa 205 ta tuman
  // bitta ro'yxatda chiqib, foydasiz bo'lardi.
  const [regions, districts, sohaList, sohaSources, result] = await Promise.all([
    // Hudud endi DOIRA emas, oddiy filtr — hammaga ko'rsatiladi. IJROCHI uchun ham
    // foydali: respublika darajasidagi tashkilotga biriktirilgan bo'lsa obyektlari
    // barcha hududlarga tarqalgan bo'ladi.
    prisma.region.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    region ? listDistricts(region) : Promise.resolve([]),
    listSourceNames(),
    // Tashkilot tanlagichi tanlangan SOHAGA bog'liq — soha bo'lmasa hamma manba bitta
    // ro'yxatda chiqib, foydasiz bo'lardi (xuddi tuman/hudud kabi).
    soha ? listSources({ name: soha }) : Promise.resolve([]),
    listProperties(user, filters, requestedPage),
  ]);

  const orgs = sohaSources.map((s) => ({
    id: s.id,
    label: sourceScopeLabel(s.name, s.region?.name),
  }));

  // Joriy filtrlar (eksport va sahifalash uchun umumiy).
  // ⚠️ Bu yerga QO'SHILMAGAN param eksport va sahifalashda yo'qoladi — yangi filtr
  // qo'shsangiz shu ro'yxatni ham yangilang (`status` bir marta shu sabab tushib qolgan edi).
  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (regionRaw) baseParams.set("region", regionRaw);
  if (district) baseParams.set("district", district);
  if (soha) baseParams.set("soha", soha);
  if (tashkilot) baseParams.set("tashkilot", tashkilot);
  if (categoryStr) baseParams.set("category", categoryStr);
  if (inefficientStr) baseParams.set("inefficient", inefficientStr);
  if (fullyRentedStr) baseParams.set("fullyRented", fullyRentedStr);
  if (hasRentContractStr) baseParams.set("hasRentContract", hasRentContractStr);
  if (onAnyAuctionStr) baseParams.set("onAnyAuction", onAnyAuctionStr);
  if (isLandStr) baseParams.set("isLand", isLandStr);
  if (syncStatus) baseParams.set("status", syncStatus);

  const exportHref = `/api/export/objects?${baseParams.toString()}`;

  // Dashboard'dan kelgan maxsus filtrlar — formada tanlagich sifatida yo'q, yorliq
  // (chip) ko'rinishida chiqadi. `removeHref` — faqat shu filtrni olib tashlaydigan URL.
  const hrefWithout = (key: string) => {
    const params = new URLSearchParams(baseParams);
    params.delete(key);
    const qs = params.toString();
    return qs ? `/dashboard/objects?${qs}` : "/dashboard/objects";
  };
  const chips: FilterChip[] = [];
  if (onAnyAuctionStr === "1")
    chips.push({ key: "onAnyAuction", value: "1", label: "Auksion savdolarida", removeHref: hrefWithout("onAnyAuction") });
  if (hasRentContractStr === "1")
    chips.push({ key: "hasRentContract", value: "1", label: "Ijaraga berilgan", removeHref: hrefWithout("hasRentContract") });
  if (fullyRentedStr === "1")
    chips.push({ key: "fullyRented", value: "1", label: "To'liq ijara berilgan", removeHref: hrefWithout("fullyRented") });
  if (isLandStr === "1") chips.push({ key: "isLand", value: "1", label: "Yer", removeHref: hrefWithout("isLand") });
  if (isLandStr === "0") chips.push({ key: "isLand", value: "0", label: "Bino", removeHref: hrefWithout("isLand") });
  if (syncStatus)
    chips.push({ key: "status", value: syncStatus, label: `Sinxronizatsiya: ${syncStatus}`, removeHref: hrefWithout("status") });

  // Sahifa havolasi — filtrlarni saqlab, faqat `page` ni almashtiradi.
  const hrefFor = (p: number) => {
    const params = new URLSearchParams(baseParams);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/dashboard/objects?${qs}` : "/dashboard/objects";
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
            <Building2 className="h-5 w-5" style={{ color: "var(--gold)" }} />
            Obyektlar
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Kadastr bo'yicha qidiruv, filtr va eksport</p>
        </div>
        <a
          href={exportHref}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          style={{ background: "var(--cobalt)" }}
        >
          <Download className="h-4 w-4" />
          Excel'ga yuklash
        </a>
      </div>

      <ObjectFilters
        regions={regions}
        districts={districts}
        sohaList={sohaList}
        orgs={orgs}
        showMyRegionsToggle={showMyRegionsToggle}
        chips={chips}
        total={result.total}
        clearHref="/dashboard/objects"
        current={{ q, region: regionRaw, district, soha, tashkilot, category: categoryStr, inefficient: inefficientStr }}
      />

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Kadastr</th>
              <th className="px-4 py-3 font-medium">Eski kadastr</th>
              <th className="px-4 py-3 font-medium">Hudud</th>
              <th className="px-4 py-3 font-medium">Tuman</th>
              <th className="px-4 py-3 font-medium">Manzil</th>
              <th className="px-4 py-3 font-medium">{showVacant ? "Bo'sh maydon" : "Maydon"}</th>
              <th className="px-4 py-3 font-medium">Lot</th>
              <th className="px-4 py-3 font-medium">Kategoriya</th>
              <th className="px-4 py-3 font-medium">Samaradorlik</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  Obyekt topilmadi. Ma'lumot yuklash uchun sinxronizatsiyani ishga tushiring.
                </td>
              </tr>
            ) : (
              result.items.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium">
                    <Link href={objectHref(p.cadNumber)} className="hover:underline" style={{ color: "var(--cobalt)" }}>
                      {p.cadNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.cadNumberOld ?? "—"}</td>
                  <td className="px-4 py-3">{p.regionName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.districtName ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.address ?? "—"}</td>
                  <td className="px-4 py-3">
                    {showVacant
                      ? p.vacantArea
                        ? `${p.vacantArea} m²`
                        : "—"
                      : p.area
                        ? `${p.area} m²`
                        : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {p.lotNumber ? (
                      <a
                        href={lotUrl(p.lotNumber)}
                        target="_blank"
                        rel="noreferrer"
                        title={p.lotStatus ? `${p.lotStatus} — e-auksion.uz da ochish` : "e-auksion.uz da ochish"}
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                        style={{ color: "var(--cobalt)" }}
                      >
                        {p.lotNumber}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge integrationCode={p.integrationCategoryCode} manualCode={p.manualCategoryCode} />
                  </td>
                  <td className="px-4 py-3">
                    <InefficientBadge value={p.isInefficient} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        pageSize={PROPERTY_PAGE_SIZE}
        hrefFor={hrefFor}
      />
    </div>
  );
}
