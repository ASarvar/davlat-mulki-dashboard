import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { parseApi4Date } from "@/server/integrations/auction";
import {
  auctionCredentials,
  fetchOrderPage,
  type AuctionCredential,
  type RawAuctionOrder,
} from "@/server/integrations/auctionOrders";

/**
 * Auksion buyurtmalari — sinxronlash va o'qish.
 *
 * ⚠️ MUSTAQIL: `Property`/`AuctionLot`/kategoriyalarga TEGMAYDI. Bu tarixiy reyestr
 * nusxasi, obyektlar monitoringi emas.
 */

// ── Xom javobni ustunlarga o'tkazish ────────────────────────────────────────

const str = (v: unknown): string | null => {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
};
const int = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
/** Pul ustunlari `Decimal(18,2)` — Prisma `number` ni ham qabul qiladi, `null` ni ham. */
const dec = (v: unknown): Prisma.Decimal | null => {
  const n = num(v);
  return n === null ? null : new Prisma.Decimal(n);
};

/**
 * ⚠️ `order_id` YO'Q bo'lgan yozuv TASHLANADI — u birlamchi kalit, usiz upsert
 * qilib bo'lmaydi. Skript bunday holatda butun jarayonni to'xtatardi; bu yerda
 * yozuv o'tkazib yuboriladi va soni hisobotda ko'rsatiladi.
 */
export function mapOrder(raw: RawAuctionOrder, credential: string) {
  const orderId = int(raw.order_id);
  if (orderId === null) return null;

  return {
    orderId,
    oldOrderId: int(raw.old_order_id),
    newOrderId: int(raw.new_order_id),
    credential,

    name: str(raw.name),
    region: str(raw.region),
    regionSoato: str(raw.region_soato),
    area: str(raw.area),
    areaSoato: str(raw.area_soato),
    address: str(raw.joylashgan_manzil),

    groupName: str(raw.group_name),
    categoryName: str(raw.category_name),
    categoryId: int(raw.category_id),

    orderStatus: str(raw.order_status),
    orderStatusesId: int(raw.order_statuses_id),
    lotStatus: str(raw.lot_status),
    lotStatusesId: int(raw.lot_statuses_id),
    lotNumber: str(raw.lot_number),

    startPrice: dec(raw.start_price),
    paidPrice: dec(raw.paid_price),
    soldPrice: dec(raw.sold_price),
    centerFee: dec(raw.center_fee),
    fullPricePaid: int(raw.full_price_paid),
    withDiscount: int(raw.with_discount),
    termPayment: int(raw.term_payment),
    termMonth: int(raw.term_month),

    lotPlaceDate: parseApi4Date(raw.lot_place_date),
    auctionDate: parseApi4Date(raw.auction_date),
    firstLotPlaceDate: parseApi4Date(raw.first_lot_place_date),
    firstAuctionDate: parseApi4Date(raw.first_auction_date),
    lotAcceptedTime: parseApi4Date(raw.lot_accepted_time),

    customerName: str(raw.customer_name),
    customerInn: str(raw.customer_inn),
    customerSoato: str(raw.customer_soato),

    winnerName: str(raw.winner_name),
    winnerInn: str(raw.winner_inn),
    winnerPassport: str(raw.winner_passport),
    winnerPinfl: str(raw.winner_pinfl),
    winnerPhone: str(raw.winner_phone),
    winnerAddress: str(raw.winner_address),
    winnerPassportDate: parseApi4Date(raw.winner_passport_date),
    winnerPassportIssuedBy: str(raw.winner_passport_issued_by),
    winnerSubjectType: int(raw.winner_subject_type),

    bankName: str(raw.bank_name),
    bankMfo: str(raw.bank_mfo),

    lat: num(raw.lat),
    lng: num(raw.lng),

    protocolFileUrl: str(raw.protocol_file_url),
    isDowngradeAuction: int(raw.is_downgrade_auction),
    propSet: int(raw.prop_set),
    acceptState: int(raw.accept_state),
    score: num(raw.score),

    raw: raw as Prisma.InputJsonValue,
    syncedAt: new Date(),
  };
}

