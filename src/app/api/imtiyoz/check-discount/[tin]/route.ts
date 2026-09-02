import { NextResponse, type NextRequest } from "next/server";
import { classifySubject } from "@/lib/imtiyoz";
import { evaluateEligibility } from "@/server/services/imtiyoz/evaluate";
import { recordCheck } from "@/server/services/imtiyoz/audit";
import { clientIp } from "@/server/services/imtiyoz/request";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  OCHIQ ENDPOINT — shartnoma formasidagi "Текшириш (3782)" tugmasi shu    ║
 * ║  yerga murojaat qiladi. AUTH QO'YMANG: aks holda forma ishlamay qoladi.  ║
 * ║  CORS ham ochiq qolishi kerak — forma boshqa origin'dan chaqiradi.       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ⚠️ Bu yo'l `middleware.ts` matcher'ida ISTISNO qilingan — usiz middleware uni
 * login sahifasiga yo'naltirardi va forma HTML olib, JSON kutib qolardi.
 *
 * ⚠️ Javob shakli (`{ success, data }`) va `data.reason` maydoni deploy qilingan
 * forma kodiga bog'langan — O'ZGARTIRMANG.
 *
 * Tekshiruvlar auditga `forma` nomi bilan yoziladi (bu yerda foydalanuvchi noma'lum).
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
} as const;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ tin: string }> }) {
  try {
    const { tin } = await ctx.params;
    const subject = classifySubject(tin);
    if (!subject.valid) {
      return NextResponse.json(
        { success: false, message: "STIR 9 xonali, JSHSHIR 14 xonali bo'lishi kerak", error: "INVALID_ID" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const sp = req.nextUrl.searchParams;
    const isRetry = sp.get("refresh") === "1";

    const result = await evaluateEligibility(subject.normalized, {
      year: sp.get("year"),
      period: sp.get("period"),
      refresh: isRetry,
    });

    await recordCheck(result, {
      userId: null,
      username: "forma",
      clientIp: clientIp(req),
      isRetry,
    });

    return NextResponse.json({ success: true, data: result }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("[imtiyoz] ochiq endpoint xatoligi:", err);
    return NextResponse.json(
      {
        success: false,
        message: "Ichki tizim xatosi yuz berdi",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
