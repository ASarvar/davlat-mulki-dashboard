/**
 * Imtiyoz audit jurnali.
 *
 * ⚠️ FAQAT QO'SHILADI. Bu faylda `update`/`delete` yo'li ATAYLAB yo'q — yozuv pul
 * qaroriga asos bo'ladi. Yangi funksiya qo'shsangiz shu qoidani buzmang.
 *
 * ⚠️ Audit yozuvining muvaffaqiyatsizligi foydalanuvchi javobini TO'SMAYDI: xato
 * baland ovozda loglanadi, natija baribir qaytariladi. Sabab: tashqi bazalarga
 * o'nlab so'rov yuborib olingan javobni jurnal yozuvi tufayli tashlab yuborish —
 * foydalanuvchiga ham, auditga ham foyda keltirmaydi.
 */
import type { ImtiyozResultCode, ImtiyozWorkerStatus as DbWorkerStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ImtiyozResult, ImtiyozWorkerRow, ImtiyozWorkerStatus } from "@/lib/imtiyoz";
import { IMTIYOZ_APP_VERSION } from "./evaluate";

const TO_DB: Record<ImtiyozWorkerStatus, DbWorkerStatus> = {
  disabled: "DISABLED",
  not_disabled: "NOT_DISABLED",
  not_found: "NOT_FOUND",
  failed: "FAILED",
};

const FROM_DB: Record<DbWorkerStatus, ImtiyozWorkerStatus> = {
  DISABLED: "disabled",
  NOT_DISABLED: "not_disabled",
  NOT_FOUND: "not_found",
  FAILED: "failed",
};

export interface CheckContext {
  /** Dashboard foydalanuvchisi. Ochiq endpoint (shartnoma formasi) uchun `null`. */
  userId: string | null;
  /** Denormalizatsiya — hisob o'chirilsa ham "kim tekshirgan" javobi qoladi. */
  username: string;
  clientIp: string | null;
  isRetry: boolean;
}

/** Natijani audit jurnaliga yozadi. Xato tashlamaydi — faqat loglaydi. */
export async function recordCheck(result: ImtiyozResult, ctx: CheckContext): Promise<void> {
  try {
    await prisma.imtiyozCheck.create({
      data: {
        requestId: result.requestId,
        sourceRequestId: result.sourceRequestId,
        createdAt: new Date(result.servedAt),
        computedAt: new Date(result.computedAt),
        userId: ctx.userId,
        username: ctx.username,
        clientIp: ctx.clientIp,
        subjectId: result.subjectId,
        subjectType: result.subjectType,
        year: result.year,
        period: result.period,
        isRetry: ctx.isRetry,
        fromCache: result.fromCache,
        resultCode: result.resultCode,
        isEligible: result.isEligible,
        totalWorkers: result.totalWorkers,
        checkedCount: result.checkedCount,
        disabledCount: result.disabledCount,
        requiredCount: result.requiredCount,
        disabledPercentage: result.disabledPercentageValue,
        notDisabledCount: result.counts.notDisabled,
        notFoundCount: result.counts.notFound,
        failedCount: result.counts.failed,
        yattIndexIncomplete: result.yattIndexIncomplete,
        yattIndexReady: result.yattIndexReady,
        soliqError: result.soliqError ? `${result.soliqError.kind}: ${result.soliqError.message}` : null,
        message: result.message,
        durationMs: result.durationMs,
        appVersion: IMTIYOZ_APP_VERSION,
        workers: {
          create: result.workers.map((w, i) => ({
            ord: i,
            pinfl: w.pinfl,
            position: w.position,
            rate: w.rate,
            status: TO_DB[w.status],
            fullName: w.fullName,
            birthOn: w.birthOn,
            disabilityGroup: w.disabilityGroup,
            disabilityStartOn: w.disabilityStartOn,
            disabilityEndOn: w.disabilityEndOn,
            icd10Code: w.icd10Code,
            fromCache: w.fromCache,
            errorMessage: w.error,
          })),
        },
      },
    });
  } catch (err) {
    console.error("⚠️  [imtiyoz] AUDIT YOZILMADI (natija baribir berildi):", err instanceof Error ? err.message : err);
  }
}

// ───────────────────────── O'qish ─────────────────────────

export interface HistoryFilters {
  subjectId?: string | null;
  username?: string | null;
  resultCode?: ImtiyozResultCode | null;
  from?: Date | null;
  to?: Date | null;
  limit?: number;
  offset?: number;
}