// ── Sinxronlash ─────────────────────────────────────────────────────────────

export interface AuctionSyncResult {
  /** Akkaunt bo'yicha: nechta yozuv saqlandi. */
  perCredential: { name: string; saved: number; pages: number; error?: string }[];
  saved: number;
  /** `order_id` siz kelgan (saqlanmagan) yozuvlar. */
  skipped: number;
  /** Sana oralig'iga tushmagani uchun yozilmagan yozuvlar. */
  filtered: number;
  startedAt: Date;
  finishedAt: Date;
}

/** Run doirasi — nima yangilanadi. */
export interface AuctionSyncOptions {
  /** Sana oralig'i (`auctionDate`, u yo'q bo'lsa `lotPlaceDate` bo'yicha). */
  from?: Date;
  to?: Date;
  /** Akkaunt nomlari (QR, AND …). Bo'sh/berilmagan = hammasi. */
  credentials?: string[];
  startedById?: string;
}

/**
 * Joriy yil boshi (Toshkent) — kunlik cron shu bilan chaqiriladi.
 *
 * ⚠️ Nima uchun kunlik yangilash faqat joriy yil: tugagan auksionlar o'zgarmaydi,
 * ya'ni 2019–2025 yozuvlarini har kecha qayta yozish keraksiz.
 *
 * ⚠️ Bu VAQTNI deyarli tejamaydi — o'lchangan (2026-09-07): to'liq 16d37s ↔
 * joriy yil 15d3s. Sahifalar baribir to'liq o'qiladi (API filtrlay olmaydi),
 * vaqtning deyarli hammasi HTTP'da. Foydasi — bazaga yozish 68 196 → 11 890
 * (83% kam): kamroq WAL, kamroq bloat. Tezlik kerak bo'lsa AKKAUNT filtri.
 */
