import { prisma } from "@/lib/prisma";
import { MANUAL_ONLY_SOHAS } from "@/lib/sourceLabel";
import { auctionDb } from "@/server/db/auctionDb";
import {
  auctionConfigured,
  auctionCredentials,
  fetchOrderDetails,
} from "@/server/integrations/auctionOrders";
import { extractDetails } from "@/server/services/auctionOrderDetails";
import { insertStatusCheckBulk } from "@/server/queue/dispatch";
import type { StatusCheckJob } from "@/server/queue/jobs";

/**
 * Ijara auksioni hodisalari — online-ijara bazasidagi `auction_logs` orqali
 * (deyarli real vaqt, har daqiqada).
 *
 * Zanjir (jonli tekshirilgan, 2026-10-20):
 *   auction_logs (action = 'e-auction_push') ─ object_id ─▶ auctions.object_id
 *   auctions.id = e-auksion `order_id` ─▶ AuctionLot.orderId / Property.auctionOrderId
 *
 * `e-auction_push` — e-auksion online-ijara'ning webhook'iga (`/api/v1/auction/order/event`)
 * yuborgan bildirishnoma. Biz o'zgargan buyurtmaning obyektini topib, uni auksion
 * (API 3/4 + API 6) va ijara (API 5) bo'yicha qayta tekshiruvga qo'yamiz.
 *
 * ⚠️ FAQAT IJARA. Bu jadvallarda xususiylashtirish YO'Q (jonli: bizning 2 343
 * xususiylashtirish `order_id` sidan 0 tasi `auctions` da) — kat 3 kunlik sync'da qoladi.
 * ⚠️ Faqat O'QIYMIZ va ustunlarni NOMMA-NOM: `auctions` da g'olibning shaxsiy
 * ma'lumoti va `username`/`password` ustunlari bor — `SELECT *` qilinmasin.
 * ⚠️ `auction_logs` da `created_at`/`action` ga indeks YO'Q (~800 ming qator) —
 * shuning uchun faqat birlamchi kalit (`id`) oralig'i bo'yicha o'qiladi.
 */

export const CURSOR_KEY = "online-ijara:auction_logs";
const PUSH_ACTION = "e-auction_push";

/** Bir aylanishda ko'rib chiqiladigan eng katta `id` oralig'i (orqada qolsa bo'lib-bo'lib yetib oladi). */
const MAX_SPAN = 50_000n;

/**
 * Bizda hali yo'q buyurtmaning kadastrini `get-order` dan olish — bir aylanishda
 * shuncha buyurtma va shuncha vaqt. Akkaunti noma'lum buyurtma uchun 14 tagacha
 * so'rov ketadi; job `expireInSeconds` (120s) dan oshmasin.
 */
const MAX_LOOKUPS = 10;
const LOOKUP_BUDGET_MS = 60_000;

/**
 * Kadastri topilmagan (yoki obyekti bizda yo'q) buyurtma shuncha vaqt qayta
 * so'ralmaydi. Boshqa tashkilotlar obyektlarining hodisalari doim keladi —
 * keshsiz har daqiqada 14 tadan so'rov ketardi.
 */
const MISS_TTL_MS = 6 * 3600_000;
const missCache = new Map<number, number>();

export interface RentEventsResult {
  /** Kursor yo'q edi — hozirgi oxirgi `id` dan boshlandi (tarix qayta o'ynalmaydi). */
  initialized: boolean;
  events: number;
  orders: number;
  /** `auctions` da topilmagan `object_id` lar. */
  orphanEvents: number;
  /** Qayta tekshiruvga qo'yilgan obyektlar. */
  properties: number;
  /** Obyekti aniqlanmagan buyurtmalar (bizning balansda emas yoki kadastri yo'q). */
  unresolved: number;
  lookups: number;
}

const empty = (initialized = false): RentEventsResult => ({
  initialized,
  events: 0,
  orders: 0,
  orphanEvents: 0,
  properties: 0,
  unresolved: 0,
  lookups: 0,
});

/**
 * Bizda yo'q buyurtmaning kadastri.
 *
 * Akkaunt (login) ma'lum bo'lsa (`AuctionOrder.customerInn`) — faqat o'sha bilan;
 * aks holda sozlangan akkauntlar birma-bir sinanadi (`not_found` → keyingisi).
 * ⚠️ Xato xabariga login/parol QO'SHILMAYDI.
 */
