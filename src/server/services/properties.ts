import { Prisma, type SyncStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CAT_FREE_USE,
  CAT_HAS_RENT,
  CAT_HAS_VACANT_AREA,
  CAT_ON_AUCTION,
  CAT_ON_AUCTION_RENT,
  CAT_VACANT,
} from "./classification";
import { userSourceScope, type SessionUser } from "@/lib/authz";

export interface PropertyFilters {
  q?: string; // kadastr (yangi/eski) bo'yicha qidiruv
  regionId?: string;
  /** Tuman (District.id) — hudud ichida torroq kesim. */
  districtId?: string;
  categoryCode?: number; // effektiv kategoriya (1–10)
  inefficient?: boolean;
  syncStatus?: SyncStatus;
  /** Soha = manba nomi ("Ijara markazi", "Sog'liqni saqlash", ...) */
  soha?: string;
  /** Aniq TASHKILOT (OrganizationSource.id) — soha ichidagi torroq kesim (masalan bitta hudud yoki "Markaziy apparat"). */
  sourceId?: string;
  /** Ijara shartnomasi bor VA foydali maydon to'liq band (vacantArea = 0). Kategoriyaga bog'liq emas. */
  fullyRented?: boolean;
  /** Ijara shartnomasi bor — tekin foydalanish yoki pullik, ikkisidan biri. Kategoriyaga bog'liq emas. */
  hasRentContract?: boolean;
  /** Xususiylashtirish YOKI ijara savdosida (kat 3 va 4 birlashmasi, takror sanalmaydi). */
  onAnyAuction?: boolean;
  /** MODERATOR uchun: faqat o'ziga biriktirilgan hudud(lar) bo'yicha saralash (ko'rish cheklovi emas). */
  myRegionsOnly?: boolean;
}

const PAGE_SIZE = 20;
export const PROPERTY_PAGE_SIZE = PAGE_SIZE;

