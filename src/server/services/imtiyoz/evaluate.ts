/**
 * Ijara imtiyozi (ПҚ-3782) — asosiy mantiq.
 *
 * Qoida: mehnat shartnomasi asosida ishlayotgan xodimlarning kamida 30% ini
 * nogironligi bo'lgan shaxslar tashkil etsa, ijara to'lovi auksion natijasi bo'yicha
 * belgilangan summaning 50% i miqdorida belgilanadi.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ISHONCH INVARIANTI                                                      ║
 * ║  Hech qanday tashqi tizim uzilishi ANIQ RAD JAVOBIGA aylanmaydi.         ║
 * ║  Noto'g'ri rad javobi berilgandan ko'ra xato tashlagan afzal — u logda    ║
 * ║  darhol ko'rinadi va e'tibordan chetda qolmaydi.                         ║
 * ║  Buni `assertNoFalseNegative()` MAJBURLAYDI. Yagona istisno — NO_WORKERS. ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * HAR DOIM bitta shakldagi obyekt qaytadi (`ImtiyozResult`) — UI faqat `resultCode`
 * bo'yicha ish ko'radi, hech qachon xabar matnini solishtirmaydi.
 */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  classifySubject,
  defaultPeriod,
  type ImtiyozResult,
  type ImtiyozWorkerRow,
  type ImtiyozWorkerStatus,
} from "@/lib/imtiyoz";
import {
  createLimiter,
  fetchCompWorkers,
  fetchDisability,
  imtiyozConfigured,
  type SoliqError,
  type SoliqWorker,
  type TiekPerson,
} from "@/server/integrations/imtiyoz";
import { lookupYattWorkers } from "./yattIndex";
import { recordServiceResult } from "./health";
import packageJson from "../../../../package.json";

export const IMTIYOZ_APP_VERSION: string = packageJson.version;

// ───────────────────────── Xodimlar ro'yxati ─────────────────────────

interface FetchedWorkers {
  workers: SoliqWorker[];
  error: SoliqError | null;
  yattIndexIncomplete: boolean;
  yattIndexReady: boolean;
}

/**
 * 9 xonali => Soliq `comp_workers` ga jonli so'rov.
 * 14 xonali => oldindan tayyorlangan YATT indeksidan o'qish.
 *
 * ⚠️ STIR yo'lida `yattIndex*` maydonlari HAR DOIM "hammasi joyida" bo'ladi — YATT
 * indeksining holati yuridik shaxs natijasiga hech qanday aloqasi yo'q.
 */
async function fetchAllWorkers(tin: string, year: number, period: number): Promise<FetchedWorkers> {
  if (tin.length === 14) {
    const res = await lookupYattWorkers(tin);
    return {
      workers: res.workers,
      error: res.error,
      yattIndexIncomplete: res.indexIncomplete,
      yattIndexReady: res.indexReady,
    };
  }

  const res = await fetchCompWorkers(tin, year, period);
  recordServiceResult("soliq", res.error === null, res.error?.message);
  return { workers: res.workers, error: res.error, yattIndexIncomplete: false, yattIndexReady: true };
}

// ───────────────────────── TIEK + kesh ─────────────────────────

interface DisabilityAnswer {
  isDisabled: boolean | null;
  notFound: boolean;
  person: TiekPerson | null;
  error?: string;
  fromCache: boolean;
}

/**
 * PINFL -> nogironlik holati, keshni HISOBGA OLGAN holda.
 *
 * Kesh bitta so'rov bilan oldindan o'qiladi (PINFL boshiga alohida so'rov EMAS):
 * 400 xodimli korxonada bu 400 ta so'rovni 1 taga tushiradi.
 *
 * ⚠️ FAQAT aniq javob keshlanadi. Tizim xatosi keshlanmasa, "Qayta tekshirish"
 * so'rovi FAQAT muvaffaqiyatsiz PINFL'lar uchun ketadi — qolganlari keshdan keladi.
 */
