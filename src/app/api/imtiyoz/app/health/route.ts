import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/authz";
import { getServiceSnapshots, yattStatus } from "@/server/services/imtiyoz/health";
import { getYattState } from "@/server/services/imtiyoz/yattIndex";
import { imtiyozConfigured } from "@/server/integrations/imtiyoz";

/**
 * Tashqi manbalar holati — diagnostika paneli uchun.
 *
 * ⚠️ Soliq/TIEK holati SHU processning haqiqiy trafigidan hisoblanadi va probe
 * yuborilmaydi, ya'ni bu chaqiruv shlyuzga BIRORTA ham so'rov qo'shmaydi.
 * YATT esa umumiy — u bazadan (`ImtiyozYattSync`) o'qiladi.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Tizimga kiring" } },
      { status: 401 },
    );
  }

  const yatt = await getYattState();

  return NextResponse.json({
    success: true,
    data: {
      configured: imtiyozConfigured(),
      ...getServiceSnapshots(),
      yatt: {
        status: yattStatus(yatt),
        ready: yatt.ready,
        syncing: yatt.syncing,
        lastSyncedAt: yatt.lastSyncedAt?.toISOString() ?? null,
        entrepreneursIndexed: yatt.entrepreneurCount,
        recordsIndexed: yatt.recordCount,
        failedPagesCount: yatt.failedPages,
        lastError: yatt.lastError,
      },
    },
  });
}