export interface HistoryRow {
  requestId: string;
  createdAt: Date;
  username: string;
  subjectId: string;
  subjectType: string;
  resultCode: ImtiyozResultCode;
  isEligible: boolean | null;
  totalWorkers: number;
  disabledCount: number;
  requiredCount: number;
  disabledPercentage: number | null;
  failedCount: number;
  notFoundCount: number;
  fromCache: boolean;
  message: string;
}

function buildWhere(f: HistoryFilters): Prisma.ImtiyozCheckWhereInput {
  const where: Prisma.ImtiyozCheckWhereInput = {};
  if (f.subjectId) where.subjectId = { contains: f.subjectId };
  if (f.username) where.username = f.username;
  if (f.resultCode) where.resultCode = f.resultCode;
  if (f.from || f.to) {
    where.createdAt = {};
    if (f.from) where.createdAt.gte = f.from;
    if (f.to) where.createdAt.lte = f.to;
  }
  return where;
}

export async function listChecks(f: HistoryFilters): Promise<{ rows: HistoryRow[]; total: number }> {
  const where = buildWhere(f);
  const [rows, total] = await Promise.all([
    prisma.imtiyozCheck.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(f.limit ?? 50, 1), 500),
      skip: Math.max(f.offset ?? 0, 0),
      select: {
        requestId: true,
        createdAt: true,
        username: true,
        subjectId: true,
        subjectType: true,
        resultCode: true,
        isEligible: true,
        totalWorkers: true,
        disabledCount: true,
        requiredCount: true,
        disabledPercentage: true,
        failedCount: true,
        notFoundCount: true,
        fromCache: true,
        message: true,
      },
    }),
    prisma.imtiyozCheck.count({ where }),
  ]);
  return { rows, total };
}

/**
 * Saqlangan yozuvni `ImtiyozResult` shakliga qaytaradi — arxiv nusxasi jonli natija
 * bilan AYNAN bir xil komponentda chiziladi (`ResultView`), shuning uchun ikkalasi
 * hech qachon bir-biridan ajralmaydi.
 */
export async function getCheckAsResult(requestId: string): Promise<ImtiyozResult | null> {
  const check = await prisma.imtiyozCheck.findUnique({
    where: { requestId },
    include: { workers: { orderBy: { ord: "asc" } } },
  });
  if (!check) return null;

  const workers: ImtiyozWorkerRow[] = check.workers.map((w) => ({
    pinfl: w.pinfl,
    position: w.position,
    rate: w.rate,
    status: FROM_DB[w.status],
    fullName: w.fullName,
    birthOn: w.birthOn,
    disabilityGroup: w.disabilityGroup,
    disabilityStartOn: w.disabilityStartOn,
    disabilityEndOn: w.disabilityEndOn,
    icd10Code: w.icd10Code,
    fromCache: w.fromCache,
    error: w.errorMessage,
  }));

  const pick = (s: ImtiyozWorkerStatus) => workers.filter((w) => w.status === s).map((w) => w.pinfl);

  return {
    requestId: check.requestId,
    sourceRequestId: check.sourceRequestId,
    subjectId: check.subjectId,
    subjectType: check.subjectType,
    tin: check.subjectId,
    year: check.year,
    period: check.period,
    resultCode: check.resultCode,
    isEligible: check.isEligible,
    inconclusive: check.isEligible === null,
    message: check.message,
    reason: check.message,
    totalWorkers: check.totalWorkers,
    checkedCount: check.checkedCount,
    disabledCount: check.disabledCount,
    requiredCount: check.requiredCount,
    disabledPercentage: check.disabledPercentage != null ? `${check.disabledPercentage.toFixed(1)}%` : "0.0%",
    disabledPercentageValue: check.disabledPercentage ?? 0,
    counts: {
      disabled: check.disabledCount,
      notDisabled: check.notDisabledCount,
      notFound: check.notFoundCount,
      failed: check.failedCount,
    },
    workers,
    disabledChecks: pick("disabled"),
    notDisabledChecks: pick("not_disabled"),
    notFoundChecks: pick("not_found"),
    failedChecks: pick("failed"),
    // Saqlangan xato satridan `kind` ni ajratib bo'lmaydi — arxivda u "saqlangan".
    soliqError: check.soliqError ? { kind: "saqlangan", message: check.soliqError } : null,
    yattIndexIncomplete: check.yattIndexIncomplete,
    yattIndexReady: check.yattIndexReady,
    fromCache: check.fromCache,
    computedAt: check.computedAt.toISOString(),
    servedAt: check.createdAt.toISOString(),
    durationMs: check.durationMs ?? 0,
    auditUsername: check.username,
    auditIsRetry: check.isRetry,
    auditAppVersion: check.appVersion,
  };
}
