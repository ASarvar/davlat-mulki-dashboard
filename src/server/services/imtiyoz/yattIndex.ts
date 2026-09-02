/**
 * YATT ishchilar indeksi.
 *
 * ⚠️ NIMA UCHUN INDEKS KERAK: `yatt_workers` endpoint `entrepreneurPinfl` bo'yicha
 * FILTRLAMAYDI — har bir so'rov BUTUN respublika bo'yicha shartnoma yozuvlarini
 * qaytaradi (~76 000+), va bitta ishchi har bir shartnoma uchun alohida qator bo'lib
 * takrorlanadi. Ya'ni "Tekshirish" bosilganda jonli filtrlash imkonsiz.
 *
 * ⚠️ NIMA UCHUN POSTGRES, XOTIRA EMAS (asl ilovadan farq): bu yerda web va worker —
 * ikki ALOHIDA process. Xotiradagi Map faqat o'zi qurgan processda ko'rinardi, ya'ni
 * indeksni worker'da sinxronlab, web'da o'qib bo'lmasdi. Jadval sifatida saqlash
 * qayta ishga tushirishdan ham omon qoladi (asl ilovada har restart = 76k yozuvni
 * qaytadan yuklash).
 */
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { createLimiter, fetchYattPage, type YattContractRecord } from "@/server/integrations/imtiyoz";
import type { SoliqError, SoliqWorker } from "@/server/integrations/imtiyoz";
import { enqueueYattIndexSync } from "@/server/queue/dispatch";

const SYNC_ID = "singleton";

export interface YattState {
  ready: boolean;
  syncing: boolean;
  failedPages: number;
  totalPages: number;
  lastSyncedAt: Date | null;
  entrepreneurCount: number;
  recordCount: number;
  lastError: string | null;
}

const EMPTY_STATE: YattState = {
  ready: false,
  syncing: false,
  failedPages: 0,
  totalPages: 0,
  lastSyncedAt: null,
  entrepreneurCount: 0,
  recordCount: 0,
  lastError: null,
};

export async function getYattState(): Promise<YattState> {
  const row = await prisma.imtiyozYattSync.findUnique({ where: { id: SYNC_ID } });
  if (!row) return EMPTY_STATE;
  return {
    ready: row.ready,
    syncing: row.syncing,
    failedPages: row.failedPages,
    totalPages: row.totalPages,
    lastSyncedAt: row.finishedAt,
    entrepreneurCount: row.entrepreneurCount,
    recordCount: row.recordCount,
    lastError: row.lastError,
  };
}

export interface YattLookup {
  workers: SoliqWorker[];
  error: SoliqError | null;
  indexIncomplete: boolean;
  indexReady: boolean;
}

/**
 * JSHSHIR bo'yicha faol xodimlar.
 *
 * ⚠️ BO'SH NATIJA "NOL XODIM" DEGANI EMAS. Faqat TO'LIQ sinxronlangan indeksda
 * (ready && failedPages === 0) topilmaslik haqiqiy nol hisoblanadi; qolgan hamma
 * holatda chaqiruvchi buni `INCONCLUSIVE_YATT_INDEX` ga aylantiradi.
 */