// Rol/hudud + filtrlar asosida WHERE quramiz.
// EKSPORT ham shu funksiyani ishlatadi — hudud doirasi bir joyda, takrorlanmaydi.
export async function buildWhere(user: SessionUser, f: PropertyFilters): Promise<Prisma.PropertyWhereInput> {
  const and: Prisma.PropertyWhereInput[] = [];

  // TASHKILOT doirasi: IJROCHI faqat o'z tashkilotining obyektlarini ko'radi
  // (biriktirilmagan bo'lsa — hech narsa). Boshqa rollar (admin/moderator/kuzatuvchi)
  // hamma obyektni ko'radi, lekin filtr param'ni hurmat qiladi. MODERATOR qo'shimcha
  // ravishda "faqat mening tashkilotlarim" bilan saralashi mumkin (myRegionsOnly) —
  // bu ko'rish cheklovi emas, ixtiyoriy filtr.
  // ⚠️ Hudud endi FAQAT foydalanuvchi tanlaydigan filtr — doira emas.
  if (user.role === "IJROCHI") {
    and.push(user.sourceId ? { sourceId: user.sourceId } : { id: "__no_source__" });
    if (f.regionId) and.push({ regionId: f.regionId });
  } else {
    if (f.regionId) and.push({ regionId: f.regionId });
    if (f.myRegionsOnly && user.role === "MODERATOR") {
      const scope = await userSourceScope(user);
      if (scope !== null) and.push({ sourceId: { in: scope } });
    }
  }

  // Tuman — hudud ichidagi torroq kesim. Rol doirasi bilan AND birikadi, ya'ni
  // IJROCHI boshqa hududning tumanini so'rasa ham natija bo'sh chiqadi (kengaytirmaydi).
  if (f.districtId) and.push({ districtId: f.districtId });

  // Kadastr qidiruvi (pg_trgm GIN indeks orqali ILIKE %q%).
  if (f.q?.trim()) {
    const q = f.q.trim();
    and.push({
      OR: [
        { cadNumber: { contains: q, mode: "insensitive" } },
        { cadNumberOld: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  // Kategoriya filtri.
  // 5 (Tekin foydalanish), 6 (Ijara shartnomasi bor) va 12 (Bo'sh maydoni bor) —
  // dashboard'da XUSUSIYAT bo'yicha hisoblanadi (obyekt sotilgan bo'lsa ham ijarasi bo'lishi
  // mumkin), shuning uchun filtr ham shu mantiqni takrorlashi shart. Aks holda jadvaldagi
  // raqamni bosganda ro'yxat bo'sh chiqadi.
  if (f.categoryCode) {
    const c = f.categoryCode;
    if (c === CAT_ON_AUCTION) {
      // Xususiylashtirish savdosida — obyekt bir vaqtda ijara savdosida ham bo'lishi mumkin.
      and.push({ hasPrivatizationLot: true });
    } else if (c === CAT_ON_AUCTION_RENT) {
      and.push({ hasRentLot: true });
    } else if (c === CAT_FREE_USE) {
      and.push({ rentContractCount: { gt: 0 }, rentTotalSum: 0 });
    } else if (c === CAT_HAS_RENT) {
      and.push({ rentContractCount: { gt: 0 }, rentTotalSum: { gt: 0 } });
    } else if (c === CAT_HAS_VACANT_AREA) {
      // Bo'sh maydoni bor = ijarasi bor, lekin foydali maydon to'liq band emas.
      and.push({ rentContractCount: { gt: 0 } });
      and.push({ vacantArea: { gt: 0 } });
    } else if (c === CAT_VACANT) {
      // "Bo'sh turgan" DB ustunlarida hech qachon literal 11 sifatida saqlanmaydi —
      // bu ikkala kategoriya ustuni ham null bo'lgan (hali hech narsaga biriktirilmagan) holat.
      and.push({ integrationCategoryCode: null, manualCategoryCode: null });
    } else {
      and.push({
        OR: [
          { integrationCategoryCode: c },
          { integrationCategoryCode: null, manualCategoryCode: c },
        ],
      });
    }
  }

  // Soha bo'yicha: obyekt qaysi tashkilot manbasiga tegishli.
  if (f.soha) and.push({ source: { name: f.soha } });
  // Aniq tashkilot (soha ichidagi bitta hudud yoki "Markaziy apparat") — soha filtri bilan AND birikadi.
  if (f.sourceId) and.push({ sourceId: f.sourceId });

  // To'liq ijaraga berilgan — dashboard'dagi mos ustun bilan bir xil mantiq (stats.ts → rentRaw).
  if (f.fullyRented) and.push({ rentContractCount: { gt: 0 }, vacantArea: 0 });
  // "Ijaraga berilgan obyektlar" ustuni — faqat EFFEKTIV kategoriyasi 5 yoki 6 bo'lganlar
  // (boshqa kategoriyadagi, masalan savdodagi, ijara shartnomali obyektlar bu yerga kirmaydi).
  if (f.hasRentContract) {
    and.push({
      OR: [
        { integrationCategoryCode: CAT_FREE_USE },
        { integrationCategoryCode: null, manualCategoryCode: CAT_FREE_USE },
        { integrationCategoryCode: CAT_HAS_RENT },
        { integrationCategoryCode: null, manualCategoryCode: CAT_HAS_RENT },
      ],
    });
  }
  // "Auksion savdolarida (Xususiy. va Ijara)" ustuni — xususiylashtirish YOKI ijara savdosida.
  if (f.onAnyAuction) and.push({ OR: [{ hasPrivatizationLot: true }, { hasRentLot: true }] });

  if (typeof f.inefficient === "boolean") and.push({ isInefficient: f.inefficient });
  if (f.syncStatus) and.push({ syncStatus: f.syncStatus });

  return and.length ? { AND: and } : {};
}

export interface PropertyListItem {
  id: string;
  cadNumber: string;
  cadNumberOld: string | null;
  regionName: string;
  districtName: string | null;
  address: string | null;
  area: string | null;
  integrationCategoryCode: number | null;
  manualCategoryCode: number | null;
  isInefficient: boolean;
  syncStatus: SyncStatus;
  lotNumber: string | null;
  lotStatus: string | null;
  /** Bo'sh maydon (foydali − ijarada). "Bo'sh maydoni bor" filtri uchun ko'rsatiladi. */
  vacantArea: string | null;
}

export interface PropertyListResult {
  items: PropertyListItem[];
  page: number; // 1 dan boshlanadi
  pageCount: number;
  total: number;
}

// Sahifa raqamli (offset) pagination — foydalanuvchi sahifalar bo'ylab yura olishi uchun.
// 80k qatorda ham filtr ustunlari indekslangani uchun COUNT va OFFSET maqbul;
// juda chuqur sahifalarda OFFSET sekinlashadi, lekin amalda filtrlab ishlanadi.
export async function listProperties(
  user: SessionUser,
  filters: PropertyFilters,
  requestedPage = 1,
): Promise<PropertyListResult> {
  const where = await buildWhere(user, filters);

  const total = await prisma.property.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), pageCount);

  const rows = await prisma.property.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
    select: {
      id: true,
      cadNumber: true,
      cadNumberOld: true,
      address: true,
      area: true,
      integrationCategoryCode: true,
      manualCategoryCode: true,
      isInefficient: true,
      syncStatus: true,
      lotNumber: true,
      lotStatus: true,
      vacantArea: true,
      region: { select: { name: true } },
      district: { select: { name: true } },
    },
  });

  return {
    page,
    pageCount,
    total,
    items: rows.map((r) => ({
      id: r.id,
      cadNumber: r.cadNumber,
      cadNumberOld: r.cadNumberOld,
      regionName: r.region.name,
      districtName: r.district?.name ?? null,
      address: r.address,
      area: r.area ? r.area.toString() : null,
      integrationCategoryCode: r.integrationCategoryCode,
      manualCategoryCode: r.manualCategoryCode,
      isInefficient: r.isInefficient,
      syncStatus: r.syncStatus,
      lotNumber: r.lotNumber,
      lotStatus: r.lotStatus,
      vacantArea: r.vacantArea ? r.vacantArea.toString() : null,
    })),
  };
}

export interface PropertyExportRow {
  cadNumber: string;
  cadNumberOld: string | null;
  regionName: string;
  districtName: string | null;
  sourceName: string;
  name: string | null;
  address: string | null;
  area: number | null;
  buildingArea: number | null;
  integrationCategoryCode: number | null;
  manualCategoryCode: number | null;
  isInefficient: boolean;
  syncStatus: string;
  lastSyncedAt: Date | null;
  lotNumber: string | null;
  lotStatus: string | null;
  paymentTermMonths: number | null;
  auctionGroupName: string | null;
  rentContractCount: number | null;
  rentTotalSum: number | null;
  rentTotalArea: number | null;
  rentMatchedByOldCad: boolean;
}

// Eksport uchun keyset bo'yicha bo'lak-bo'lak o'qish — 80k qatorni
// bitta so'rovda xotiraga yuklamaslik uchun.
export async function* iteratePropertiesForExport(
  user: SessionUser,
  filters: PropertyFilters,
  batchSize = 1000,
): AsyncGenerator<PropertyExportRow[]> {
  const where = await buildWhere(user, filters);
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.property.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        cadNumber: true,
        cadNumberOld: true,
        name: true,
        address: true,
        area: true,
        buildingArea: true,
        integrationCategoryCode: true,
        manualCategoryCode: true,
        isInefficient: true,
        syncStatus: true,
        lastSyncedAt: true,
        lotNumber: true,
        lotStatus: true,
        paymentTermMonths: true,
        auctionGroupName: true,
        rentContractCount: true,
        rentTotalSum: true,
        rentTotalArea: true,
        rentMatchedByOldCad: true,
        region: { select: { name: true } },
        district: { select: { name: true } },
        source: { select: { name: true } },
      },
    });
    if (rows.length === 0) return;

    yield rows.map((r) => ({
      cadNumber: r.cadNumber,
      cadNumberOld: r.cadNumberOld,
      regionName: r.region.name,
      districtName: r.district?.name ?? null,
      sourceName: r.source.name,
      name: r.name,
      address: r.address,
      area: r.area ? Number(r.area) : null,
      buildingArea: r.buildingArea ? Number(r.buildingArea) : null,
      integrationCategoryCode: r.integrationCategoryCode,
      manualCategoryCode: r.manualCategoryCode,
      isInefficient: r.isInefficient,
      syncStatus: r.syncStatus,
      lastSyncedAt: r.lastSyncedAt,
      lotNumber: r.lotNumber,
      lotStatus: r.lotStatus,
      paymentTermMonths: r.paymentTermMonths,
      auctionGroupName: r.auctionGroupName,
      rentContractCount: r.rentContractCount,
      rentTotalSum: r.rentTotalSum ? Number(r.rentTotalSum) : null,
      rentTotalArea: r.rentTotalArea ? Number(r.rentTotalArea) : null,
      rentMatchedByOldCad: r.rentMatchedByOldCad,
    }));

    if (rows.length < batchSize) return;
    cursor = rows[rows.length - 1].id;
  }
}

