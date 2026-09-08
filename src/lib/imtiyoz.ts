/**
 * Ijara imtiyozi (ПҚ-3782) — client va server UCHALA joyda ishlatiladigan tiplar,
 * yorliqlar va sof funksiyalar.
 *
 * ⚠️ Bu fayl `@/lib/env` ni import QILMAYDI — u client bundle'ga kirmaydi
 * (`integrations/utilities.ts` bilan bir xil sabab).
 *
 * ⚠️ ASOSIY QOIDA: butun UI mantiqi FAQAT `resultCode` ga tayanadi. Xabar matni
 * hech qachon solishtirilmaydi — u foydalanuvchi uchun, kod uchun emas.
 */

export type ImtiyozResultCode =
  | "ELIGIBLE"
  | "NOT_ELIGIBLE"
  | "NO_WORKERS"
  | "INCONCLUSIVE_SOLIQ"
  | "INCONCLUSIVE_TIEK"
  | "INCONCLUSIVE_YATT_INDEX";

export type ImtiyozSubjectType = "STIR" | "JSHSHIR";

export type ImtiyozWorkerStatus = "disabled" | "not_disabled" | "not_found" | "failed";

export interface ImtiyozWorkerRow {
  pinfl: string;
  position: string | null;
  rate: string | null;
  status: ImtiyozWorkerStatus;
  fullName: string | null;
  birthOn: string | null;
  disabilityGroup: number | null;
  disabilityStartOn: string | null;
  disabilityEndOn: string | null;
  icd10Code: string | null;
  fromCache: boolean;
  error: string | null;
}

/** Tekshiruv natijasi — jonli hisoblash ham, arxivdan tiklangan nusxa ham SHU shaklda. */
export interface ImtiyozResult {
  requestId: string;
  sourceRequestId: string | null;
  subjectId: string;
  subjectType: ImtiyozSubjectType;
  /** Eski shartnoma formasi shu maydonni o'qiydi — OLIB TASHLAMANG. */
  tin: string;
  year: number;
  period: number;

  resultCode: ImtiyozResultCode;
  /** `null` = aniqlab bo'lmadi. */
  isEligible: boolean | null;
  inconclusive: boolean;
  message: string;
  /** Eski shartnoma formasi `message` emas, SHU nomni o'qiydi — OLIB TASHLAMANG. */
  reason: string;

  totalWorkers: number;
  checkedCount: number;
  disabledCount: number;
  requiredCount: number;
  disabledPercentage: string;
  disabledPercentageValue: number;
  counts: { disabled: number; notDisabled: number; notFound: number; failed: number };

  workers: ImtiyozWorkerRow[];
  disabledChecks: string[];
  notDisabledChecks: string[];
  notFoundChecks: string[];
  failedChecks: string[];

  soliqError: { kind: string; message: string } | null;
  yattIndexIncomplete: boolean;
  yattIndexReady: boolean;

  fromCache: boolean;
  computedAt: string;
  servedAt: string;
  durationMs: number;

  /** Arxivdan tiklanganda to'ldiriladi. */
  auditUsername?: string;
  auditIsRetry?: boolean;
  auditAppVersion?: string | null;
}

/** Xulosa kartochkasining ko'rinishi. */
export const VERDICT: Record<ImtiyozResultCode, { tone: "ok" | "no" | "info" | "wait"; mark: string; title: string }> =
  {
    ELIGIBLE: { tone: "ok", mark: "✓", title: "Imtiyoz qo'llaniladi" },
    NOT_ELIGIBLE: { tone: "no", mark: "✕", title: "Imtiyoz qo'llanilmaydi" },
    NO_WORKERS: { tone: "info", mark: "i", title: "Xodim topilmadi" },
    INCONCLUSIVE_SOLIQ: { tone: "wait", mark: "?", title: "Hozircha aniqlanmadi" },
    INCONCLUSIVE_TIEK: { tone: "wait", mark: "?", title: "Hozircha aniqlanmadi" },
    INCONCLUSIVE_YATT_INDEX: { tone: "wait", mark: "?", title: "Hozircha aniqlanmadi" },
  };

/** Tarix jadvalidagi qisqa yorliq. */
export const RESULT_SHORT: Record<ImtiyozResultCode, string> = {
  ELIGIBLE: "Qo'llaniladi",
  NOT_ELIGIBLE: "Qo'llanilmaydi",
  NO_WORKERS: "Xodim topilmadi",
  INCONCLUSIVE_SOLIQ: "Aniqlanmadi",
  INCONCLUSIVE_TIEK: "Aniqlanmadi",
  INCONCLUSIVE_YATT_INDEX: "Aniqlanmadi",
};

export const WORKER_STATUS_LABEL: Record<ImtiyozWorkerStatus, string> = {
  disabled: "Nogironligi bor",
  not_disabled: "Nogironligi yo'q",
  not_found: "Reyestrda topilmadi",
  failed: "Tekshirilmadi",
};

