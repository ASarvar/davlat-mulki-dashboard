/**
 * Ijara imtiyozi (ПҚ-3782) uchun tashqi manbalar — Soliq va TIEK.
 *
 * Uchalasi ham kommunal API'lar bilan BIR XIL shlyuzda va bir xil Basic juftlikda,
 * lekin javob shakllari butunlay boshqacha va "xato" tushunchasi ham har xil:
 *
 *   comp_workers  -> { status, message, data: { workers, recordsTotal } }
 *                    ⚠️ `status: false` = BIZNES xatosi (HTTP baribir 200)
 *   yatt_workers  -> { success, totalRecords, data: [...] }
 *                    ⚠️ tadbirkor bo'yicha FILTRLAMAYDI — butun respublika keladi
 *   minzdrav_pas  -> { data, result_code, result_message, isSuccess }
 *                    ⚠️ `result_code: "1001"` = shaxs topilmadi (XATO EMAS)
 *
 * ⚠️ Bu yerdagi ASOSIY qoida: hech qanday uzilish "nol xodim" yoki "nogironligi yo'q"
 * degan FAKTGA aylanmaydi. Har bir funksiya xatoni natijadan AJRATIB qaytaradi —
 * bo'sh ro'yxat faqat manba muvaffaqiyatli javob berganda "haqiqiy nol" bo'ladi.
 */
import { env } from "@/lib/env";
import { httpJson } from "./http";

const basicAuth =
  env.IMTIYOZ_API_USER && env.IMTIYOZ_API_PASSWORD
    ? { user: env.IMTIYOZ_API_USER, password: env.IMTIYOZ_API_PASSWORD }
    : undefined;

export function imtiyozConfigured(): boolean {
  return Boolean(env.IMTIYOZ_COMP_WORKERS_URL && env.IMTIYOZ_YATT_WORKERS_URL && env.IMTIYOZ_TIEK_URL);
}

/** Xato TURI — natija matnini emas, shu maydonni tekshiring. */
export type SoliqErrorKind =
  | "transport" // ulanib bo'lmadi / timeout
  | "http" // 4xx / 5xx
  | "business" // status: false
  | "partial" // ro'yxat qisman yuklandi
  | "index_unavailable"; // YATT indeksi sinxronlanmagan

export interface SoliqError {
  kind: SoliqErrorKind;
  message: string;
}

// ───────────────────────── Soliq: comp_workers ─────────────────────────

export interface SoliqWorker {
  pinfl: string;
  position: string | null;
  rate: string | null;
}

interface CompWorkersResponse {
  status?: boolean;
  message?: string;
  data?: {
    workers?: { pinfl?: string | number; position?: string | null; rate?: string | number | null }[];
    recordsTotal?: number;
  };
}

type PageResult =
  | { ok: true; workers: SoliqWorker[]; recordsTotal: number }
  | { ok: false; kind: SoliqErrorKind; message: string };

/** Yuridik shaxs uchun bitta sahifa. Tarmoq/biznes xatosi shu yerda TURGA ajratiladi. */
async function fetchCompWorkersPage(
  tin: string,
  year: number,
  period: number,
  page: number,
  size: number,
): Promise<PageResult> {
  try {
    const res = await httpJson<CompWorkersResponse>({
      baseUrl: env.IMTIYOZ_COMP_WORKERS_URL!,
      query: { page, period, size, year, tin },
      basicAuth,
      // ⚠️ Retry YO'Q (asl ilovadagi kabi): xodimlar ro'yxati uzun bo'lsa qayta
      // urinishlar tekshiruvni daqiqalarga cho'zardi. Xato "aniqlanmadi"ga
      // aylanadi va operator o'zi qayta uradi.
      maxAttempts: 1,
      timeoutMs: 10_000,
    });

    // ⚠️ HTTP 200 bo'lsa ham `status: false` bo'lishi mumkin — biznes xatosi.
    if (res?.status === false) {
      return { ok: false, kind: "business", message: res.message || "Soliq API biznes-xatosi" };
    }

    const workers = (res?.data?.workers ?? []).map((w) => ({
      pinfl: String(w.pinfl ?? ""),
      position: w.position ? String(w.position) : null,
      rate: w.rate != null && w.rate !== "" ? String(w.rate) : null,
    }));
    return { ok: true, workers, recordsTotal: res?.data?.recordsTotal ?? 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, kind: /HTTP \d/.test(message) ? "http" : "transport", message };
  }
}