// Obyekt tafsiloti (rol/hudud tekshiruvi bilan). Ruxsat yo'q bo'lsa null.
export async function getPropertyDetail(user: SessionUser, cadNumber: string) {
  const property = await prisma.property.findUnique({
    where: { cadNumber },
    include: {
      region: true,
      district: true,
      source: true,
      integrationCategory: true,
      manualCategory: true,
      statusChecks: { orderBy: { apiSource: "asc" } },
      rentContracts: { orderBy: [{ contractDate: "desc" }, { contractNumber: "asc" }] },
      auctionLots: { orderBy: [{ type: "asc" }, { auctionDate: "desc" }] },
      documents: { orderBy: { createdAt: "desc" } },
      assignments: {
        orderBy: { createdAt: "desc" },
        include: { category: true, document: true, assignedBy: { select: { fullName: true } } },
      },
      changeRequests: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          requestedBy: { select: { fullName: true } },
          moderator: { select: { fullName: true } },
          rahbar: { select: { fullName: true } },
          document: { select: { id: true, fileName: true } },
        },
      },
    },
  });
  if (!property) return null;
  // Obyekt sahifasi: ijrochi faqat o'z tashkilotining obyektini ocha oladi.
  if (user.role === "IJROCHI" && property.sourceId !== user.sourceId) return null;
  return property;
}
