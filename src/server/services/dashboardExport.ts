import ExcelJS from "exceljs";
import {
  buildDashboardColumns,
  type DashboardColumnSub,
  type DashboardStats,
  type RegionCategoryRow,
} from "./stats";

// "Davlat obyektlaridan foydalanish markazi balansidagi obyektlar" hisoboti.
// Ikki varaq: "Hududlar" va "Tumanlar" — ustunlar IKKALASIDA ham bir xil
// (buildDashboardColumns() + kategoriyaga bog'liq bo'lmagan ustunlar), faqat chap
// tomondagi nom ustunlari farq qiladi.
type ExportCol = { title: string; subs: DashboardColumnSub[] };

// "Ijaraga berilgan obyektlar soni" (SUM) bilan ARALASHTIRMANG — bu OBYEKTLAR soni (COUNT).
function standaloneCol(title: string, get: (r: RegionCategoryRow) => number): ExportCol {
  return { title, subs: [{ label: title, get }] };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Bitta ma'lumot qatori: chapdagi matn ustunlari + statistika manbasi. */
type SheetRow = { labels: (string | number)[]; data: RegionCategoryRow };

/**
 * Varaqni to'liq quradi: ikki qatorli sarlavha, JAMI qatori va ma'lumot qatorlari.
 * ⚠️ Ikkala varaq ham SHU funksiyani chaqiradi — ustun qo'shilganda bir joyda o'zgaradi,
 * aks holda "Hududlar" va "Tumanlar" varaqlari bir-biridan farq qilib qolardi.
 */
function writeSheet(
  sheet: ExcelJS.Worksheet,
  exportCols: ExportCol[],
  opts: {
    /** Chapdagi matn ustunlari sarlavhasi, masalan ["№", "Hududlar nomi"] */
    labelHeaders: string[];
    labelWidths: number[];
    rows: SheetRow[];
    /** JAMI qatori hisoblanadigan to'plam (tumanlar varag'ida ham umumiy jami). */
    totalsFrom: RegionCategoryRow[];
  },
) {
  const { labelHeaders, labelWidths, rows, totalsFrom } = opts;
  const labelCount = labelHeaders.length;
  const jamiCol = labelCount + 1; // "Jami" ustuni

  labelWidths.forEach((w, i) => (sheet.getColumn(i + 1).width = w));
  sheet.getColumn(jamiCol).width = 12;

  let colIdx = jamiCol + 1;
  for (const c of exportCols) {
    for (let i = 0; i < c.subs.length; i++) sheet.getColumn(colIdx++).width = c.subs.length > 1 ? 15 : 18;
  }
  const totalCols = colIdx - 1;

  // Sarlavha: 1-qator kategoriya nomlari (birlashtirilgan), 2-qator kichik ustunlar.
  labelHeaders.forEach((h, i) => {
    sheet.mergeCells(1, i + 1, 2, i + 1);
    sheet.getCell(1, i + 1).value = h;
  });
  sheet.mergeCells(1, jamiCol, 2, jamiCol);
  sheet.getCell(1, jamiCol).value = "Jami";

  colIdx = jamiCol + 1;
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

  // JAMI — birinchi ma'lumot qatori (oltin fon, qizil raqamlar — rasmiy hisobot shakli).
  const jamiRow = sheet.getRow(3);
  jamiRow.getCell(1).value = "J A M I:";
  jamiRow.getCell(jamiCol).value = totalsFrom.reduce((a, r) => a + r.total, 0);
  colIdx = jamiCol + 1;
  for (const c of exportCols) {
    for (const sub of c.subs) {
      const sum = totalsFrom.reduce((a, r) => a + sub.get(r), 0);
      jamiRow.getCell(colIdx++).value = sub.area ? round2(sum) : sum;
    }
  }
  for (let ci = 1; ci <= totalCols; ci++) {
    const cell = jamiRow.getCell(ci);
    cell.font = { bold: true, color: { argb: "FFB91C1C" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F1E4" } };
    cell.alignment = { horizontal: ci >= jamiCol ? "center" : "left" };
  }

  rows.forEach((r, i) => {
    const row = sheet.getRow(4 + i);
    r.labels.forEach((v, li) => (row.getCell(li + 1).value = v));
    row.getCell(jamiCol).value = r.data.total;
    let ci = jamiCol + 1;
    for (const c of exportCols) {
      for (const sub of c.subs) {
        const v = sub.get(r.data);
        row.getCell(ci++).value = sub.area ? round2(v) : v;
      }
    }
  });
}


/**
 * Hisobot kitobini quradi. Ma'lumotni O'ZI olmaydi — chaqiruvchi beradi: route keshlangan
 * `getDashboardStats()` ni ishlatadi, sinov esa keshsiz `computeDashboardStats()` ni
 * (unstable_cache Next so'rov konteksti tashqarisida ishlamaydi).
 */
export function buildDashboardWorkbook(
  stats: DashboardStats,
  byRegionDistricts: { regionId: string; regionName: string; districts: RegionCategoryRow[] }[],
): ExcelJS.Workbook {
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

  // 1-varaq: hududlar kesimi (avvalgidek).
  writeSheet(workbook.addWorksheet("Hududlar"), exportCols, {
    labelHeaders: ["№", "Hududlar nomi"],
    labelWidths: [6, 30],
    totalsFrom: stats.byRegionCategory,
    rows: stats.byRegionCategory.map((r, i) => ({ labels: [i + 1, r.name], data: r })),
  });

  // 2-varaq: tumanlar kesimi — hudud bo'yicha guruhlangan, tartib raqami hudud ichida qayta boshlanadi.
  const districtRows: SheetRow[] = [];
  for (const g of byRegionDistricts) {
    g.districts.forEach((d, i) => {
      districtRows.push({ labels: [i + 1, g.regionName, d.name], data: d });
    });
  }
  writeSheet(workbook.addWorksheet("Tumanlar"), exportCols, {
    labelHeaders: ["№", "Hudud", "Tuman"],
    labelWidths: [6, 26, 28],
    // JAMI — barcha tumanlar yig'indisi. ⚠️ Bu "Hududlar" varag'idagi JAMI'dan KICHIK
    // bo'lishi mumkin: tumani aniqlanmagan obyektlar (API 2 da district_id yo'q) bu yerga kirmaydi.
    totalsFrom: districtRows.map((r) => r.data),
    rows: districtRows,
  });

  return workbook;
}