async function resolveDisabilities(
  pinfls: string[],
  opts: { skipCache?: boolean },
): Promise<Map<string, DisabilityAnswer>> {
  const out = new Map<string, DisabilityAnswer>();
  const unique = [...new Set(pinfls.filter(Boolean))];
  if (unique.length === 0) return out;

  if (!opts.skipCache) {
    const cutoff = new Date(Date.now() - env.IMTIYOZ_TIEK_CACHE_HOURS * 60 * 60 * 1000);
    const cached = await prisma.imtiyozTiekCache.findMany({
      where: { pinfl: { in: unique }, checkedAt: { gte: cutoff } },
    });
    for (const c of cached) {
      out.set(c.pinfl, {
        isDisabled: c.isDisabled,
        notFound: c.notFound,
        person: (c.person as TiekPerson | null) ?? null,
        fromCache: true,
      });
    }
  }

  const missing = unique.filter((p) => !out.has(p));
  if (missing.length === 0) return out;

  // ⚠️ Bu YAGONA throttle — TIEK uchun rate-limit qo'yilmagan (izoh `env.ts` da).
  const limit = createLimiter(env.IMTIYOZ_TIEK_CONCURRENCY);
  const fresh: { pinfl: string; answer: DisabilityAnswer }[] = [];

  await Promise.all(
    missing.map((pinfl) =>
      limit(async () => {
        const res = await fetchDisability(pinfl);
        recordServiceResult("tiek", res.error === undefined, res.error);
        const answer: DisabilityAnswer = { ...res, fromCache: false };
        out.set(pinfl, answer);
        // Tizim xatosi KESHLANMAYDI — vaqtinchalik uzilish 24 soatga
        // "nogironligi yo'q" bo'lib muzlab qolmasin.
        if (res.error === undefined) fresh.push({ pinfl, answer });
      }),
    ),
  );

  if (fresh.length > 0) {
    // deleteMany + createMany: PINFL boshiga upsert emas, ikkita so'rov.
    await prisma
      .$transaction([
        prisma.imtiyozTiekCache.deleteMany({ where: { pinfl: { in: fresh.map((f) => f.pinfl) } } }),
        prisma.imtiyozTiekCache.createMany({
          data: fresh.map(({ pinfl, answer }) => ({
            pinfl,
            isDisabled: answer.isDisabled === true,
            notFound: answer.notFound,
            person: (answer.person ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
          })),
        }),
      ])
      .catch((err) => {
        // Kesh yozilmasligi natijani TO'SMAYDI — keyingi safar qayta so'raladi.
        console.error("[imtiyoz] TIEK keshi yozilmadi:", err instanceof Error ? err.message : err);
      });
  }

  return out;
}

// ───────────────────────── Invariant ─────────────────────────

/**
 * ⚠️ Butun loyihaning maqsadi bitta bajariladigan qatorda: to'liq bo'lmagan
 * ma'lumot ustidan `isEligible: false` chiqmasin.
 */
function assertNoFalseNegative(r: ImtiyozResult): void {
  if (r.isEligible !== false) return;
  // Yagona asosli "false": Soliq javob berdi va shartnoma yo'qligini TASDIQLADI.
  if (r.resultCode === "NO_WORKERS") return;

  const problems: string[] = [];
  if (r.soliqError) problems.push(`soliqError=${r.soliqError.kind}`);
  if (r.failedChecks.length > 0) problems.push(`failedChecks=${r.failedChecks.length}`);
  if (r.yattIndexIncomplete) problems.push("yattIndexIncomplete");
  if (!r.yattIndexReady) problems.push("!yattIndexReady");

  if (problems.length > 0) {
    throw new Error(
      `INVARIANT BUZILDI: to'liq bo'lmagan ma'lumot bilan rad javobi berilmoqda ` +
        `(${r.subjectId}): ${problems.join(", ")}`,
    );
  }
}

// ───────────────────────── Natija keshi ─────────────────────────

const cacheKeyOf = (tin: string, year: number, period: number) => `${tin}_${year}_${period}`;

async function readResultCache(key: string): Promise<{ result: ImtiyozResult; requestId: string } | null> {
  const row = await prisma.imtiyozResultCache.findUnique({ where: { key } });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.imtiyozResultCache.delete({ where: { key } }).catch(() => {});
    return null;
  }
  return { result: row.result as unknown as ImtiyozResult, requestId: row.requestId };
}

// ───────────────────────── Asosiy funksiya ─────────────────────────

export interface EvaluateOptions {
  year?: number | string | null;
  period?: number | string | null;
  /** Keshni chetlab o'tish ("Qayta tekshirish"). */
  refresh?: boolean;
}

