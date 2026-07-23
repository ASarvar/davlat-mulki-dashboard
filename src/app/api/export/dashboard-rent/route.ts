import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDashboardStats } from "@/server/services/stats";

// "Hududlar kesimi — ijara shartnomalari" jadvalini .xlsx qilib beradi.
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Avtorizatsiya talab qilinadi", { status: 401 });

  const stats = await getDashboardStats();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Ijara shartnomalari");

  sheet.columns = [
    { header: "№", key: "no", width: 6 },
    { header: "Hududlar nomi", key: "name", width: 30 },
    { header: "Obyektlar soni (Kadastr agentligi)", key: "total", width: 24 },
    { header: "Obyekt soni (ijaraga berilgan)", key: "rentedObjects", width: 22 },
    { header: "Ijaraga berilishi (%)", key: "rentedPct", width: 18 },
    { header: "Shartnoma soni", key: "contractCount", width: 16 },
    { header: "Maydoni (m²)", key: "rentArea", width: 16 },
    { header: "Yillik ijara summasi (so'm)", key: "rentSum", width: 22 },
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF07102B" } };
  header.alignment = { vertical: "middle", wrapText: true };

  const jamiRow = sheet.addRow({
    no: "",
    name: "J A M I:",
    total: stats.totals.total,
    rentedObjects: stats.totals.rentedObjects,
    rentedPct: stats.totals.rentedPct,
    contractCount: stats.totals.contractCount,
    rentArea: Math.round(stats.totals.rentArea * 100) / 100,
    rentSum: stats.totals.rentSum,
  });
  jamiRow.font = { bold: true, color: { argb: "FFB91C1C" } };
  jamiRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F1E4" } };

  stats.byRegion.forEach((r, i) => {
    sheet.addRow({
      no: i + 1,
      name: r.name,
      total: r.total,
      rentedObjects: r.rentedObjects,
      rentedPct: r.rentedPct,
      contractCount: r.contractCount,
      rentArea: Math.round(r.rentArea * 100) / 100,
      rentSum: r.rentSum,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `ijara-hududlar-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