export interface WorkersResult {
  workers: SoliqWorker[];
  error: SoliqError | null;
}

/**
 * Yuridik shaxs (STIR) xodimlari — sahifalab yuklaydi.
 *
 * ⚠️ BO'SH RO'YXAT HECH QACHON XATO USTIDAN QAYTMAYDI: ro'yxatni olishning iloji
 * bo'lmasa `error` to'ldiriladi va natija "aniqlanmadi" bo'ladi. Yuklanmagan sahifa
 * = 30% hisobining MAXRAJI noto'g'ri — shuning uchun u ham `partial` xatosi.
 */
export async function fetchCompWorkers(tin: string, year: number, period: number): Promise<WorkersResult> {
  const size = 25;
  const first = await fetchCompWorkersPage(tin, year, period, 1, size);
  if (!first.ok) return { workers: [], error: { kind: first.kind, message: first.message } };

  // Soliq javob berdi va shartnoma yo'q — bu HAQIQIY nol.
  if (first.recordsTotal === 0) return { workers: [], error: null };

  const totalPages = Math.ceil(first.recordsTotal / size);
  const all = [...first.workers];
  const failedPages: number[] = [];

  if (totalPages > 1) {
    // Promise.all EMAS: 400 xodimli korxona uchun shlyuzga bir vaqtda 15 ta so'rov
    // yubormaymiz — u allaqachon ishonchsiz.
    const limit = createLimiter(5);
    const results = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) => i + 2).map((page) =>
        limit(async () => ({ page, res: await fetchCompWorkersPage(tin, year, period, page, size) })),
      ),
    );
    // Sahifa tartibini saqlaymiz — audit uchun barqaror tartib.
    results.sort((a, b) => a.page - b.page);
    for (const { page, res } of results) {
      if (res.ok) all.push(...res.workers);
      else failedPages.push(page);
    }
  }

  if (failedPages.length > 0) {
    return {
      workers: all,
      error: {
        kind: "partial",
        message:
          `Xodimlar ro'yxati to'liq yuklanmadi: ${totalPages} sahifadan ` +
          `${failedPages.length} tasi olinmadi (${failedPages.join(", ")}-sahifa)`,
      },
    };
  }

  return { workers: all, error: null };
}

// ───────────────────────── Soliq: yatt_workers ─────────────────────────

export interface YattContractRecord {
  entrepreneurPinfl: string;
  workerPinfl: string;
  endDate?: string | null;
  cancelContractDate?: string | null;
}

interface YattResponse {
  success?: boolean;
  totalRecords?: number;
  data?: YattContractRecord[];
}

/**
 * YATT shartnomalarining bitta sahifasi (indeks sinxronlash uchun, WORKER'da).
 *
 * ⚠️ Bu yerda `rateKey` BOR (comp_workers/TIEK'dan farqli): sinxronlash 150+ sahifani
 * ketma-ket so'raydi va boshqa sinxronizatsiyalar bilan bir vaqtda ishlaydi.
 * Katta OFFSET'li sahifalarda shlyuz vaqti-vaqti bilan 500 qaytaradi, shuning uchun
 * `http.ts` ning backoff'i ataylab yoqilgan.
 */
export async function fetchYattPage(page: number, size: number): Promise<YattResponse> {
  return httpJson<YattResponse>({
    baseUrl: env.IMTIYOZ_YATT_WORKERS_URL!,
    query: { page, size },
    basicAuth,
    rateKey: "IMTIYOZ_YATT",
    maxAttempts: 4,
    timeoutMs: 20_000,
  });
}

// ───────────────────────── TIEK: minzdrav_pas ─────────────────────────

