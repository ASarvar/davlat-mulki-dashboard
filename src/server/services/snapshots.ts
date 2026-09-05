import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sourceCond, type StatsScope } from "./stats";

/**
 * Kunlik snapshot — boshqaruv paneli ko'rsatkichlarining TARIXI.
 *
 * ⚠️ **Nima uchun kerak:** `Property` ning statistika ustunlari har sinxronizatsiyada
 * ustidan yoziladi. Hodisaviy trendlar (`trends.ts`) faqat shartnoma/lot sanasini
 * beradi — "kecha nechta obyekt bo'sh turgan edi" degan savolga javob YO'Q.
 *
 * ⚠️ **Tarixni backfill qilib BO'LMAYDI.** Shuning uchun grafik faqat kamida ikki
 * kunlik o'lchov bo'lganda ko'rsatiladi (`MIN_DAYS`) — bitta nuqtadan chizilgan
 * tekis chiziq "hech narsa o'zgarmadi" degan yolg'on xulosa berardi.
 *
 * ⚠️ **Bu faylni WORKER ham import qiladi** (`queue/worker.ts` — `tsx`, Next'siz).
 * Yozish yo'li (`takeDashboardSnapshot`) shuning uchun faqat xom SQL ishlatadi va
 * `unstable_cache` ga UMUMAN tegmaydi: kesh o'rami Next so'rov konteksti tashqarisida
 * chaqirilsa yiqiladi (`dashboardExport.ts` dagi bilan bir xil tuzoq). Import o'zi
 * xavfsiz — faqat CHAQIRUV muammoli, shuning uchun worker `getKpiHistory()` ni
 * hech qachon chaqirmasligi kerak.
 */

/** Grafik ochilishi uchun zarur minimal o'lchovlar soni. */
export const MIN_DAYS = 2;

/** Grafikda ko'rsatiladigan oxirgi kunlar soni. */
const HISTORY_DAYS = 90;

/**
 * Effektiv kategoriya 11 ("Bo'sh turgan") sharti.
 *
 * ⚠️ `Property.isInefficient` ustuni EMAS: kartadagi son `byCategory` (effektiv
 * kategoriya) dan olinadi, shuning uchun snapshot ham AYNAN shu ifodadan hisoblanadi.
 * Ikkalasi matematik teng (`computeIsInefficient()`), lekin bir xil sonni ikki xil
 * manbadan olish — bu loyihada allaqachon bir marta farqqa olib kelgan naqsh.
 */
const VACANT = Prisma.sql`COALESCE(p."integrationCategoryCode", p."manualCategoryCode", 11) = 11`;

export interface SnapshotResult {
  /** "YYYY-MM-DD" — Asia/Tashkent kuni. */
  day: string;
  /** Yozilgan (manba, hudud) juftliklari soni. */
  rows: number;
  /** Kun ichida qayta olinganda eskirib qolgan qatorlar (odatda 0). */
  removed: number;
}

/**
 * Joriy holatni bugungi kunga yozadi (idempotent — kun ichida qayta chaqirilsa
 * qatorlar YANGILANADI, dublikat yaratilmaydi).
 *
 * ⚠️ Faol sinxronizatsiya paytida ishlamaydi: yarim yangilangan holat trendda
 * soxta sakrash berardi. Shuning uchun cron 02:00 da — kunlik sync (03:00) dan OLDIN.
 */
