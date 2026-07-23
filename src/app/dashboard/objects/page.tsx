import Link from "next/link";
import { Building2, Download, ExternalLink } from "lucide-react";
import { lotUrl } from "@/server/integrations/auction";
import { SyncStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { listProperties, PROPERTY_PAGE_SIZE, type PropertyFilters } from "@/server/services/properties";
import { listSourceNames } from "@/server/services/sources";
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
  const region = str(sp.region) || undefined;
  const soha = str(sp.soha) || undefined;
  const categoryStr = str(sp.category);
  const inefficientStr = str(sp.inefficient);
  const fullyRentedStr = str(sp.fullyRented);
  const hasRentContractStr = str(sp.hasRentContract);
  const bothAuctionsStr = str(sp.bothAuctions);
  const requestedPage = Number(str(sp.page) ?? 1);
  const statusRaw = str(sp.status);
  const syncStatus = statusRaw && statusRaw in SyncStatus ? (statusRaw as SyncStatus) : undefined;

  const filters: PropertyFilters = {
    q,
    regionId: region,
    soha,
    categoryCode: categoryStr ? Number(categoryStr) : undefined,
    inefficient: inefficientStr === "1" ? true : inefficientStr === "0" ? false : undefined,
    syncStatus,
    fullyRented: fullyRentedStr === "1" ? true : undefined,
    hasRentContract: hasRentContractStr === "1" ? true : undefined,
    bothAuctions: bothAuctionsStr === "1" ? true : undefined,
  };

  // "Bo'sh maydoni bor" (kat 12) filtri tanlansa, maydon ustunida bo'sh maydon ko'rsatiladi.
  const showVacant = filters.categoryCode === CAT_HAS_VACANT_AREA;

  const canFilterRegion = user.role !== "REGION_USER";
  const [regions, sohaList, result] = await Promise.all([
    canFilterRegion ? prisma.region.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }) : Promise.resolve([]),
    listSourceNames(),
    listProperties(user, filters, requestedPage),
  ]);

  // Joriy filtrlar (eksport va sahifalash uchun umumiy).
  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (region) baseParams.set("region", region);
  if (soha) baseParams.set("soha", soha);
  if (categoryStr) baseParams.set("category", categoryStr);
  if (inefficientStr) baseParams.set("inefficient", inefficientStr);
  if (fullyRentedStr) baseParams.set("fullyRented", fullyRentedStr);
  if (hasRentContractStr) baseParams.set("hasRentContract", hasRentContractStr);
  if (bothAuctionsStr) baseParams.set("bothAuctions", bothAuctionsStr);

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
        sohaList={sohaList}
        canFilterRegion={canFilterRegion}
        current={{ q, region, soha, category: categoryStr, inefficient: inefficientStr }}
      />

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Kadastr</th>
              <th className="px-4 py-3 font-medium">Eski kadastr</th>
              <th className="px-4 py-3 font-medium">Hudud</th>
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
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
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