async function lookupCadastre(
  orderId: number,
  customerInn: string | null,
  deadline: number,
): Promise<{ cadastre: string | null; calls: number }> {
  const creds = auctionCredentials();
  const passwordByLogin = new Map(creds.map((c) => [c.username, c.password]));
  // Reyestrdagi qoida (`auctionOrderDetails.ts`): login = parol = STIR, sozlangani ustun.
  const tries = customerInn
    ? [{ username: customerInn, password: passwordByLogin.get(customerInn) ?? customerInn }]
    : creds;

  let calls = 0;
  for (const c of tries) {
    if (Date.now() > deadline) break;
    calls++;
    const res = await fetchOrderDetails(orderId, c.username, c.password);
    if (res.status !== "ok") continue;
    return { cadastre: extractDetails(res.details).cadastreNumber, calls };
  }
  return { cadastre: null, calls };
}

/**
 * Bitta aylanish: kursordan keyingi `e-auction_push` hodisalarini o'qiydi, obyektlarni
 * topadi va qayta tekshiruvga qo'yadi. Kursor faqat navbatga qo'yilgandan KEYIN
 * suriladi — xato bo'lsa keyingi daqiqada shu oraliq qayta o'qiladi.
 *
 * ⚠️ Ma'lum cheklov: `id` ketma-ketligi commit tartibi emas. Kichik `id` li yozuv
 * kattarog'idan keyin commit bo'lsa (bir soniya ichidagi parallel tranzaksiyalar),
 * u o'tkazib yuborilishi mumkin. Bunday holatni kunlik 03:00 sync qoplaydi.
 */
