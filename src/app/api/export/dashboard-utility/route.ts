import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getCurrentUser, userSourceScope } from "@/lib/authz";
import {
  computeUtilityStats,
  computeDistrictUtilityStats,
  type RegionUtilityRow,
} from "@/server/services/stats";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

// "Bo'sh turgan obyektlarda kommunal xizmatlar" jadvalini .xlsx qilib beradi.
// Ikki varaq: "Hududlar" va "Tumanlar" — dashboard-categories bilan bir xil printsip.
//
// ⚠️ Ustunlar EKRANDAGI jadval bilan bir xil tartibda va bir xil mezonda: ikkalasi ham
// `computeUtilityStats()` natijasidan o'qiydi, ya'ni jadval o'zgarsa eksport ham
// avtomatik ergashadi (`buildDashboardColumns()` bilan bir xil yondashuv).

interface Col {
  header: string;
  width: number;
  get: (r: RegionUtilityRow) => number;
  round?: boolean;
}

const COLS: Col[] = [
  { header: "Bo'sh turgan obyektlar soni", width: 20, get: (r) => r.count },
  { header: "Foydali maydoni (m²)", width: 18, get: (r) => r.usefulArea, round: true },
  { header: "Suv abonenti bor", width: 14, get: (r) => r.water },
  { header: "Gaz abonenti bor", width: 14, get: (r) => r.gas },
  { header: "Elektr abonenti bor", width: 16, get: (r) => r.electric },
  { header: "Kamida bitta xizmat", width: 18, get: (r) => r.anyUtility },
  {
    header: `Yaqinda to'lov (${env.UTILITY_RECENT_PAYMENT_MONTHS} oy)`,
    width: 20,
    get: (r) => r.recentlyPaid,
  },
  { header: "Tekshirilmagan", width: 14, get: (r) => r.unchecked },
];

const HEADER_FILL = "FF07102B";
const TOTALS_FILL = "FFF7F1E4";

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  header.alignment = { vertical: "middle", wrapText: true };
}

const value = (c: Col, r: RegionUtilityRow) =>
  c.round ? Math.round(c.get(r) * 100) / 100 : c.get(r);

/** Bitta varaq — hududlar yoki tumanlar uchun (birinchi ustun nomi farq qiladi). */
function writeSheet(
  sheet: ExcelJS.Worksheet,
  firstHeader: string,
  rows: { label: string; row: RegionUtilityRow }[],
  extraFirstCol?: string,
) {
  sheet.columns = [
    { header: "№", key: "no", width: 6 },
    ...(extraFirstCol ? [{ header: extraFirstCol, key: "group", width: 24 }] : []),
    { header: firstHeader, key: "name", width: 28 },
    ...COLS.map((c, i) => ({ header: c.header, key: `c${i}`, width: c.width })),
  ];
  styleHeader(sheet);

  // J A M I — birinchi qator (rasmiy hisobot shakli, CLAUDE.md).
  const totals: Record<string, string | number> = { no: "", name: "J A M I:" };
  if (extraFirstCol) totals.group = "";
  COLS.forEach((c, i) => {
    const raw = rows.reduce((a, x) => a + c.get(x.row), 0);
    totals[`c${i}`] = c.round ? Math.round(raw * 100) / 100 : raw;
  });
  const jami = sheet.addRow(totals);
  jami.font = { bold: true, color: { argb: "FFB91C1C" } };
  jami.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTALS_FILL } };

  rows.forEach((x, i) => {
    const data: Record<string, string | number> = { no: i + 1, name: x.row.name };
    if (extraFirstCol) data.group = x.label;
    COLS.forEach((c, ci) => {
      data[`c${ci}`] = value(c, x.row);
    });
    sheet.addRow(data);
  });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Avtorizatsiya talab qilinadi", { status: 401 });

  // ⚠️ Rol doirasi SHART — aks holda cheklangan foydalanuvchi ekranda o'z tashkilotini
  // ko'rib turib, eksport orqali butun bazani yuklab olardi.
  const scope = { sourceIds: await userSourceScope(user) };

  const regionRows = await computeUtilityStats(scope);
  const workbook = new ExcelJS.Workbook();

  writeSheet(
    workbook.addWorksheet("Hududlar"),
    "Hududlar nomi",
    regionRows.map((row) => ({ label: "", row })),
  );

  // ── Tumanlar varag'i ──
  // ⚠️ Bu varaqdagi JAMI "Hududlar"nikidan KICHIK bo'lishi normal: tumani aniqlanmagan
  // obyektlar (API 2 da `district_id` yo'q) va respublika darajasidagi tashkilotlar
  // bu yerga kirmaydi — kategoriyalar eksportidagi bilan bir xil holat.
  const regions = await prisma.region.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  const districtRows: { label: string; row: RegionUtilityRow }[] = [];
  for (const region of regions) {
    const districts = await computeDistrictUtilityStats(region.id, scope);
    for (const row of districts) {
      if (row.count > 0) districtRows.push({ label: region.name, row });
    }
  }
  writeSheet(workbook.addWorksheet("Tumanlar"), "Tuman nomi", districtRows, "Hudud");

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `kommunal-bosh-turgan-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
