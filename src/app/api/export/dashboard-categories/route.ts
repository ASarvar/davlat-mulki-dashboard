import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDashboardStats, buildDashboardColumns } from "@/server/services/stats";

// "Davlat obyektlaridan foydalanish markazi balansidagi obyektlar" (hudud × kategoriya)
// jadvalini .xlsx qilib beradi. Ustun tuzilishi buildDashboardColumns() dan — sahifadagi
// jadval bilan bir xil (COLUMNS o'sha yerdan ham olinadi).
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Avtorizatsiya talab qilinadi", { status: 401 });

  const stats = await getDashboardStats();
  const columns = buildDashboardColumns();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Kategoriyalar");

  sheet.getColumn(1).width = 6;
  sheet.getColumn(2).width = 30;
  sheet.getColumn(3).width = 12;
  let colIdx = 4;
  for (const c of columns) {
    for (let i = 0; i < c.subs.length; i++) sheet.getColumn(colIdx++).width = 15;
  }
  const fullyRentedColIdx = colIdx;
  sheet.getColumn(fullyRentedColIdx).width = 16;
  const totalCols = fullyRentedColIdx;

  // Sarlavha: 1-qator kategoriya nomlari (birlashtirilgan), 2-qator kichik ustunlar.
  sheet.mergeCells(1, 1, 2, 1);
  sheet.getCell(1, 1).value = "№";
  sheet.mergeCells(1, 2, 2, 2);
  sheet.getCell(1, 2).value = "Hududlar nomi";
  sheet.mergeCells(1, 3, 2, 3);
  sheet.getCell(1, 3).value = "Jami";

  colIdx = 4;
  for (const c of columns) {
    if (c.subs.length > 1) {
      sheet.mergeCells(1, colIdx, 1, colIdx + c.subs.length - 1);
      sheet.getCell(1, colIdx).value = `${c.code}. ${c.nameUz}`;
      c.subs.forEach((sub, i) => {
        sheet.getCell(2, colIdx + i).value = sub.area ? `${sub.label} (m²)` : sub.label;
      });
    } else {
      sheet.mergeCells(1, colIdx, 2, colIdx);
      sheet.getCell(1, colIdx).value = `${c.code}. ${c.nameUz}`;
    }
    colIdx += c.subs.length;
  }
  sheet.mergeCells(1, fullyRentedColIdx, 2, fullyRentedColIdx);
  sheet.getCell(1, fullyRentedColIdx).value = "To'liq ijara berilgan";

  for (let r = 1; r <= 2; r++) {
    const row = sheet.getRow(r);
    for (let ci = 1; ci <= totalCols; ci++) {
      const cell = row.getCell(ci);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF07102B" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  // JAMI — birinchi ma'lumot qatori (oltin fon, qizil raqamlar — rasmiy hisobot shakli).
  const jamiRow = sheet.getRow(3);
  jamiRow.getCell(2).value = "J A M I:";
  jamiRow.getCell(3).value = stats.byRegionCategory.reduce((a, r) => a + r.total, 0);
  colIdx = 4;
  for (const c of columns) {
    for (const sub of c.subs) {
      const sum = stats.byRegionCategory.reduce((a, r) => a + sub.get(r), 0);
      jamiRow.getCell(colIdx++).value = sub.area ? round2(sum) : sum;
    }
  }
  jamiRow.getCell(fullyRentedColIdx).value = stats.byRegionCategory.reduce(
    (a, r) => a + r.rentBreakdown.fullyRented.count,
    0,
  );
  for (let ci = 1; ci <= totalCols; ci++) {
    const cell = jamiRow.getCell(ci);
    cell.font = { bold: true, color: { argb: "FFB91C1C" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F1E4" } };
    cell.alignment = { horizontal: ci >= 3 ? "center" : "left" };
  }

  stats.byRegionCategory.forEach((r, i) => {
    const row = sheet.getRow(4 + i);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = r.name;
    row.getCell(3).value = r.total;
    let ci = 4;
    for (const c of columns) {
      for (const sub of c.subs) {
        const v = sub.get(r);
        row.getCell(ci++).value = sub.area ? round2(v) : v;
      }
    }
    row.getCell(fullyRentedColIdx).value = r.rentBreakdown.fullyRented.count;
  });

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