/**
 * Standart hisobot davri — **O'TGAN oy**.
 *
 * ⚠️ Nima uchun joriy oy EMAS: Soliq bazasi joriy oyni hali to'ldirmagan bo'ladi.
 * Jonli o'lchov (STIR 310853491, 2026-09-08): oy 6/7/8 → 5 xodim, oy 9 → **0 xodim**
 * (`NO_WORKERS`). Ya'ni joriy oyni so'rash yolg'on rad javobiga olib kelardi.
 *
 * ⚠️ YAGONA JOY — sahifadagi forma ham (`CheckForm.tsx`), ochiq endpoint ham
 * (`evaluate.ts`) shu funksiyani chaqiradi. Ilgari ular AJRALGAN edi: endpointda
 * standart qattiq `period = 1` (yanvar) edi, sahifa esa o'tgan oyni hisoblardi.
 * Natijada bir xil STIR bir kunda ikki xil javob berardi — shartnoma formasi
 * yanvar ma'lumoti asosida "imtiyoz yo'q" deb rad qilar, sahifa esa avgust
 * bo'yicha "imtiyoz qo'llaniladi" derdi (foydalanuvchi topdi, 2026-09-08).
 *
 * ⚠️ Yanvarda o'tgan oy — O'TGAN YILNING dekabri (`new Date(y, -1, 1)` shuni beradi).
 * ⚠️ Server vaqt mintaqasiga tayanadi (`TZ=Asia/Tashkent`, `.env.production`).
 */
export function defaultPeriod(now: Date = new Date()): { year: number; period: number } {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: prev.getFullYear(), period: prev.getMonth() + 1 };
}

export interface SubjectClassification {
  valid: boolean;
  normalized: string;
  type: ImtiyozSubjectType | null;
  label: string | null;
}

/**
 * 9 xonali => STIR (yuridik shaxs), 14 xonali => JSHSHIR (YATT).
 * ⚠️ Bu ikkilik butun mantiqni ajratadi: STIR `comp_workers` ga jonli so'rov
 * yuboradi, JSHSHIR esa oldindan tayyorlangan YATT indeksidan o'qiydi.
 */
export function classifySubject(raw: unknown): SubjectClassification {
  const normalized = String(raw ?? "").replace(/\D/g, "");
  if (normalized.length === 9)
    return { valid: true, normalized, type: "STIR", label: "Yuridik shaxs (STIR)" };
  if (normalized.length === 14)
    return { valid: true, normalized, type: "JSHSHIR", label: "Yakka tartibdagi tadbirkor (JSHSHIR)" };
  return { valid: false, normalized, type: null, label: null };
}

/** Xulosani bitta o'qiladigan jumlaga aylantiradi (raqamlar sochilib ketmasin). */
export function verdictSentence(d: ImtiyozResult): string {
  if (d.resultCode === "NO_WORKERS") {
    return (
      "Soliq bazasida bu raqam bo'yicha faol mehnat shartnomasi topilmadi. " +
      "Bazaga muvaffaqiyatli murojaat qilindi — bu ulanish xatosi emas."
    );
  }
  if (!d.totalWorkers) return d.message || "";

  const base = `${d.totalWorkers} xodimdan ${d.disabledCount} tasida nogironlik qayd etilgan — ${d.disabledPercentage}.`;
  if (d.resultCode === "ELIGIBLE") return `${base} Imtiyoz uchun kamida ${d.requiredCount} ta kerak edi.`;
  if (d.resultCode === "NOT_ELIGIBLE") return `${base} Imtiyoz uchun kamida ${d.requiredCount} ta bo'lishi kerak.`;
  return `${base} Ammo ma'lumot to'liq emas, shuning uchun bu raqamlarga tayanib qaror qabul qilib bo'lmaydi.`;
}

/** Nima aniq noto'g'ri ketganini ro'yxat qilib beradi ("aniqlanmadi" holatida). */
export function buildReasons(d: ImtiyozResult): string[] {
  const out: string[] = [];
  if (d.soliqError) {
    out.push(
      d.soliqError.kind === "partial"
        ? d.soliqError.message
        : `Xodimlar ro'yxati Soliq bazasidan olinmadi: ${d.soliqError.message}`,
    );
  }
  if (d.yattIndexIncomplete || d.yattIndexReady === false) {
    out.push("YATT ma'lumotlari to'liq yuklanmagan — xodimlar soni haqiqiydan kam bo'lishi mumkin");
  }
  if (d.failedChecks.length > 0) {
    out.push(
      `${d.failedChecks.length} ta xodim nogironlik reyestrida tekshirilmadi (reyestr javob bermadi)`,
    );
  }
  return out;
}