/** TIEK yozuvidan TANLAB olingan maydonlar — butun blob saqlanmaydi. */
export interface TiekPerson {
  pinfl: string | null;
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
  birthOn: string | null;
  disabilityGroup: number | null;
  workDisabilityLevel: string | number | null;
  initialDisabilityTime: string | null;
  startOn: string | null;
  endOn: string | null;
  icd10Code: string | null;
}

interface TiekResponse {
  isSuccess?: boolean;
  result_code?: string;
  result_message?: string;
  data?: Record<string, unknown> | null;
}

export interface TiekResult {
  /** ⚠️ `null` = TIEK javob bermadi, holat NOMA'LUM ("nogironligi yo'q" EMAS). */
  isDisabled: boolean | null;
  /** TIEK bazasida bunday PINFL umuman yo'q (`result_code: "1001"`) — xato emas. */
  notFound: boolean;
  person: TiekPerson | null;
  error?: string;
}

/** TIEK bazasida shaxs topilmagani — bu xato emas, biznes javobi. */
const TIEK_NOT_FOUND_CODE = "1001";

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function projectPerson(data: Record<string, unknown> | null | undefined): TiekPerson | null {
  if (!data) return null;
  return {
    pinfl: str(data.pinfl),
    lastName: str(data.lastName),
    firstName: str(data.firstName),
    middleName: str(data.middleName),
    birthOn: str(data.birthOn),
    disabilityGroup: typeof data.disabilityGroup === "number" ? data.disabilityGroup : null,
    workDisabilityLevel: (data.workDisabilityLevel as string | number | null) ?? null,
    initialDisabilityTime: str(data.initialDisabilityTime),
    startOn: str(data.startOn),
    endOn: str(data.endOn),
    icd10Code: str(data.icd10Code),
  };
}

/**
 * Bitta PINFL bo'yicha nogironlik holati (keshsiz — jonli so'rov).
 *
 * ⚠️ Uch xil natijani ARALASHTIRMANG:
 *   isDisabled: true/false + notFound: false  -> aniq javob, keshlanadi
 *   isDisabled: false + notFound: true        -> reyestrda yo'q, keshlanadi
 *   isDisabled: null + error                  -> TIZIM XATOSI, KESHLANMAYDI
 * Uchinchisini "nogironligi yo'q" deb talqin qilish — asosiy xato sinfi.
 */
export async function fetchDisability(pinfl: string): Promise<TiekResult> {
  try {
    const body = await httpJson<TiekResponse>({
      baseUrl: env.IMTIYOZ_TIEK_URL!,
      query: { pinfl: String(pinfl) },
      basicAuth,
      // ⚠️ Retry YO'Q: 400 xodimda har biriga 5 urinish tekshiruvni yiqitadi.
      // Xato -> INCONCLUSIVE_TIEK -> operator "Qayta tekshirish" bosadi va
      // so'rov FAQAT muvaffaqiyatsiz PINFL'lar uchun ketadi (qolganlari keshda).
      maxAttempts: 1,
      timeoutMs: 10_000,
    });

    if (body?.isSuccess === true) {
      const group = typeof body.data?.disabilityGroup === "number" ? body.data.disabilityGroup : 0;
      return { isDisabled: group > 0, notFound: false, person: projectPerson(body.data) };
    }

    if (body?.result_code === TIEK_NOT_FOUND_CODE) {
      return { isDisabled: false, notFound: true, person: null };
    }

    return {
      isDisabled: null,
      notFound: false,
      person: null,
      error: body?.result_message || `TIEK noma'lum xato (result_code: ${body?.result_code})`,
    };
  } catch (err) {
    return {
      isDisabled: null,
      notFound: false,
      person: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ───────────────────────── Yordamchi ─────────────────────────

/**
 * Oddiy concurrency-limiter (tashqi kutubxonasiz): bir vaqtda ko'pi bilan
 * `concurrency` ta vazifa ishlaydi, qolganlari navbatda kutadi.
 *
 * ⚠️ `rateGuard` O'RNIGA emas, undan boshqa maqsad uchun: rate-limit "sekundiga
 * nechta", bu esa "bir vaqtda nechta". TIEK uchun aynan shu yagona throttle.
 */
export function createLimiter(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];

  const next = () => {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    queue.shift()!();
  };

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
  };
}
