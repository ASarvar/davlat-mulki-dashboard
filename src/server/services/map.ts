import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sourceWhere, type StatsScope } from "./stats";

/**
 * Xarita ma'lumoti.
 *
 * ⚠️ Server Component PROPI, API route EMAS — ataylab. Route bo'lganda rol doirasini
 * (`userSourceScope`) qaytadan qurish kerak bo'lardi, bu esa CLAUDE.md ogohlantirgan
 * xatolar sinfi (doira uzatilmay qolib, begona ma'lumot ko'rinishi).
 */

export interface MapPoint {
  id: string;
  /** Kadastr raqami — popup sarlavhasi va obyekt sahifasiga havola. */
  cad: string;
  lat: number;
  lng: number;
  /** Effektiv kategoriya (rang uchun). */
  cat: number;
  name: string | null;
  /**
   * Hudud va tuman — `MapData.regions` / `MapData.districts` dagi INDEKS (-1 = yo'q).
   * ⚠️ ID satri emas: ~6 600 nuqtada ikkita cuid payload'ni ~330 KB oshirardi.
   */
  r: number;
  d: number;
}

export interface MapRegion {
  id: string;
  name: string;
}

export interface MapDistrict {
  id: string;
  name: string;
  /** `MapData.regions` dagi indeks. */
  r: number;
}

/**
 * Hudud pufakchasi — `PropertyMap` ning "hudud" rejimi uchun. ⚠️ Panelda bu rejim
 * 2026-10-21 dan beri YO'Q (foydalanuvchi talabi, o'rniga xarita filtri) — tip
 * `PropertyMap` qayta ishlatilishi uchun qoldirildi, `getMapData()` uni qaytarmaydi.
 */
export interface RegionBubble {
  regionId: string;
  name: string;
  lat: number;
  lng: number;
  total: number;
  vacant: number;
}

export interface MapData {
  points: MapPoint[];
  /** Xarita filtri uchun — faqat nuqtasi bor hududlar, `Region.sortOrder` bo'yicha. */
  regions: MapRegion[];
  /** Faqat nuqtasi bor tumanlar, nomi bo'yicha. */
  districts: MapDistrict[];
  /** Doiradagi jami obyektlar (qamrovni foizda ko'rsatish uchun). */
  total: number;
  /** Koordinatasi bor obyektlar. */
  withCoords: number;
  /** Koordinatasi yo'q obyektlar — xaritada ko'rsatilmaydi. */
  nationalHidden: number;
  /**
   * Koordinata QAYSI manbadan kelgani (`Property.coordSource`).
   *
   * ⚠️ Xarita ostidagi izoh shunga qarab o'zgaradi — ikkalasi bir xil emas:
   *   `CADASTRE` — kadastr poligonining markazi (obyektning O'Z chegarasi),
   *   `AUCTION`  — auksion lotining nuqtasi (faqat savdoga chiqqanlarda).
   * Izohni qattiq yozib qo'yish mumkin emas edi: 2026-09-06 dagi ko'chishdan keyin
   * ustun manba almashdi va eski matn ("faqat auksionga chiqqan obyektlarda")
   * jimgina YOLG'ON bo'lib qolardi.
   */
  bySource: { cadastre: number; auction: number; other: number };
}

async function computeMapData(scope: StatsScope = {}): Promise<MapData> {
  const where = sourceWhere(scope);

  const [total, rows, regions, nationalHidden] = await Promise.all([
    prisma.property.count({ where }),
    prisma.property.findMany({
      where: { ...where, lat: { not: null }, lng: { not: null } },
      select: {
        id: true,
        cadNumber: true,
        lat: true,
        lng: true,
        name: true,
        regionId: true,
        districtId: true,
        coordSource: true,
        integrationCategoryCode: true,
        manualCategoryCode: true,
      },
    }),
    prisma.region.findMany({
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    // Koordinatasi yo'qlar — xarita ustidagi qamrov izohi uchun.
    prisma.property.count({ where: { ...where, lat: null } }),
  ]);

  // Filtr ro'yxatlari — faqat xaritada nuqtasi bor hudud/tumanlar (bo'sh tanlov bo'lmasin).
  const usedRegionIds = new Set(rows.map((r) => r.regionId));
  const mapRegions: MapRegion[] = regions
    .filter((g) => usedRegionIds.has(g.id))
    .map((g) => ({ id: g.id, name: g.name }));
  const regionIdx = new Map(mapRegions.map((g, i) => [g.id, i]));

  const usedDistrictIds = [...new Set(rows.map((r) => r.districtId).filter((x): x is string => !!x))];
  const districtRows = usedDistrictIds.length
    ? await prisma.district.findMany({
        where: { id: { in: usedDistrictIds } },
        select: { id: true, name: true, regionId: true },
        orderBy: { name: "asc" },
      })
    : [];
  const mapDistricts: MapDistrict[] = districtRows.map((d) => ({
    id: d.id,
    name: d.name,
    r: regionIdx.get(d.regionId) ?? -1,
  }));
  const districtIdx = new Map(mapDistricts.map((d, i) => [d.id, i]));

  const points: MapPoint[] = rows.map((r) => ({
    id: r.id,
    cad: r.cadNumber,
    // 5 xonagacha yaxlitlash (≈1 m) — payload ~2 barobar kichrayadi.
    lat: Math.round(r.lat! * 1e5) / 1e5,
    lng: Math.round(r.lng! * 1e5) / 1e5,
    cat: r.integrationCategoryCode ?? r.manualCategoryCode ?? 11,
    name: r.name,
    r: regionIdx.get(r.regionId) ?? -1,
    d: r.districtId ? (districtIdx.get(r.districtId) ?? -1) : -1,
  }));

  const bySource = { cadastre: 0, auction: 0, other: 0 };
  for (const r of rows) {
    if (r.coordSource === "CADASTRE") bySource.cadastre++;
    else if (r.coordSource === "AUCTION") bySource.auction++;
    else bySource.other++;
  }

  return {
    points,
    regions: mapRegions,
    districts: mapDistricts,
    total,
    withCoords: points.length,
    nationalHidden,
    bySource,
  };
}

// ⚠️ Doira argument sifatida — kesh kaliti rol doirasini ham qamraydi.
// ⚠️ `-v3`: `MapData` shakli o'zgardi (r/d qo'shildi, bubbles olib tashlandi) — eski kesh
// yozuvi yangi kodga tushmasin.
export const getMapData = unstable_cache(computeMapData, ["dashboard-map-v3"], {
  tags: ["dashboard"],
  revalidate: 60,
});