export async function lookupYattWorkers(pinfl: string): Promise<YattLookup> {
  const state = await getYattState();

  if (!state.ready) {
    // ⚠️ Asl ilovada bu yerda indeks qurilishini KUTIB turilardi (`await ensureYattIndex()`).
    // Bu yerda kutib bo'lmaydi — sinxronlash boshqa processda (worker). Shuning uchun
    // qurishni so'raymiz va foydalanuvchiga rost javob beramiz: "hozircha aniqlanmadi".
    // Yolg'on "xodim yo'q" javobini berishdan ko'ra kutishni so'ragan afzal.
    if (!state.syncing) {
      await enqueueYattIndexSync().catch((err) =>
        console.error("[imtiyoz-yatt] sinxronlashni navbatga qo'yib bo'lmadi:", err instanceof Error ? err.message : err),
      );
    }
    return {
      workers: [],
      error: {
        kind: "index_unavailable",
        message: state.syncing
          ? "YATT indeksi hozir sinxronlanmoqda — birozdan so'ng qayta urinib ko'ring"
          : "YATT indeksi sinxronlanmagan (sinxronlash boshlandi, birozdan so'ng qayta urinib ko'ring)",
      },
      indexIncomplete: true,
      indexReady: false,
    };
  }

  const rows = await prisma.imtiyozYattWorker.findMany({
    where: { entrepreneurPinfl: String(pinfl) },
    select: { workerPinfl: true },
  });

  return {
    // YATT bo'limida lavozim/stavka maydonlari umuman yo'q — faqat PINFL.
    workers: rows.map((r) => ({ pinfl: r.workerPinfl, position: null, rate: null })),
    error: null,
    indexIncomplete: state.failedPages > 0,
    indexReady: true,
  };
}

// ───────────────────────── Sinxronlash (WORKER) ─────────────────────────

/** "DD.MM.YYYY" yoki "DD.MM.YYYY HH:mm:ss" -> Date. */
function parseUzDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [d, m, y] = String(s).split(" ")[0].split(".").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

/** Bekor qilinmagan va (tugash sanasi bo'lsa) muddati o'tmagan shartnoma. */
function isActiveContract(rec: YattContractRecord): boolean {
  if (rec.cancelContractDate) return false;
  const end = parseUzDate(rec.endDate);
  if (!end) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end.getTime() >= today.getTime();
}

/** Indeks yangimi — cron ishga tushganda takroriy to'liq yuklashning oldini oladi. */
export async function isYattIndexFresh(): Promise<boolean> {
  const state = await getYattState();
  if (!state.ready || !state.lastSyncedAt) return false;
  // ⚠️ To'liqsiz sinxronlashdan keyin HAR SAFAR qayta uriniladi — yetishmayotgan
  // sahifalar tufayli tadbirkorlar noto'g'ri "xodimsiz" ko'rinib turmasin.
  if (state.failedPages > 0) return false;
  const ageMs = Date.now() - state.lastSyncedAt.getTime();
  return ageMs < env.IMTIYOZ_YATT_FRESH_HOURS * 60 * 60 * 1000;
}

/**
 * Butun YATT ro'yxatini yuklab, indeksni QAYTA QURADI.
 *
 * ⚠️ Indeks BUTUNLAY almashtiriladi (asl ilovadagi `yattIndex = newIndex` kabi), shuning
 * uchun to'liqsiz yuklash oldingi to'liq indeksni ham yo'qotadi — lekin `failedPages > 0`
 * yozib qo'yiladi va o'sha paytdan boshlab JSHSHIR natijalari "aniqlanmadi" bo'ladi.
 * Bu ataylab: eskirgan, lekin to'liq ko'rinadigan indeks yolg'on "xodim yo'q" javobini
 * berardi.
 */
