import { NextResponse } from "next/server";
import { getCurrentUser, userSourceScope } from "@/lib/authz";
import { buildDashboardWorkbook } from "@/server/services/dashboardExport";
import { getDashboardStats, computeDistrictStatsByRegion, type StatsScope } from "@/server/services/stats";
import { listSourceNames } from "@/server/services/sources";
import { isLandSplitSoha } from "@/lib/sourceLabel";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Avtorizatsiya talab qilinadi", { status: 401 });

  // Dashboard'dagi manba (soha) kesimi eksportga ham o'tadi — aks holda ekranda
  // bir manba ko'rinib turib, yuklangan faylda hamma manba chiqib ketardi.
  const sohaRaw = new URL(req.url).searchParams.get("soha")?.trim() || undefined;
  const soha = sohaRaw && (await listSourceNames()).includes(sohaRaw) ? sohaRaw : undefined;

  // ⚠️ Rol doirasi ham qo'llanadi — aks holda cheklangan foydalanuvchi ekranda o'z
  // tashkilotini ko'rib turib, eksport orqali BUTUN bazani yuklab olardi.
  const scope: StatsScope = { sourceName: soha, sourceIds: await userSourceScope(user) };

  const [stats, byRegionDistricts] = await Promise.all([
    getDashboardStats(scope),
    computeDistrictStatsByRegion(scope),
  ]);
  const workbook = buildDashboardWorkbook(stats, byRegionDistricts, isLandSplitSoha(soha) ? "landSplit" : "default");
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `kategoriyalar-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
