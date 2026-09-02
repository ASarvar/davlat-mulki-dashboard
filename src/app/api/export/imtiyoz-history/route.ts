import { NextResponse, type NextRequest } from "next/server";
import type { ImtiyozResultCode } from "@prisma/client";
import { getCurrentUser } from "@/lib/authz";
import { listChecks } from "@/server/services/imtiyoz/audit";

/**
 * Imtiyoz tarixining CSV eksporti — qog'ozli jarayon uchun.
 *
 * ⚠️ Excel yuklab olishlari (`/api/export/*`) bilan bir xil joyda, lekin bu — CSV:
 * audit jurnali qatorlari oddiy tekis jadval, ExcelJS keltiradigan formatlash bu
 * yerda hech narsa qo'shmaydi.
 */

const MAX_ROWS = 500;

const HEADERS = [
  "Sana",
  "Foydalanuvchi",
  "STIR/JSHSHIR",
  "Turi",
  "Natija",
  "Imtiyoz",
  "Jami xodimlar",
  "Nogironligi bor",
  "Kerakli",
  "Ulushi %",
  "Tekshirilmadi",
  "Reyestrda yo'q",
  "Keshdan",
  "Xabar",
  "requestId",
];

/**
 * ⚠️ CSV injeksiyasidan himoya: `=`, `+`, `-`, `@` bilan boshlanadigan qiymatni
 * Excel FORMULA sifatida bajaradi. Bu yerda xabar matni va foydalanuvchi kiritgan
 * qiymatlar bor, shuning uchun bunday katak apostrof bilan boshlanadi.
 */
function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Tizimga kiring", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");

  const { rows } = await listChecks({
    subjectId: sp.get("subjectId") || null,
    resultCode: (sp.get("resultCode") || null) as ImtiyozResultCode | null,
    from: from ? new Date(`${from}T00:00:00.000Z`) : null,
    to: to ? new Date(`${to}T23:59:59.999Z`) : null,
    limit: MAX_ROWS,
    offset: Number(sp.get("offset")) || 0,
  });

  const lines = [HEADERS.map(cell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.createdAt.toISOString(),
        r.username,
        r.subjectId,
        r.subjectType,
        r.resultCode,
        r.isEligible === null ? "aniqlanmadi" : r.isEligible ? "ha" : "yo'q",
        r.totalWorkers,
        r.disabledCount,
        r.requiredCount,
        r.disabledPercentage != null ? `${r.disabledPercentage.toFixed(1)}%` : "",
        r.failedCount,
        r.notFoundCount,
        r.fromCache ? "ha" : "yo'q",
        r.message,
        r.requestId,
      ]
        .map(cell)
        .join(","),
    );
  }

  const filename = `imtiyoz-tarix-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(
    // BOM — Excel UTF-8 ni to'g'ri o'qishi uchun (usiz o'zbekcha harflar buziladi).
    "﻿" + lines.join("\r\n"),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    },
  );
}