export async function syncYattIndex(): Promise<YattState> {
  const startedAt = new Date();
  await prisma.imtiyozYattSync.upsert({
    where: { id: SYNC_ID },
    create: { id: SYNC_ID, syncing: true, startedAt },
    update: { syncing: true, startedAt, lastError: null },
  });

  try {
    const first = await fetchYattPage(1, env.IMTIYOZ_YATT_PAGE_SIZE);
    if (!Array.isArray(first?.data)) {
      throw new Error("1-sahifa noto'g'ri javob qaytardi");
    }

    const totalRecords = first.totalRecords ?? 0;
    // Server so'ralgandan kichikroq sahifa bersa — sahifalar sonini SHUNGA qarab
    // hisoblaymiz, aks holda oxirgi sahifalar umuman so'ralmay qolardi.
    const actualSize = first.data.length || env.IMTIYOZ_YATT_PAGE_SIZE;
    const totalPages = Math.max(1, Math.ceil(totalRecords / actualSize));

    const index = new Map<string, Set<string>>();
    const add = (records: YattContractRecord[]) => {
      for (const rec of records) {
        if (!isActiveContract(rec)) continue;
        const emp = String(rec.entrepreneurPinfl);
        const worker = String(rec.workerPinfl);
        if (!emp || !worker) continue;
        let set = index.get(emp);
        if (!set) index.set(emp, (set = new Set()));
        set.add(worker);
      }
    };
    add(first.data);

    const failedPages: number[] = [];
    const limit = createLimiter(env.IMTIYOZ_YATT_CONCURRENCY);
    await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) => i + 2).map((page) =>
        limit(async () => {
          try {
            const res = await fetchYattPage(page, actualSize);
            if (res?.data) add(res.data);
          } catch (err) {
            console.error(`[imtiyoz-yatt] ${page}-sahifa xatosi:`, err instanceof Error ? err.message : err);
            failedPages.push(page);
          }
        }),
      ),
    );

    const rows: { entrepreneurPinfl: string; workerPinfl: string }[] = [];
    for (const [emp, set] of index) {
      for (const worker of set) rows.push({ entrepreneurPinfl: emp, workerPinfl: worker });
    }

    // ⚠️ deleteMany + createMany BITTA tranzaksiyada: aks holda almashtirish oralig'ida
    // kelgan tekshiruv bo'sh jadvalni ko'rib, "xodim yo'q" degan yolg'on javob berardi.
    // Chunk hajmi — bitta INSERT'dagi parametrlar chegarasi (65535) uchun.
    //
    // ⚠️ Interaktiv tranzaksiya (massiv shakli EMAS): faqat shu shakl `timeout` qabul
    // qiladi, standart 5 soniya esa 76 000 yozuvni yozishga yetmaydi.
    const CHUNK = 5_000;
    await prisma.$transaction(
      async (tx) => {
        await tx.imtiyozYattWorker.deleteMany({});
        for (let i = 0; i < rows.length; i += CHUNK) {
          await tx.imtiyozYattWorker.createMany({
            data: rows.slice(i, i + CHUNK),
            skipDuplicates: true,
          });
        }
      },
      { timeout: 300_000, maxWait: 30_000 },
    );

    const finishedAt = new Date();
    const state = await prisma.imtiyozYattSync.update({
      where: { id: SYNC_ID },
      data: {
        ready: true,
        syncing: false,
        finishedAt,
        totalPages,
        failedPages: failedPages.length,
        entrepreneurCount: index.size,
        recordCount: rows.length,
        lastError: null,
      },
    });

    const secs = ((finishedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1);
    if (failedPages.length > 0) {
      console.warn(
        `⚠️  [imtiyoz-yatt] indeks TO'LIQ EMAS: ${totalPages} sahifadan ${failedPages.length} tasi yuklanmadi ` +
          `(~${failedPages.length * actualSize} yozuv yetishmaydi). Bu tadbirkorlar uchun natija "aniqlanmadi" bo'ladi.`,
      );
    }
    console.log(
      `✅ [imtiyoz-yatt] indeks tayyor: ${index.size} tadbirkor, ${rows.length} bog'lanish, ` +
        `${totalPages - failedPages.length}/${totalPages} sahifa, ${secs}s`,
    );

    return {
      ready: state.ready,
      syncing: false,
      failedPages: state.failedPages,
      totalPages: state.totalPages,
      lastSyncedAt: state.finishedAt,
      entrepreneurCount: state.entrepreneurCount,
      recordCount: state.recordCount,
      lastError: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[imtiyoz-yatt] sinxronlash muvaffaqiyatsiz:", message);
    // ⚠️ `ready` TEGILMAYDI: oldingi muvaffaqiyatli indeks saqlanib qoladi. 1-sahifa
    // olinmagani indeksni yaroqsiz qilmaydi — u shunchaki eskiradi.
    await prisma.imtiyozYattSync.update({
      where: { id: SYNC_ID },
      data: { syncing: false, lastError: message },
    });
    throw err;
  }
}
