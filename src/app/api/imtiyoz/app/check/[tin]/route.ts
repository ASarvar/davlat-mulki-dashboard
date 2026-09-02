import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/authz";
import { classifySubject } from "@/lib/imtiyoz";
import { evaluateEligibility } from "@/server/services/imtiyoz/evaluate";
import { recordCheck } from "@/server/services/imtiyoz/audit";
import { clientIp } from "@/server/services/imtiyoz/request";

/**
 * Operator tekshiruvi — dashboard sessiyasi talab qilinadi.
 *
 * ⚠️ Nima uchun Server Action emas, route handler: tekshiruv 400 xodimli korxonada
 * bir necha daqiqa davom etishi mumkin va UI'da jonli sekundomer, bekor qilish
 * (`AbortController`) hamda "Qayta tekshirish" kerak. Bularning hammasi oddiy
 * `fetch` bilan tabiiy ishlaydi.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ tin: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Tizimga kiring" } },
      { status: 401 },
    );
  }

  const { tin } = await ctx.params;
  const subject = classifySubject(tin);
  if (!subject.valid) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_ID",
          message: "STIR 9 xonali, JSHSHIR esa 14 xonali raqamdan iborat bo'lishi kerak",
        },
      },
      { status: 400 },
    );
  }

  const sp = req.nextUrl.searchParams;
  const isRetry = sp.get("refresh") === "1";

  try {
    const result = await evaluateEligibility(subject.normalized, {
      year: sp.get("year"),
      period: sp.get("period"),
      refresh: isRetry,
    });

    await recordCheck(result, {
      userId: user.id,
      username: user.username ?? user.id,
      clientIp: clientIp(req),
      isRetry,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[imtiyoz] tekshiruv xatoligi:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: err instanceof Error ? err.message : String(err) } },
      { status: 500 },
    );
  }
}