export async function pollRentAuctionEvents(
  enqueue: (jobs: StatusCheckJob[]) => Promise<void> = insertStatusCheckBulk,
): Promise<RentEventsResult | null> {
  const db = auctionDb();
  if (!db) return null;

  const [{ max }] = await db.$queryRaw<{ max: bigint | null }[]>`SELECT max(id) AS max FROM auction_logs`;
  if (max === null) return empty();

  const cursor = await prisma.externalCursor.findUnique({ where: { key: CURSOR_KEY } });
  // Birinchi ishga tushish (yoki jadval qayta yaratilgan): tarixni qayta o'ynamaymiz —
  // ~800 ming eski hodisa ming-minglab keraksiz tekshiruv bo'lardi, ularni kunlik sync qamragan.
  if (!cursor || cursor.lastId > max) {
    await prisma.externalCursor.upsert({
      where: { key: CURSOR_KEY },
      create: { key: CURSOR_KEY, lastId: max },
      update: { lastId: max },
    });
    return empty(true);
  }

  const from = cursor.lastId;
  const to = max - from > MAX_SPAN ? from + MAX_SPAN : max;
  if (to <= from) return empty();

  const rows = await db.$queryRaw<{ order_id: bigint | null; n: number }[]>`
    SELECT a.id AS order_id, count(*)::int AS n
    FROM auction_logs l
    LEFT JOIN auctions a ON a.object_id = l.object_id
    WHERE l.id > ${from} AND l.id <= ${to} AND l.action = ${PUSH_ACTION}
    GROUP BY a.id`;

  const r = empty();
  for (const row of rows) {
    r.events += row.n;
    if (row.order_id === null) r.orphanEvents += row.n;
  }
  const orderIds = rows
    .map((row) => (row.order_id === null ? NaN : Number(row.order_id)))
    .filter((n) => Number.isSafeInteger(n) && n > 0);
  r.orders = orderIds.length;

  const propertyIds = new Set<string>();
  if (orderIds.length > 0) {
    // 1) Bizga ma'lum buyurtmalar — lot yoki obyektning o'zida.
    const [lots, props] = await Promise.all([
      prisma.auctionLot.findMany({
        where: { orderId: { in: orderIds } },
        select: { orderId: true, propertyId: true },
      }),
      prisma.property.findMany({
        where: { auctionOrderId: { in: orderIds } },
        select: { id: true, auctionOrderId: true },
      }),
    ]);
    const known = new Set<number>();
    for (const l of lots) {
      propertyIds.add(l.propertyId);
      if (l.orderId !== null) known.add(l.orderId);
    }
    for (const p of props) {
      propertyIds.add(p.id);
      if (p.auctionOrderId !== null) known.add(p.auctionOrderId);
    }

    // 2) Yangi buyurtma — kadastr orqali (avval reyestrdan, bo'lmasa get-order'dan).
    const unknown = orderIds.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      const now = Date.now();
      const registry = await prisma.auctionOrder.findMany({
        where: { orderId: { in: unknown } },
        select: { orderId: true, cadastreNumber: true, customerInn: true },
      });
      const byOrder = new Map(registry.map((o) => [o.orderId, o]));
      const cadByOrder = new Map<number, string>();
      const deadline = now + LOOKUP_BUDGET_MS;

      for (const orderId of unknown) {
        const reg = byOrder.get(orderId);
        if (reg?.cadastreNumber) {
          cadByOrder.set(orderId, reg.cadastreNumber);
          continue;
        }
        const missedAt = missCache.get(orderId);
        if (missedAt !== undefined && now - missedAt < MISS_TTL_MS) continue;
        if (!auctionConfigured() || r.lookups >= MAX_LOOKUPS || Date.now() > deadline) continue;
        try {
          const res = await lookupCadastre(orderId, reg?.customerInn ?? null, deadline);
          r.lookups++;
          if (res.cadastre) cadByOrder.set(orderId, res.cadastre);
          else missCache.set(orderId, now);
        } catch (e) {
          // Tarmoq xatosi — keshlamaymiz, keyingi hodisada qayta urinadi.
          console.warn(`[rent-events] buyurtma ${orderId} kadastri olinmadi:`, e instanceof Error ? e.message : e);
        }
      }

      const cads = [...new Set(cadByOrder.values())];
      const found =
        cads.length > 0
          ? await prisma.property.findMany({
              where: { OR: [{ cadNumber: { in: cads } }, { cadNumberOld: { in: cads } }] },
              select: { id: true, cadNumber: true, cadNumberOld: true },
            })
          : [];
      const matchedCads = new Set<string>();
      for (const p of found) {
        propertyIds.add(p.id);
        matchedCads.add(p.cadNumber);
        if (p.cadNumberOld) matchedCads.add(p.cadNumberOld);
      }
      for (const orderId of unknown) {
        const cad = cadByOrder.get(orderId);
        if (cad && matchedCads.has(cad)) continue;
        r.unresolved++;
        // Kadastri bor, lekin obyekt bizning balansda emas — ham qayta so'ralmasin.
        if (cad) missCache.set(orderId, now);
      }
    }
  }

  if (propertyIds.size > 0) {
    const targets = await prisma.property.findMany({
      // Balansdan chiqarilganlarni yangilashning ma'nosi yo'q (`triggerStatusRefresh` bilan bir xil).
      // Agentlik va Direksiya — faqat qo'lda (`MANUAL_ONLY_SOHAS`).
      where: {
        id: { in: [...propertyIds] },
        removedFromBalance: false,
        source: { name: { notIn: MANUAL_ONLY_SOHAS } },
      },
      select: { id: true, cadNumber: true, cadNumberOld: true },
    });
    // ⚠️ `syncRunId` YO'Q: bu SyncRun emas — `assertNoActiveRun()` ni bloklamaydi va
    // qo'lda boshlanadigan sync'larga xalaqit bermaydi. Faqat auksion + ijara moduli:
    // asosiy ma'lumot (API 2) va kommunal o'zgarmagan.
    await enqueue(
      targets.map((p) => ({
        propertyId: p.id,
        cadNumber: p.cadNumber,
        cadNumberOld: p.cadNumberOld,
        refreshBase: false,
        refreshAuction: true,
        refreshRent: true,
        refreshUtility: false,
      })),
    );
    r.properties = targets.length;
  }

  await prisma.externalCursor.update({ where: { key: CURSOR_KEY }, data: { lastId: to } });

  // Kesh cheksiz o'smasin.
  if (missCache.size > 5_000) {
    const cutoff = Date.now() - MISS_TTL_MS;
    for (const [k, t] of missCache) if (t < cutoff) missCache.delete(k);
  }
  return r;
}