export function currentYearStart(): Date {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" }));
  return new Date(`${now.getFullYear()}-01-01T00:00:00`);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sana oralig'i — qaysi yozuvlar BAZAGA YOZILADI.
 *
 * ⚠️ Bu API filtri EMAS: `get-order` sana bo'yicha filtrlay olmaydi (54 parametr
 * nomi sinaldi — hech biri javobga ta'sir qilmadi) va tartib ham sana bo'yicha
 * emas (2026-yil yozuvlari 25-, 40-, 85-sahifalarda tarqoq). Ya'ni sahifalar
 * BARIBIR to'liq o'qiladi; tejash faqat bazaga yozishda (joriy yil ≈ 10%).
 */
export interface DateScope {
  from?: Date;
  to?: Date;
}

/**
 * Yozuv oraliqqa tushadimi.
 *
 * ⚠️ SANASI YO'Q yozuv HAR DOIM saqlanadi (fail-open). Jonli o'lchov (2026-09-07):
 * 5 307 yozuvda umuman sana yo'q va ularning 367 tasi HALI FAOL — "Buyurtma
 * yaratilgan/yuborilgan/tasdiqni kutish", ya'ni eng yangi buyurtmalar. Oddiy
 * sana filtri aynan ularni jimgina tashlab ketardi.
 */
function inScope(row: { auctionDate: Date | null; lotPlaceDate: Date | null }, scope: DateScope): boolean {
  if (!scope.from && !scope.to) return true;
  const d = row.auctionDate ?? row.lotPlaceDate;
  if (!d) return true;
  if (scope.from && d < scope.from) return false;
  if (scope.to && d > scope.to) return false;
  return true;
}

/** Sahifadagi yozuvlarni bazaga yozadi va nechtasi saqlanganini qaytaradi. */
async function persistPage(orders: RawAuctionOrder[], credName: string, scope: DateScope) {
  const rows = orders.map((o) => mapOrder(o, credName));
  const mapped = rows.filter((r): r is NonNullable<typeof r> => r !== null);
  const valid = mapped.filter((r) => inScope(r, scope));
  const filtered = mapped.length - valid.length;

  // ⚠️ Bitta `$transaction` — Prisma uni BITTA batch qilib yuboradi. Skript har
  // yozuv uchun alohida BEGIN/COMMIT qilardi, ya'ni 68 000 ta tranzaksiya.
  await prisma.$transaction(
    valid.map((data) =>
      prisma.auctionOrder.upsert({
        where: { orderId: data.orderId },
        // ⚠️ `createdAt` yangilanmaydi — birinchi ko'rilgan vaqt saqlanib qolsin.
        update: data,
        create: data,
      }),
    ),
  );

  return { saved: valid.length, skipped: rows.length - mapped.length, filtered };
}

/**
 * Bitta akkauntning barcha sahifasini yuklab, bazaga upsert qiladi.
 *
 * ⚠️ 1-sahifa ALOHIDA olinadi — jami sahifalar soni faqat undan ma'lum bo'ladi.
 * Qolganlari `AUCTION_ORDERS_CONCURRENCY` ta bo'lib, TO'PLAM-TO'PLAM yuklanadi.
 *
 * ⚠️ Bitta sahifaning xatosi (3 urinishdan keyin) butun akkauntni to'xtatadi —
 * ATAYLAB: yarim yuklangan ketma-ketlik "ma'lumot to'liq" degan yolg'on taassurot
 * berardi. Boshqa akkauntlar davom etadi va xato natijada ko'rsatiladi.
 */
async function syncCredential(
  cred: AuctionCredential,
  scope: DateScope,
  /** `saved` — SHU akkaunt bo'yicha shu paytgacha yozilgani (jamlanma emas). */
  onProgress?: (page: number, pages: number, saved: number) => Promise<void> | void,
): Promise<{ saved: number; skipped: number; filtered: number; pages: number }> {
  const first = await fetchOrderPage(cred, 1);
  const pages = first.pages;
  if (first.orders.length === 0) return { saved: 0, skipped: 0, filtered: 0, pages };

  const acc = await persistPage(first.orders, cred.name, scope);
  let saved = acc.saved;
  let skipped = acc.skipped;
  let filtered = acc.filtered;
  await onProgress?.(1, pages, saved);

  const conc = env.AUCTION_ORDERS_CONCURRENCY;
  for (let start = 2; start <= pages; start += conc) {
    const batch: number[] = [];
    for (let p = start; p < start + conc && p <= pages; p++) batch.push(p);

    // ⚠️ `Promise.all` — birontasi yiqilsa butun akkaunt to'xtaydi (yuqoridagi
    // izohga qarang). `allSettled` bo'lsa jimgina bo'shliq qolardi.
    const results = await Promise.all(batch.map((p) => fetchOrderPage(cred, p)));

    // ⚠️ To'plamdagi sahifalar BITTA tranzaksiyada yoziladi (4×50 = 200 upsert),
    // har sahifa uchun alohida emas — baza bilan aloqa 4 barobar kam bo'ladi.
    const merged = results.flatMap((r) => r.orders);
    if (merged.length > 0) {
      const r = await persistPage(merged, cred.name, scope);
      saved += r.saved;
      skipped += r.skipped;
      filtered += r.filtered;
    }

    await onProgress?.(Math.min(start + conc - 1, pages), pages, saved);
    if (env.AUCTION_ORDERS_DELAY_MS > 0) await delay(env.AUCTION_ORDERS_DELAY_MS);
  }

  return { saved, skipped, filtered, pages };
}

/**
 * Barcha akkauntlarni ketma-ket sinxronlaydi va jarayonni `AuctionSyncRun` ga yozadi.
 *
 * ⚠️ AKKAUNTLAR KETMA-KET, parallel emas: 14 ta akkauntni birga tortish shlyuzga
 * bir vaqtda 14 oqim berardi (kommunal API'lardagi saboq — bitta HTTP 500 butun
 * tekshiruvni yiqitgan). Parallellik faqat BITTA akkaunt ICHIDAGI sahifalarda,
 * `AUCTION_ORDERS_CONCURRENCY` bilan cheklangan.
 *
 * ⚠️ Progress SAHIFA to'plamlari yakunida yoziladi (~340 marta), har yozuvda emas —
 * aks holda 68 000 ta ortiqcha UPDATE bo'lardi.
 */
export async function syncAuctionOrders(opts: AuctionSyncOptions = {}): Promise<AuctionSyncResult> {
  const startedAt = new Date();
  const scope: DateScope = { from: opts.from, to: opts.to };

  // ⚠️ Noma'lum akkaunt nomi jimgina "hech narsa yangilanmadi" ga olib kelmasin —
  // tanlov bo'sh chiqsa hammasini olamiz emas, xato tashlaymiz.
  const all = auctionCredentials();
  const wanted = opts.credentials?.filter(Boolean) ?? [];
  const creds = wanted.length ? all.filter((c) => wanted.includes(c.name)) : all;
  if (wanted.length && creds.length === 0) {
    throw new Error(`Tanlangan akkaunt topilmadi: ${wanted.join(", ")}`);
  }

  const perCredential: AuctionSyncResult["perCredential"] = [];
  let saved = 0;
  let skipped = 0;
  let filtered = 0;

  const run = await prisma.auctionSyncRun.create({
    data: {
      credentialTotal: creds.length,
      startedById: opts.startedById ?? null,
      scopeFrom: opts.from ?? null,
      scopeTo: opts.to ?? null,
      scopeCredentials: creds.map((c) => c.name),
    },
  });

  try {
    for (const [i, cred] of creds.entries()) {
      await prisma.auctionSyncRun.update({
        where: { id: run.id },
        data: { credential: cred.name, credentialIndex: i + 1, page: 0, pages: 0 },
      });

      try {
        const r = await syncCredential(cred, scope, async (page, pages, credSaved) => {
          await prisma.auctionSyncRun.update({
            where: { id: run.id },
            // ⚠️ `saved` — oldingi akkauntlar jamlanmasi + SHU akkauntning joriy
            // hisobi. Faqat jamlanmani yozsak, ko'rsatkich butun akkaunt davomida
            // qotib turardi.
            data: { page, pages, saved: saved + credSaved, skipped },
          });
        });
        perCredential.push({ name: cred.name, saved: r.saved, pages: r.pages });
        saved += r.saved;
        skipped += r.skipped;
        filtered += r.filtered;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Auksion sinxronlash xatosi (${cred.name}): ${msg}`);
        perCredential.push({ name: cred.name, saved: 0, pages: 0, error: msg });
      }

      await prisma.auctionSyncRun.update({
        where: { id: run.id },
        data: { saved, skipped, filtered, perCredential },
      });
    }

    const failed = perCredential.filter((c) => c.error).length;
    await prisma.auctionSyncRun.update({
      where: { id: run.id },
      data: {
        // ⚠️ Uch xil yakun: hammasi ishlagan / ba'zilari xato bergan / hech biri
        // ishlamagan. "PARTIAL" ni "DONE" deb ko'rsatish ma'lumot to'liq degan
        // yolg'on taassurot berardi.
        status: failed === 0 ? "DONE" : failed === creds.length ? "FAILED" : "PARTIAL",
        finishedAt: new Date(),
        saved,
        skipped,
        filtered,
        perCredential,
      },
    });
  } catch (e) {
    // Kutilmagan yiqilish (masalan baza uzildi) — run "RUNNING" bo'lib osilib
    // qolmasin, aks holda keyingi urinish "allaqachon ketyapti" deb rad etilardi.
    await prisma.auctionSyncRun
      .update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          error: e instanceof Error ? e.message : String(e),
          saved,
          skipped,
          filtered,
          perCredential,
        },
      })
      .catch(() => {});
    throw e;
  }

  return { perCredential, saved, skipped, filtered, startedAt, finishedAt: new Date() };
}

/**
 * Ekranda ko'rsatish uchun oxirgi run.
 *
 * ⚠️ Keshlanmaydi — "hozir yangilanmoqda" ko'rsatkichi 60 soniya kechikib
 * ko'rinsa, foydalanuvchi tugmani qayta bosaverardi.
 */
export async function latestAuctionSyncRun() {
  return prisma.auctionSyncRun.findFirst({ orderBy: { startedAt: "desc" } });
}

/**
 * ⚠️ Osilib qolgan run'ni "tugagan" deb hisoblash chegarasi. Worker o'lib qolsa
 * (deploy, konteyner restart) yozuv abadiy `RUNNING` bo'lib qolardi va tugma
 * boshqa hech qachon ishlamasdi.
 *
 * ⚠️ `boss.ts` dagi `expireInSeconds` (1800s) BILAN MOSLASHTIRILGAN: pg-boss job'ni
 * 30 daqiqadan keyin qayta uradi, ya'ni ekran undan uzoqroq "yangilanmoqda" deb
 * turmasligi kerak. To'liq run ~7–8 daqiqa (jonli o'lchov, 2026-09-07).
 */
export const AUCTION_RUN_STALE_MINUTES = 30;

export function isRunStale(startedAt: Date): boolean {
  return Date.now() - startedAt.getTime() > AUCTION_RUN_STALE_MINUTES * 60_000;
}

// ── O'qish (ro'yxat sahifasi) ───────────────────────────────────────────────

export interface AuctionOrderFilters {
  /** Lot raqami, buyurtma ID, nomi yoki manzili bo'yicha qidiruv. */
  q?: string;
  credential?: string;
  region?: string;
  /** `order_statuses_id` — auksion holati. */
  statusId?: number;
  groupName?: string;
  /** Auksion sanasi oralig'i (YYYY-MM-DD). */
  from?: string;
  to?: string;
}

export const AUCTION_PAGE_SIZE = 50;

export function auctionWhere(f: AuctionOrderFilters): Prisma.AuctionOrderWhereInput {
  const and: Prisma.AuctionOrderWhereInput[] = [];

  if (f.q) {
    const q = f.q.trim();
    // ⚠️ Raqam kiritilsa `orderId` ni ham tekshiramiz — foydalanuvchi ko'pincha
    // buyurtma ID sini yoki lot raqamini nusxalab qo'yadi.
    const asId = Number(q);
    and.push({
      OR: [
        { lotNumber: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
        ...(Number.isFinite(asId) && Number.isInteger(asId) ? [{ orderId: asId }] : []),
      ],
    });
  }
  if (f.credential) and.push({ credential: f.credential });
  if (f.region) and.push({ region: f.region });
  if (f.statusId !== undefined) and.push({ orderStatusesId: f.statusId });
  if (f.groupName) and.push({ groupName: f.groupName });
  if (f.from) and.push({ auctionDate: { gte: new Date(`${f.from}T00:00:00`) } });
  if (f.to) and.push({ auctionDate: { lte: new Date(`${f.to}T23:59:59`) } });

  return and.length ? { AND: and } : {};
}

export async function listAuctionOrders(f: AuctionOrderFilters, page: number) {
  const where = auctionWhere(f);
  const [rows, total] = await Promise.all([
    prisma.auctionOrder.findMany({
      where,
      // ⚠️ `auctionDate` NULL bo'lgan yozuvlar bor — `nulls: "last"` busiz ular
      // ro'yxatning boshiga chiqib, eng yangi auksionlarni pastga surib yuborardi.
      orderBy: [{ auctionDate: { sort: "desc", nulls: "last" } }, { orderId: "desc" }],
      skip: (page - 1) * AUCTION_PAGE_SIZE,
      take: AUCTION_PAGE_SIZE,
    }),
    prisma.auctionOrder.count({ where }),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / AUCTION_PAGE_SIZE)) };
}

/**
 * Filtr tanlagichlari uchun — bazada haqiqatan uchraydigan qiymatlar.
 *
 * ⚠️ KESHLANADI: beshta `groupBy` 68 000 qatorni to'liq skanerlaydi va bu har
 * sahifa ochilganda takrorlanardi. Qiymatlar faqat sinxronizatsiyadan keyin
 * o'zgaradi, ya'ni 5 daqiqalik TTL xavfsiz.
 *
 * ⚠️ `unstable_cache` Next so'rov konteksti TASHQARISIDA yiqiladi — worker bu
 * funksiyani chaqirmaydi, faqat sahifa chaqiradi (`snapshots.ts` dagi bilan bir
 * xil ehtiyot).
 */
export const auctionFacets = unstable_cache(computeAuctionFacets, ["auction-facets-v1"], {
  tags: ["auction-orders"],
  revalidate: 300,
});

async function computeAuctionFacets() {
  const [credentials, regions, statuses, groups] = await Promise.all([
    prisma.auctionOrder.groupBy({ by: ["credential"], _count: true, orderBy: { credential: "asc" } }),
    prisma.auctionOrder.groupBy({ by: ["region"], _count: true, orderBy: { region: "asc" } }),
    prisma.auctionOrder.groupBy({
      by: ["orderStatusesId", "orderStatus"],
      _count: true,
      orderBy: { orderStatusesId: "asc" },
    }),
    prisma.auctionOrder.groupBy({ by: ["groupName"], _count: true, orderBy: { groupName: "asc" } }),
  ]);
  return {
    credentials: credentials.map((c) => c.credential),
    regions: regions.map((r) => r.region).filter((r): r is string => Boolean(r)),
    statuses: statuses
      .filter((s) => s.orderStatusesId !== null)
      .map((s) => ({ id: s.orderStatusesId as number, label: s.orderStatus ?? `#${s.orderStatusesId}` })),
    groups: groups.map((g) => g.groupName).filter((g): g is string => Boolean(g)),
  };
}

/**
 * Jami soni va oxirgi yangilanish vaqti — ATAYLAB keshlanmaydi.
 *
 * ⚠️ Nima uchun `auctionFacets()` dan ajratilgan: worker alohida process bo'lgani
 * uchun `revalidateTag` chaqira olmaydi (CLAUDE.md qoidasi), ya'ni kesh faqat TTL
 * bilan eskiradi. Sinxronizatsiya tugagach foydalanuvchi ekranda "yakunlandi —
 * 68 196 yozuv" ni ko'rib turib, tepada eski sonni ko'rsa bu xatoga o'xshardi.
 * Bu ikki qiymat arzon (PK bo'yicha `count` + `max`), shuning uchun har safar
 * yangi o'qiladi.
 */
export async function auctionTotals() {
  // ⚠️ Akkauntlar SONI ham shu yerda, keshlangan `auctionFacets()` da EMAS:
  // sinxronizatsiya tugagach sarlavhada "68 196 buyurtma (9 ta akkaunt)" degan
  // qarama-qarshi matn chiqqan edi (kesh 9 akkaunt bo'lgan paytdan qolgan).
  // `credential` ustunida indeks bor, 14 ta aniq qiymat — arzon so'rov.
  const [agg, creds] = await Promise.all([
    prisma.auctionOrder.aggregate({ _max: { syncedAt: true }, _count: true }),
    prisma.auctionOrder.groupBy({ by: ["credential"] }),
  ]);
  return { totalRows: agg._count, lastSyncedAt: agg._max.syncedAt, credentialCount: creds.length };
}
