import Link from "next/link";
import { Building2, Download, ExternalLink } from "lucide-react";
import { lotUrl } from "@/server/integrations/auction";
import { SyncStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { listProperties, PROPERTY_PAGE_SIZE, type PropertyFilters } from "@/server/services/properties";
import { listSourceNames } from "@/server/services/sources";
import { listDistricts } from "@/server/services/districts";
import { CAT_HAS_VACANT_AREA } from "@/server/services/classification";
import { objectHref } from "@/lib/cadastre";
import { CategoryBadge, InefficientBadge, SyncStatusBadge } from "@/components/badges";
import { Pagination } from "@/components/Pagination";
import { ObjectFilters } from "./ObjectFilters";

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
  const categoryStr = str(sp.category);
  const inefficientStr = str(sp.inefficient);
  const fullyRentedStr = str(sp.fullyRented);
  const hasRentContractStr = str(sp.hasRentContract);
  const onAnyAuctionStr = str(sp.onAnyAuction);
  const requestedPage = Number(str(sp.page) ?? 1);
  const statusRaw = str(sp.status);
  const syncStatus = statusRaw && statusRaw in SyncStatus ? (statusRaw as SyncStatus) : undefined;

  const filters: PropertyFilters = {
    q,
    regionId: region,
    districtId: district,
    soha,
    categoryCode: categoryStr ? Number(categoryStr) : undefined,
    inefficient: inefficientStr === "1" ? true : inefficientStr === "0" ? false : undefined,
    syncStatus,
    fullyRented: fullyRentedStr === "1" ? true : undefined,
    hasRentContract: hasRentContractStr === "1" ? true : undefined,
    onAnyAuction: onAnyAuctionStr === "1" ? true : undefined,
    myRegionsOnly: myRegionsOnly || undefined,
  };

  // "Bo'sh maydoni bor" (kat 12) filtri tanlansa, maydon ustunida bo'sh maydon ko'rsatiladi.
  const showVacant = filters.categoryCode === CAT_HAS_VACANT_AREA;

  const canFilterRegion = user.role !== "IJROCHI";
  // MODERATOR hamma hududni ko'radi — dropdown'da ham hamma hudud ko'rsatiladi. Qo'shimcha
  // Hudud select'ining birinchi varianti "Faqat mening hududlarim" (ObjectFilters) bilan
  // o'ziga biriktirilganlar bo'yicha saralay oladi (myRegionsOnly, buildWhere()da qo'llanadi).
  const showMyRegionsToggle = user.role === "MODERATOR";
  // Tuman tanlagichi tanlangan HUDUDGA bog'liq: hudud tanlanmasa 205 ta tuman
  // bitta ro'yxatda chiqib, foydasiz bo'lardi. IJROCHI uchun esa o'z hududi olinadi.
  const districtRegionId = canFilterRegion ? region : (user.regionId ?? undefined);
  const [regions, districts, sohaList, result] = await Promise.all([
    canFilterRegion
      ? prisma.region.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } })
      : Promise.resolve([]),
    districtRegionId ? listDistricts(districtRegionId) : Promise.resolve([]),
    listSourceNames(),
    listProperties(user, filters, requestedPage),
  ]);

  // Joriy filtrlar (eksport va sahifalash uchun umumiy).
  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (regionRaw) baseParams.set("region", regionRaw);
  if (district) baseParams.set("district", district);
  if (soha) baseParams.set("soha", soha);
  if (categoryStr) baseParams.set("category", categoryStr);
  if (inefficientStr) baseParams.set("inefficient", inefficientStr);
  if (fullyRentedStr) baseParams.set("fullyRented", fullyRentedStr);
  if (hasRentContractStr) baseParams.set("hasRentContract", hasRentContractStr);
  if (onAnyAuctionStr) baseParams.set("onAnyAuction", onAnyAuctionStr);

  const exportHref = `/api/export/objects?${baseParams.toString()}`;

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
        canFilterRegion={canFilterRegion}
        showMyRegionsToggle={showMyRegionsToggle}
        current={{ q, region: regionRaw, district, soha, category: categoryStr, inefficient: inefficientStr }}
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