export async function takeDashboardSnapshot(): Promise<SnapshotResult> {
  const active = await prisma.syncRun.findFirst({
    where: { status: { in: ["QUEUED", "RUNNING"] } },
    select: { type: true },
  });
  if (active) {
    throw new Error(
      `Sinxronizatsiya ketmoqda (${active.type}) — snapshot olinmadi. ` +
        `Yarim yangilangan holat yozilsa trendda soxta sakrash chiqardi. Tugashini kuting.`,
    );
  }

  // Kun ham, o'lchov vaqti ham BITTA so'rovdan — ilova va baza soatlari farq qilsa ham
  // `day` bilan `takenAt` doim izchil bo'ladi.
  const [now] = await prisma.$queryRaw<{ day: string; takenAt: Date }[]>(Prisma.sql`
    SELECT to_char((now() AT TIME ZONE 'Asia/Tashkent')::date, 'YYYY-MM-DD') AS day,
           now() AS "takenAt"
  `);
  const { day, takenAt } = now;

  // ⚠️ Doira sharti `sourceCond()` dan — balansdan chiqarilgan obyektlar bu yerda ham
  // hisobga kirmasligi kerak (shartni qo'lda yozish o'sha qoidani ikkiga bo'lardi).
  // Snapshot HAMMA manba bo'yicha olinadi (bo'sh doira) — kesimlar o'qishda yig'iladi.
  const cond = sourceCond({}, Prisma.sql`p.`);

  const rows = await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DashboardSnapshot" (
      "day", "sourceId", "regionId", "totalObjects", "vacantObjects", "vacantBuildings",
      "rentedObjects", "contractCount", "rentArea", "rentSum", "vacantArea", "takenAt"
    )
    SELECT ${day}::date,
           p."sourceId",
           p."regionId",
           COUNT(*)::int,
           COUNT(*) FILTER (WHERE ${VACANT})::int,
           -- landSplit sohalarida kartada AYNAN shu ustun ko'rsatiladi (yer emas, bino).
           COUNT(*) FILTER (WHERE ${VACANT} AND NOT p."isLand")::int,
           COUNT(*) FILTER (WHERE p."rentContractCount" > 0)::int,
           COALESCE(SUM(p."rentContractCount"), 0)::int,
           COALESCE(SUM(p."rentTotalArea"), 0),
           COALESCE(SUM(p."rentTotalSum"), 0),
           COALESCE(SUM(p."vacantArea"), 0),
           ${takenAt}::timestamp
    FROM "Property" p
    WHERE ${cond}
    GROUP BY p."sourceId", p."regionId"
    ON CONFLICT ("day", "sourceId", "regionId") DO UPDATE SET
      "totalObjects"    = EXCLUDED."totalObjects",
      "vacantObjects"   = EXCLUDED."vacantObjects",
      "vacantBuildings" = EXCLUDED."vacantBuildings",
      "rentedObjects"   = EXCLUDED."rentedObjects",
      "contractCount"   = EXCLUDED."contractCount",
      "rentArea"        = EXCLUDED."rentArea",
      "rentSum"         = EXCLUDED."rentSum",
      "vacantArea"      = EXCLUDED."vacantArea",
      "takenAt"         = EXCLUDED."takenAt"
  `);

  // ⚠️ Kun ichida qayta olinganda: obyektlari qolmagan (masalan hammasi balansdan
  // chiqarilgan) (manba, hudud) juftligi `SELECT` ga umuman tushmaydi, ya'ni
  // `ON CONFLICT` uni yangilamaydi va ertalabki qator eskirgan holicha qolardi.
  const removed = await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "DashboardSnapshot" WHERE "day" = ${day}::date AND "takenAt" <> ${takenAt}::timestamp
  `);

  return { day, rows, removed };
}

export interface KpiPoint {
  /** "YYYY-MM-DD" */
  day: string;
  total: number;
  vacant: number;
  /** Shundan binolar (`landSplit` sohalari uchun). */
  vacantBuildings: number;
  rentedObjects: number;
  contractCount: number;
  rentArea: number;
  rentSum: number;
  vacantArea: number;
}

/**
 * Doirani snapshot jadvaliga qo'llaydi.
 *
 * ⚠️ `sourceCond()` bu yerda ISHLATILMAYDI — u `Property` ustunlariga (`removedFromBalance`)
 * tayanadi, snapshotda esa o'sha cheklov YOZISH paytida allaqachon qo'llangan.
 * Qolgan ikki o'lchov (soha nomi va rol doirasi) esa aynan bir xil mantiqda birikadi.
 */
function snapshotCond(scope: StatsScope): Prisma.Sql {
  if (scope.sourceIds != null && scope.sourceIds.length === 0) return Prisma.sql`FALSE`;

  const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (scope.sourceName) {
    parts.push(
      Prisma.sql`s."sourceId" IN (SELECT id FROM "OrganizationSource" WHERE name = ${scope.sourceName})`,
    );
  }
  if (scope.sourceIds != null) {
    parts.push(Prisma.sql`s."sourceId" IN (${Prisma.join(scope.sourceIds)})`);
  }
  return parts.reduce((a, b) => Prisma.sql`${a} AND ${b}`);
}

async function computeKpiHistory(scope: StatsScope = {}): Promise<KpiPoint[]> {
  const cond = snapshotCond(scope);
  return prisma.$queryRaw<KpiPoint[]>(Prisma.sql`
    SELECT to_char(s."day", 'YYYY-MM-DD')            AS day,
           SUM(s."totalObjects")::int                AS total,
           SUM(s."vacantObjects")::int               AS vacant,
           SUM(s."vacantBuildings")::int             AS "vacantBuildings",
           SUM(s."rentedObjects")::int               AS "rentedObjects",
           SUM(s."contractCount")::int               AS "contractCount",
           COALESCE(SUM(s."rentArea"), 0)::float8    AS "rentArea",
           COALESCE(SUM(s."rentSum"), 0)::float8     AS "rentSum",
           COALESCE(SUM(s."vacantArea"), 0)::float8  AS "vacantArea"
    FROM "DashboardSnapshot" s
    WHERE s."day" >= (now() AT TIME ZONE 'Asia/Tashkent')::date - ${HISTORY_DAYS}::int
      AND ${cond}
    GROUP BY s."day"
    ORDER BY s."day"
  `);
}

// ⚠️ Doira argument sifatida uzatiladi — kesh kaliti rol doirasini ham qamraydi
// (aks holda cheklangan foydalanuvchiga begona natija qaytishi mumkin edi).
export const getKpiHistory = unstable_cache(computeKpiHistory, ["kpi-history-v1"], {
  tags: ["dashboard"],
  revalidate: 60,
});
