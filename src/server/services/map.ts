import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sourceWhere, type StatsScope } from "./stats";
import { REGION_CENTER, type Coords } from "@/lib/geo";

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
}

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
  bubbles: RegionBubble[];
  /** Doiradagi jami obyektlar (qamrovni foizda ko'rsatish uchun). */
  total: number;
  /** Koordinatasi bor obyektlar. */
  withCoords: number;
  /** Respublika darajasidagi tashkilotlarning obyektlari — xaritada ko'rsatilmaydi. */
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

  const [total, rows, regionAgg, regions, nationalHidden] = await Promise.all([
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
        coordSource: true,
        integrationCategoryCode: true,
        manualCategoryCode: true,
      },
    }),
    prisma.property.groupBy({
      by: ["regionId"],
      where,
      _count: { _all: true },
    }),
    prisma.region.findMany({ select: { id: true, name: true, cadastrePrefix: true } }),
    // ⚠️ Respublika darajasidagi tashkilot obyektlari hudud pufakchasiga KIRADI
    // (ularning `regionId` si kadastr prefiksidan aniqlangan haqiqiy hudud), lekin
    // koordinatasi yo'qlari umuman ko'rsatilmaydi — shuni sanaymiz.
    prisma.property.count({ where: { ...where, lat: null } }),
  ]);

  const points: MapPoint[] = rows.map((r) => ({
    id: r.id,
    cad: r.cadNumber,
    // 5 xonagacha yaxlitlash (≈1 m) — payload ~2 barobar kichrayadi.
    lat: Math.round(r.lat! * 1e5) / 1e5,
    lng: Math.round(r.lng! * 1e5) / 1e5,
    cat: r.integrationCategoryCode ?? r.manualCategoryCode ?? 11,
    name: r.name,
  }));

  // Bo'sh turgan (effektiv kategoriya 11) — pufakcha rangi uchun.
  const vacantAgg = await prisma.property.groupBy({
    by: ["regionId"],
    where: { ...where, integrationCategoryCode: null, manualCategoryCode: null },
    _count: { _all: true },
  });
  const vacantByRegion = new Map(vacantAgg.map((r) => [r.regionId, r._count._all]));

  // Nuqtalar o'rtachasi — `REGION_CENTER` da yo'q hudud uchun ZAXIRA markaz.
  // ⚠️ Busiz yangi hudud qo'shilganda pufakcha JIMGINA yo'qolardi.
  const sums = new Map<string, { lat: number; lng: number; n: number }>();
  for (const r of rows) {
    const cur = sums.get(r.regionId) ?? { lat: 0, lng: 0, n: 0 };
    sums.set(r.regionId, { lat: cur.lat + r.lat!, lng: cur.lng + r.lng!, n: cur.n + 1 });
  }

  const bubbles: RegionBubble[] = [];
  for (const agg of regionAgg) {
    const reg = regions.find((g) => g.id === agg.regionId);
    if (!reg) continue;
    let center: Coords | undefined = reg.cadastrePrefix ? REGION_CENTER[reg.cadastrePrefix] : undefined;
    if (!center) {
      const s = sums.get(reg.id);
      if (s && s.n > 0) center = { lat: s.lat / s.n, lng: s.lng / s.n };
    }
    if (!center) continue; // markazi ham, nuqtasi ham yo'q — chizib bo'lmaydi
    bubbles.push({
      regionId: reg.id,
      name: reg.name,
      lat: center.lat,
      lng: center.lng,
      total: agg._count._all,
      vacant: vacantByRegion.get(agg.regionId) ?? 0,
    });
  }
  bubbles.sort((a, b) => b.total - a.total);

  const bySource = { cadastre: 0, auction: 0, other: 0 };
  for (const r of rows) {
    if (r.coordSource === "CADASTRE") bySource.cadastre++;
    else if (r.coordSource === "AUCTION") bySource.auction++;
    else bySource.other++;
  }

  return { points, bubbles, total, withCoords: points.length, nationalHidden, bySource };
}

// ⚠️ Doira argument sifatida — kesh kaliti rol doirasini ham qamraydi.
export const getMapData = unstable_cache(computeMapData, ["dashboard-map-v1"], {
  tags: ["dashboard"],
  revalidate: 60,
});
