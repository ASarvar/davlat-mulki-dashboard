import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDashboardStats, buildDashboardColumns, type DashboardColumnSub, type RegionCategoryRow } from "@/server/services/stats";

// "Davlat obyektlaridan foydalanish markazi balansidagi obyektlar" (hudud × kategoriya)
// jadvalini .xlsx qilib beradi. Kategoriya ustunlari buildDashboardColumns() dan — sahifadagi
// jadval bilan bir xil. Kategoriyaga bog'liq bo'lmagan ustunlar ("Ijaraga berilgan obyektlar",
// "To'liq ijara berilgan") shu yerda kategoriyalar orasiga/oxiriga qo'shiladi — sahifadagi
// joylashuv bilan bir xil bo'lishi kerak (dashboard/page.tsx).
type ExportCol = { title: string; subs: DashboardColumnSub[] };

// "Ijaraga berilgan obyektlar soni" (SUM) bilan ARALASHTIRMANG — bu OBYEKTLAR soni (COUNT).
function standaloneCol(title: string, get: (r: RegionCategoryRow) => number): ExportCol {
  return { title, subs: [{ label: title, get }] };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Avtorizatsiya talab qilinadi", { status: 401 });

  const stats = await getDashboardStats();
  const columns = buildDashboardColumns();

  // Yagona tartiblangan ustunlar ro'yxati — kengligi, sarlavhasi va qiymati BIR marta,
  // BIR joyda hisoblanadi (avval 3 ta alohida siklda takrorlanardi — nomuvofiqlik xavfi bor edi).
  const exportCols: ExportCol[] = [];
  for (const c of columns) {
    exportCols.push({ title: `${c.code}. ${c.nameUz}`, subs: c.subs });
    if (c.code === 4) {
      exportCols.push(
        standaloneCol("Auksion savdolarida (Xususiy. va Ijara)", (r) => r.rentBreakdown.onAnyAuction.count),
      );
    }
    if (c.code === 6) {
      exportCols.push(
        standaloneCol("Ijaraga berilgan obyektlar", (r) => r.rentBreakdown.onlyFreeOrPaidCategory.count),
      );
    }
  }
  exportCols.push(standaloneCol("To'liq ijara berilgan", (r) => r.rentBreakdown.fullyRented.count));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Kategoriyalar");

  sheet.getColumn(1).width = 6;
  sheet.getColumn(2).width = 30;
  sheet.getColumn(3).width = 12;
  let colIdx = 4;
  for (const c of exportCols) {
    for (let i = 0; i < c.subs.length; i++) sheet.getColumn(colIdx++).width = c.subs.length > 1 ? 15 : 18;
  }
  const totalCols = colIdx - 1;

  // Sarlavha: 1-qator kategoriya/ustun nomlari (birlashtirilgan), 2-qator kichik ustunlar.
  sheet.mergeCells(1, 1, 2, 1);
  sheet.getCell(1, 1).value = "№";
  sheet.mergeCells(1, 2, 2, 2);
  sheet.getCell(1, 2).value = "Hududlar nomi";
  sheet.mergeCells(1, 3, 2, 3);
  sheet.getCell(1, 3).value = "Jami";

  colIdx = 4;
  for (const c of exportCols) {
    if (c.subs.length > 1) {
      sheet.mergeCells(1, colIdx, 1, colIdx + c.subs.length - 1);
      sheet.getCell(1, colIdx).value = c.title;
      c.subs.forEach((sub, i) => {
        sheet.getCell(2, colIdx + i).value = sub.area ? `${sub.label} (m²)` : sub.label;
      });
    } else {
      sheet.mergeCells(1, colIdx, 2, colIdx);
      sheet.getCell(1, colIdx).value = c.title;
    }
    colIdx += c.subs.length;
  }

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
  for (const c of exportCols) {
    for (const sub of c.subs) {
      const sum = stats.byRegionCategory.reduce((a, r) => a + sub.get(r), 0);
      jamiRow.getCell(colIdx++).value = sub.area ? round2(sum) : sum;
    }
  }
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
    for (const c of exportCols) {
      for (const sub of c.subs) {
        const v = sub.get(r);
        row.getCell(ci++).value = sub.area ? round2(v) : v;
      }
    }
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
