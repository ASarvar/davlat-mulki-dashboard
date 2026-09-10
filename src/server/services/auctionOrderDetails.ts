import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { parseAreaText } from "@/server/integrations/auction";
import {
  auctionCredentials,
  fetchOrderDetails,
  type OrderDetail,
} from "@/server/integrations/auctionOrders";
import { updateOrderDetailsExternal } from "@/server/services/auctionOrdersExternal";
import { currentYearStart } from "@/server/services/auctionOrders";

/**
 * Auksion buyurtmalarining TAFSILOTLARI — ijara maydoni va kadastr raqami.
 *
 * ⚠️ Nima uchun alohida bosqich: ommaviy `get-order` (sahifalab) javobida
 * `details` UMUMAN YO'Q — 68 196 yozuvning hammasida `null` (2026-09-10). Ular
 * faqat BITTA buyurtma so'ralganda keladi (`order: <id>`). Ilgari buni ikkita
 * mustaqil skript qilardi va faqat tashqi bazaga yozardi.
 *
 * ⚠️ Skriptlardan farqlar (ataylab):
 *  - `detailsCheckedAt` — kalit topilmagan buyurtma har safar qayta so'ralmaydi
 *    (skriptlar `IS NULL` bo'yicha tanlardi va bunday buyurtmani abadiy qayta
 *    so'rardi). Qiymati hali bo'sh buyurtma `RECHECK_DAYS` da bir qayta so'raladi —
 *    keyinroq to'ldirilgan bo'lsa ushlanadi.
 *  - Javobdagi `order_id` so'ralgani bilan solishtiriladi (`fetchOrderDetails`).
 *  - Maydon `parseAreaText()` bilan o'qiladi — API4 dagi "Amalda" qoidasi.
 *  - Tashqi bazada faqat BO'SH qiymat to'ldiriladi (`COALESCE`) — skriptlar ham
 *    faqat `IS NULL` qatorlarni yozardi.
 */

export const RENT_AREA_KEY = "rent_ijara_maydoni_kvm";
export const CADASTRE_KEY = "cadastr_number";

/** Qiymati hali bo'sh buyurtma necha kundan keyin qayta so'raladi. */
const RECHECK_DAYS = 7;

