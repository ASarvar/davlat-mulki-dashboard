import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { todayTashkent } from "@/lib/balance";
import { MANUAL_ONLY_SOHAS } from "@/lib/sourceLabel";
import { insertStatusCheckBulk } from "@/server/queue/dispatch";
import type { StatusCheckJob } from "@/server/queue/jobs";

/**
 * Xususiylashtirish lotlarini ish kuni davomida yangilash (kat 3, davijara API).
 *
 * ⚠️ Nima uchun jadval bo'yicha, hodisa bo'yicha emas: xususiylashtirish uchun
 * bizda hodisa manbai YO'Q — online-ijara jadvallarida ham, auksion reyestrida ham
 * faqat ijara (2026-10-20 jonli tekshiruv). Davlat aktivlari agentligidan manba
 * olinguncha yagona yo'l — API 3/4 ni o'zimiz so'rash. Bu jadval uning ritmiga mos:
 *  - savdolar HAR DOIM 10:00 da va faqat ish kunlari (jonli taqsimot, 2026-10-20);
 *  - lot qo'yish/to'xtatish ish soatlarida bo'ladi.
 *
 * Uch rejim (worker.ts dagi cron'lar):
 *  - `due`      — savdo sanasi bugun YOKI o'tib ketgan, hali "savdoda" turgan obyektlar.
 *                 Natija chiqqan lot keyingi safar o'zi tushib qoladi; sanasi o'tib
 *                 yangilanmay qolgan eski lotlarni ham shu tozalaydi.
 *  - `open`     — barcha ochiq lotli obyektlar (kunduzgi to'xtatish/bekor qilish).
 *  - `discover` — ochiq loti YO'Q obyektlar (yangi qo'yilgan lotni topish).
 *
 * Faqat auksion moduli (API 3/4 + API 6 — ajratib bo'lmaydi). `syncRunId` YO'Q —
 * `assertNoActiveRun()` ni bloklamaydi. Kunlik 03:00 to'liq sync zaxira bo'lib qoladi.
 */
export type PrivatizationRefreshMode = "due" | "open" | "discover";

/** Toshkent bo'yicha bugungi kun tugashi (UTC). Toshkent UTC+5, yozgi vaqt yo'q. */
function endOfTodayTashkentUtc(now = new Date()): Date {
  const [y, m, d] = todayTashkent(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1) - 5 * 3600_000);
}

function whereFor(mode: PrivatizationRefreshMode, now: Date): Prisma.PropertyWhereInput {
  // Agentlik va Direksiya — faqat qo'lda (`MANUAL_ONLY_SOHAS`).
  const base: Prisma.PropertyWhereInput = {
    removedFromBalance: false,
    source: { name: { notIn: MANUAL_ONLY_SOHAS } },
  };
  if (mode === "discover") return { ...base, hasPrivatizationLot: false };
  if (mode === "open") return { ...base, hasPrivatizationLot: true };
  return {
    ...base,
    hasPrivatizationLot: true,
    auctionLots: { some: { type: "PRIVATIZATION", auctionDate: { lt: endOfTodayTashkentUtc(now) } } },
  };
}

/** Navbatga qo'yilgan obyektlar soni. */
export async function enqueuePrivatizationRefresh(
  mode: PrivatizationRefreshMode,
  enqueue: (jobs: StatusCheckJob[]) => Promise<void> = insertStatusCheckBulk,
  now = new Date(),
): Promise<number> {
  const props = await prisma.property.findMany({
    where: whereFor(mode, now),
    select: { id: true, cadNumber: true, cadNumberOld: true },
  });
  if (props.length === 0) return 0;
  await enqueue(
    props.map((p) => ({
      propertyId: p.id,
      cadNumber: p.cadNumber,
      cadNumberOld: p.cadNumberOld,
      refreshBase: false,
      refreshAuction: true,
      refreshRent: false,
      refreshUtility: false,
    })),
  );
  return props.length;
}
