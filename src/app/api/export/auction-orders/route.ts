import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import type { AuctionOrder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSection } from "@/server/services/sectionAccess";
import { auctionWhere, type AuctionOrderFilters } from "@/server/services/auctionOrders";

/**
 * Auksion buyurtmalari reyestrining .xlsx eksporti.
 *
 * ⚠️ `requireSection("auksion")` MAJBURIY — bo'limni yashirish uning route'ini
 * yashirmaydi (CLAUDE.md). Usiz istalgan tizimga kirgan foydalanuvchi shaxsiy
 * ma'lumotli 68 000 qatorni yuklab olardi.
 *
 * ⚠️ Filtr ekrandagi bilan AYNAN bir xil — ikkalasi ham `auctionWhere()` dan
 * oziqlanadi (`buildWhere()` bilan bir xil printsip: eksportdagi son ekrandagidan
 * farq qilmasin).
 */

interface Col {
  header: string;
  width: number;
  get: (o: AuctionOrder) => string | number | Date | null;
}

/** ⚠️ Sana YACHEYKAGA `Date` bo'lib yoziladi (satr emas) — Excel'da saralash ishlasin. */
const COLS: Col[] = [
  { header: "Buyurtma ID", width: 12, get: (o) => o.orderId },
  { header: "Lot raqami", width: 14, get: (o) => o.lotNumber },
  { header: "Akkaunt", width: 10, get: (o) => o.credential },
  { header: "Nomi", width: 44, get: (o) => o.name },
  { header: "Manzili", width: 32, get: (o) => o.address },
  { header: "Hudud", width: 22, get: (o) => o.region },
  { header: "Tuman", width: 20, get: (o) => o.area },
  { header: "Kadastr raqami", width: 24, get: (o) => o.cadastreNumber },
  { header: "Ijara maydoni (m²)", width: 14, get: (o) => (o.rentArea !== null ? Number(o.rentArea) : null) },
  { header: "Turi", width: 26, get: (o) => o.groupName },
  { header: "Toifa", width: 26, get: (o) => o.categoryName },
  { header: "Auksion sanasi", width: 16, get: (o) => o.auctionDate },
  { header: "Lotga qo'yilgan", width: 16, get: (o) => o.lotPlaceDate },
  { header: "Boshlang'ich narx", width: 16, get: (o) => (o.startPrice ? Number(o.startPrice) : null) },
  { header: "Sotilgan narx", width: 16, get: (o) => (o.soldPrice ? Number(o.soldPrice) : null) },
  { header: "To'langan", width: 16, get: (o) => (o.paidPrice ? Number(o.paidPrice) : null) },
  { header: "Bo'lib to'lash", width: 13, get: (o) => (o.termPayment === 1 ? "Ha" : "Yo'q") },
  { header: "Muddat (oy)", width: 12, get: (o) => o.termMonth },
  { header: "Buyurtma holati", width: 28, get: (o) => o.orderStatus },
  { header: "Lot holati", width: 20, get: (o) => o.lotStatus },
  { header: "Buyurtmachi", width: 36, get: (o) => o.customerName },
  { header: "Buyurtmachi STIR", width: 14, get: (o) => o.customerInn },
  // ── Shaxsiy ma'lumot ──
  { header: "G'olib", width: 30, get: (o) => o.winnerName },
  { header: "G'olib STIR", width: 14, get: (o) => o.winnerInn },
  { header: "G'olib JSHSHIR", width: 16, get: (o) => o.winnerPinfl },
  { header: "G'olib telefon", width: 16, get: (o) => o.winnerPhone },
  { header: "G'olib manzili", width: 32, get: (o) => o.winnerAddress },
  { header: "Bayonnoma", width: 30, get: (o) => o.protocolFileUrl },
];

const HEADER_FILL = "FF07102B";

/**
 * ⚠️ Butun natija xotiraga yig'ilmaydi — filtrsiz eksport 68 000 qator bo'lishi
 * mumkin. Kursor bo'yicha bo'lak-bo'lak o'qib, to'g'ridan-to'g'ri varaqqa yoziladi.
 */
const CHUNK = 2000;

export async function GET(req: Request) {
  await requireSection("auksion");

  const sp = new URL(req.url).searchParams;
  const holat = sp.get("holat");
  const f: AuctionOrderFilters = {
    q: sp.get("q") || undefined,
    credential: sp.get("akkaunt") || undefined,
    region: sp.get("hudud") || undefined,
    statusId: holat ? Number(holat) : undefined,
    groupName: sp.get("tur") || undefined,
    from: sp.get("dan") || undefined,
    to: sp.get("gacha") || undefined,
  };
  const where = auctionWhere(f);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Auksion buyurtmalari");
  sheet.columns = COLS.map((c) => ({ header: c.header, width: c.width }));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.height = 28;
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  let cursor: number | undefined;
  for (;;) {
    const batch: AuctionOrder[] = await prisma.auctionOrder.findMany({
      where,
      orderBy: { orderId: "asc" },
      take: CHUNK,
      ...(cursor !== undefined ? { cursor: { orderId: cursor }, skip: 1 } : {}),
    });
    if (batch.length === 0) break;
    for (const o of batch) sheet.addRow(COLS.map((c) => c.get(o)));
    cursor = batch[batch.length - 1].orderId;
    if (batch.length < CHUNK) break;
  }

  // Narx ustunlari — ming ajratgichli format.
  for (const [i, c] of COLS.entries()) {
    if (c.header.includes("narx") || c.header === "To'langan") {
      sheet.getColumn(i + 1).numFmt = "#,##0";
    }
    if (c.header.includes("sanasi") || c.header.includes("qo'yilgan")) {
      sheet.getColumn(i + 1).numFmt = "dd.mm.yyyy";
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `auksion-buyurtmalari-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      // ⚠️ Shaxsiy ma'lumot — proxy/brauzer keshiga tushmasin.
      "Cache-Control": "private, no-store",
    },
  });
}