export async function evaluateEligibility(
  subjectIdRaw: string,
  options: EvaluateOptions = {},
): Promise<ImtiyozResult> {
  if (!imtiyozConfigured()) {
    throw new Error(
      "Imtiyoz API'lari sozlanmagan: IMTIYOZ_COMP_WORKERS_URL / IMTIYOZ_YATT_WORKERS_URL / IMTIYOZ_TIEK_URL",
    );
  }

  const startedAt = Date.now();
  const subject = classifySubject(subjectIdRaw);
  const tin = subject.normalized;
  // ⚠️ Standart davr `defaultPeriod()` dan — ilgari bu yerda qattiq `period = 1`
  // (yanvar) turardi va ochiq endpoint (shartnoma formasi) 8 oylik eskirgan
  // ma'lumot bo'yicha javob berardi. Sahifadagi forma esa o'tgan oyni o'zi
  // hisoblardi, ya'ni ikkalasi bir kunda qarama-qarshi xulosa chiqarardi.
  const fallback = defaultPeriod();
  const year = Number(options.year) || fallback.year;
  const period = Number(options.period) || fallback.period;
  const refresh = !!options.refresh;
  const key = cacheKeyOf(tin, year, period);

  if (refresh) await prisma.imtiyozResultCache.deleteMany({ where: { key } });

  const cached = refresh ? null : await readResultCache(key);
  if (cached) {
    // ⚠️ Har bir BERISH audit jurnalida ALOHIDA qator bo'ladi — "kimga qachon nima
    // aytilgan" savoliga javob shu. Shuning uchun keshdan berilganda ham YANGI
    // requestId beriladi, asl hisoblash esa sourceRequestId orqali kuzatiladi.
    return {
      ...cached.result,
      requestId: randomUUID(),
      sourceRequestId: cached.result.sourceRequestId || cached.requestId,
      fromCache: true,
      servedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    };
  }

  const fetched = await fetchAllWorkers(tin, year, period);
  const workers = fetched.workers;
  const totalWorkers = workers.length;
  const soliqError = fetched.error;
  const yattIndexIncomplete = fetched.yattIndexIncomplete;
  const yattIndexReady = fetched.yattIndexReady;

  const requiredCount = Math.ceil(totalWorkers * env.IMTIYOZ_REQUIRED_RATIO);

  // Xodimlar ro'yxati qisman bo'lsa ham tekshiramiz: natija baribir "aniqlanmadi"
  // bo'ladi, lekin operator qaysi xodim tekshirilgan-tekshirilmaganini ko'radi.
  const answers = await resolveDisabilities(
    workers.map((w) => w.pinfl),
    { skipCache: false },
  );

  const disabledChecks: string[] = [];
  const notDisabledChecks: string[] = [];
  const notFoundChecks: string[] = [];
  const failedChecks: string[] = [];
  let checkedCount = 0;

  const workerRows: ImtiyozWorkerRow[] = workers.map((w) => {
    const a = answers.get(w.pinfl) ?? {
      isDisabled: null,
      notFound: false,
      person: null,
      error: "Javob olinmadi",
      fromCache: false,
    };
    checkedCount++;

    let status: ImtiyozWorkerStatus;
    if (a.error) {
      status = "failed";
      failedChecks.push(w.pinfl);
    } else if (a.notFound) {
      status = "not_found";
      notFoundChecks.push(w.pinfl);
    } else if (a.isDisabled) {
      status = "disabled";
      disabledChecks.push(w.pinfl);
    } else {
      status = "not_disabled";
      notDisabledChecks.push(w.pinfl);
    }

    const p = a.person;
    const fullName = p ? [p.lastName, p.firstName, p.middleName].filter(Boolean).join(" ") || null : null;

    return {
      pinfl: w.pinfl,
      position: w.position,
      rate: w.rate,
      status,
      fullName,
      birthOn: p?.birthOn ?? null,
      disabilityGroup: p?.disabilityGroup ?? null,
      disabilityStartOn: p?.startOn ?? null,
      disabilityEndOn: p?.endOn ?? null,
      icd10Code: p?.icd10Code ?? null,
      fromCache: a.fromCache,
      error: a.error ?? null,
    };
  });

  const disabledCount = disabledChecks.length;
  const pct = totalWorkers > 0 ? Number(((disabledCount / totalWorkers) * 100).toFixed(1)) : 0;
  const now = new Date().toISOString();

  // Har bir yo'l uchun BIR XIL asos — shakl nomuvofiqligi bo'lmasin.
  const base = {
    requestId: randomUUID(),
    sourceRequestId: null,
    subjectId: tin,
    subjectType: (subject.type ?? "STIR") as ImtiyozResult["subjectType"],
    tin,
    year,
    period,
    totalWorkers,
    checkedCount,
    disabledCount,
    requiredCount,
    disabledPercentage: `${pct.toFixed(1)}%`,
    disabledPercentageValue: pct,
    counts: {
      disabled: disabledChecks.length,
      notDisabled: notDisabledChecks.length,
      notFound: notFoundChecks.length,
      failed: failedChecks.length,
    },
    workers: workerRows,
    disabledChecks,
    notDisabledChecks,
    notFoundChecks,
    failedChecks,
    soliqError,
    yattIndexIncomplete,
    yattIndexReady,
    fromCache: false,
    computedAt: now,
    servedAt: now,
    durationMs: 0,
  };

  const finish = (partial: Omit<ImtiyozResult, "reason" | "durationMs">): ImtiyozResult => {
    const result: ImtiyozResult = {
      ...partial,
      // `reason` — eski shartnoma formasi AYNAN shu maydonni o'qiydi (deploy qilingan
      // kod buzilmasin). Yangi mijozlar `message` dan foydalanadi.
      reason: partial.message,
      durationMs: Date.now() - startedAt,
    };
    assertNoFalseNegative(result);
    return result;
  };

  // ── 1) Xodimlar ro'yxatining O'ZI ishonchsiz ──
  // `index_unavailable` alohida ajratiladi: u YATT indeksiga tegishli, Soliqqa emas.
  if (soliqError && soliqError.kind !== "index_unavailable") {
    return finish({
      ...base,
      resultCode: "INCONCLUSIVE_SOLIQ",
      isEligible: null,
      inconclusive: true,
      message: `Natijani hozircha aniqlab bo'lmaydi: ${soliqError.message}. Birozdan so'ng qayta urinib ko'ring.`,
    });
  }

  // ── 2) YATT indeksi to'liq emas yoki umuman yo'q — "xodim yo'q" xulosasi asossiz ──
  if (yattIndexIncomplete || !yattIndexReady || soliqError) {
    return finish({
      ...base,
      resultCode: "INCONCLUSIVE_YATT_INDEX",
      isEligible: null,
      inconclusive: true,
      message: soliqError
        ? `Natijani hozircha aniqlab bo'lmaydi: ${soliqError.message}. Birozdan so'ng qayta urinib ko'ring.`
        : "Natijani hozircha aniqlab bo'lmaydi: YATT indeksi to'liq sinxronlanmagan. " +
          "Birozdan so'ng qayta urinib ko'ring.",
    });
  }

  // ── 3) Baza javob berdi, shartnoma yo'q — HAQIQIY fakt ──
  if (totalWorkers === 0) {
    // ⚠️ KESHLANMAYDI: xodim qo'shilishi mumkin, keyingi so'rov yangi javob olsin.
    return finish({
      ...base,
      resultCode: "NO_WORKERS",
      isEligible: false,
      inconclusive: false,
      message:
        "Bu STIR/JSHSHIR bo'yicha faol mehnat shartnomasi topilmadi. " +
        "Bazaga muvaffaqiyatli murojaat qilindi — bu ulanish xatosi emas.",
    });
  }

  // ── 4) TIEK ba'zi xodimlar uchun javob bermadi ──
  if (failedChecks.length > 0) {
    return finish({
      ...base,
      resultCode: "INCONCLUSIVE_TIEK",
      isEligible: null,
      inconclusive: true,
      message:
        `Natijani hozircha aniqlab bo'lmaydi: ${failedChecks.length} ta xodim nogironlik ` +
        `reyestri orqali tekshirilmadi (TIEK javob bermadi). Birozdan so'ng qayta urinib ko'ring.`,
    });
  }

  // ── 5) Ma'lumot to'liq — ANIQ xulosa ──
  const isEligible = disabledCount >= requiredCount;
  const result = finish({
    ...base,
    resultCode: isEligible ? "ELIGIBLE" : "NOT_ELIGIBLE",
    isEligible,
    inconclusive: false,
    message: isEligible
      ? "Nogironligi bo'lgan xodimlar ulushi kamida 30% ni tashkil etadi. 50% lik ijara imtiyozi qo'llaniladi."
      : "Nogironligi bo'lgan xodimlar ulushi 30% ga yetmadi. Imtiyoz berilmaydi.",
  });

  const expiresAt = new Date(Date.now() + env.IMTIYOZ_RESULT_CACHE_MINUTES * 60 * 1000);
  await prisma.imtiyozResultCache
    .upsert({
      where: { key },
      create: {
        key,
        requestId: result.requestId,
        result: result as unknown as Prisma.InputJsonValue,
        computedAt: new Date(result.computedAt),
        expiresAt,
      },
      update: {
        requestId: result.requestId,
        result: result as unknown as Prisma.InputJsonValue,
        computedAt: new Date(result.computedAt),
        expiresAt,
      },
    })
    .catch((err) => {
      // Kesh yozilmasligi natijani TO'SMAYDI.
      console.error("[imtiyoz] natija keshi yozilmadi:", err instanceof Error ? err.message : err);
    });

  return result;
}