/** Bir marta bazadan olinadigan nomzodlar. */
const BATCH = 200;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ijara maydoni. `0` ham "qiymat yo'q" (CLAUDE.md: bo'sh maydon `0` bo'lib keladi).
 * Matn — `parseAreaText()` orqali (vergulli o'nlik, "Amalda" qoidasi).
 */
export function parseRentArea(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  const n = parseAreaText(v);
  return n !== null && n > 0 ? n : null;
}

export function extractDetails(details: OrderDetail[]): {
  rentArea: number | null;
  cadastreNumber: string | null;
} {
  const val = (k: string) => details.find((d) => d.key === k)?.value;
  const cad = val(CADASTRE_KEY);
  const cadastreNumber = cad === null || cad === undefined ? null : String(cad).trim() || null;
  return { rentArea: parseRentArea(val(RENT_AREA_KEY)), cadastreNumber };
}

/**
 * Tekshiriladigan buyurtmalar — skriptlardagi filtr, faqat yil qattiq
 * `2026-01-01` emas, JORIY yil boshi (yil almashganda qotib qolmasin).
 *
 * ⚠️ `NOT IN (7)` semantikasi aynan saqlanadi: SQL da NULL qiymat ham chiqib
 * ketadi, shuning uchun `not: null` aniq yozilgan.
 */
export function detailsCandidatesWhere(from: Date, now = new Date()): Prisma.AuctionOrderWhereInput {
  const recheckBefore = new Date(now.getTime() - RECHECK_DAYS * 86_400_000);
  return {
    AND: [
      { OR: [{ auctionDate: { gte: from } }, { lotPlaceDate: { gte: from } }] },
      // status 7 — "Buyurtma bekor qilingan"; toifa 7 — "Yengil" (skriptlardagi kabi).
      { orderStatusesId: { not: null } },
      { NOT: { orderStatusesId: 7 } },
      { categoryId: { not: null } },
      { NOT: { categoryId: 7 } },
      { customerInn: { not: null } },
      {
        OR: [
          { detailsCheckedAt: null },
          {
            AND: [
              { detailsCheckedAt: { lt: recheckBefore } },
              { OR: [{ rentArea: null }, { cadastreNumber: null }] },
            ],
          },
        ],
      },
    ],
  };
}

export interface DetailsSyncResult {
  /** Boshlanishdagi nomzodlar soni. */
  candidates: number;
  /** Javob olingan (topildi + topilmadi). */
  checked: number;
  withRentArea: number;
  withCadastre: number;
  notFound: number;
  /** Javobda BOSHQA buyurtma qaytgan — hech narsa yozilmadi. */
  mismatched: number;
  /** Tarmoq/API xatosi (qayta urinishlardan keyin) — keyingi safar yana so'raladi. */
  failed: number;
  externalUpdated: number;
  externalFailed: number;
  /** Tugagandan keyin qolgan nomzodlar. */
  remaining: number;
  stoppedByBudget: boolean;
  firstError?: string;
  ms: number;
}

export interface DetailsSyncOptions {
  from?: Date;
  /** Vaqt chegarasi (ms). Standart — `AUCTION_DETAILS_BUDGET_MINUTES`. */
  budgetMs?: number;
  /** Ko'pi bilan nechta buyurtma (qo'lda / sinov uchun). */
  limit?: number;
}

/**
 * ⚠️ TIZIMLI nosozlikda to'xtaymiz — aks holda 6 000 ta buyurtmaning har biri
 * backoff bilan 3 marta urinib, soatlab behuda ketardi.
 */
function assertNotSystemic(r: DetailsSyncResult) {
  if (r.mismatched >= 10 && r.checked === 0) {
    throw new Error(
      `get-order "order" parametrini hisobga olmayapti: ${r.mismatched} ta javobda boshqa buyurtma qaytdi — hech narsa yozilmadi`,
    );
  }
  if (r.failed >= 20 && r.checked === 0) {
    throw new Error(`get-order'ga ulanib bo'lmadi (${r.failed} ta buyurtma): ${r.firstError ?? "noma'lum xato"}`);
  }
}

async function processOne(
  row: { orderId: number; customerInn: string | null },
  passwordByLogin: Map<string, string>,
  r: DetailsSyncResult,
): Promise<void> {
  const login = row.customerInn as string;
  // ⚠️ Skriptlarda login ham, parol ham `customer_inn` edi — 14 viloyat akkauntida
  // login = parol = STIR. Sozlangan akkaunt topilsa O'SHANING paroli olinadi:
  // parol keyinchalik almashtirilsa, faqat `.env` yangilanadi, kod emas.
  const password = passwordByLogin.get(login) ?? login;

  let res;
  try {
    res = await fetchOrderDetails(row.orderId, login, password);
  } catch (e) {
    // `detailsCheckedAt` QO'YILMAYDI — keyingi safar qayta so'raladi.
    r.failed++;
    r.firstError ??= e instanceof Error ? e.message : String(e);
    return;
  }

  if (res.status === "mismatch") {
    r.mismatched++;
    return;
  }

  const now = new Date();
  if (res.status === "not_found") {
    r.checked++;
    r.notFound++;
    await prisma.auctionOrder.update({ where: { orderId: row.orderId }, data: { detailsCheckedAt: now } });
    return;
  }

  const { rentArea, cadastreNumber } = extractDetails(res.details);
  r.checked++;
  if (rentArea !== null) r.withRentArea++;
  if (cadastreNumber !== null) r.withCadastre++;

  await prisma.auctionOrder.update({
    where: { orderId: row.orderId },
    data: {
      // ⚠️ `undefined` = tegmaslik: bu safar kalit kelmasa, oldingi qiymat qolsin.
      rentArea: rentArea === null ? undefined : new Prisma.Decimal(rentArea),
      cadastreNumber: cadastreNumber ?? undefined,
      detailsCheckedAt: now,
    },
  });

  try {
    if (await updateOrderDetailsExternal(row.orderId, rentArea, cadastreNumber)) r.externalUpdated++;
  } catch (e) {
    // ⚠️ Tashqi bazaning xatosi bizning yozuvimizni to'xtatmaydi (ommaviy
    // sinxronizatsiyadagi bilan bir xil qoida).
    r.externalFailed++;
    r.firstError ??= `tashqi baza: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/**
 * Nomzodlarni YANGISIDAN boshlab (orderId kamayishi bo'yicha) tekshiradi.
 *
 * ⚠️ VAQT CHEGARASI bor: birinchi to'ldirish ~6 000 so'rov. Chegaraga yetsa
 * to'xtaydi (`stoppedByBudget`) va worker davomini navbatga qo'yadi — job
 * `expireInSeconds` (30 daqiqa) dan hech qachon oshmaydi.
 * ⚠️ Kursor `orderId` bo'yicha: xato bergan buyurtma nomzodligicha qoladi, kursorsiz
 * esa sikl uni qayta-qayta olib, oldinga siljimasdi.
 */
export async function syncAuctionOrderDetails(opts: DetailsSyncOptions = {}): Promise<DetailsSyncResult> {
  const started = Date.now();
  const from = opts.from ?? currentYearStart();
  const deadline = started + (opts.budgetMs ?? env.AUCTION_DETAILS_BUDGET_MINUTES * 60_000);
  const passwordByLogin = new Map(auctionCredentials().map((c) => [c.username, c.password]));
  const where = detailsCandidatesWhere(from);
  const limit = opts.limit ?? Number.POSITIVE_INFINITY;
  const conc = env.AUCTION_ORDERS_CONCURRENCY;

  const r: DetailsSyncResult = {
    candidates: await prisma.auctionOrder.count({ where }),
    checked: 0,
    withRentArea: 0,
    withCadastre: 0,
    notFound: 0,
    mismatched: 0,
    failed: 0,
    externalUpdated: 0,
    externalFailed: 0,
    remaining: 0,
    stoppedByBudget: false,
    ms: 0,
  };

  let processed = 0;
  let cursor: number | undefined;

  outer: while (processed < limit) {
    const rows = await prisma.auctionOrder.findMany({
      where: cursor === undefined ? where : { AND: [where, { orderId: { lt: cursor } }] },
      select: { orderId: true, customerInn: true },
      orderBy: { orderId: "desc" },
      take: Math.min(BATCH, limit - processed),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].orderId;

    for (let i = 0; i < rows.length; i += conc) {
      if (Date.now() >= deadline) {
        r.stoppedByBudget = true;
        break outer;
      }
      const chunk = rows.slice(i, i + conc);
      await Promise.all(chunk.map((row) => processOne(row, passwordByLogin, r)));
      processed += chunk.length;
      assertNotSystemic(r);
      if (env.AUCTION_ORDERS_DELAY_MS > 0) await delay(env.AUCTION_ORDERS_DELAY_MS);
    }
  }

  r.remaining = await prisma.auctionOrder.count({ where: detailsCandidatesWhere(from) });
  r.ms = Date.now() - started;
  return r;
}
