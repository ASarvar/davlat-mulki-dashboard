import { PassThrough, Readable } from "node:stream";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { SyncStatus } from "@prisma/client";
import { auth } from "@/auth";
import type { SessionUser } from "@/lib/authz";
import { CATEGORY_BY_CODE, effectiveCategory } from "@/lib/categories";
import { iteratePropertiesForExport, type PropertyFilters } from "@/server/services/properties";

const SYNC_LABEL: Record<string, string> = {
  PENDING: "Kutilmoqda",
  SYNCING: "Jarayonda",
  SYNCED: "Sinxron",
  FAILED: "Xato",
};

// Obyektlar ro'yxatini .xlsx qilib beradi. Joriy filtrlarni va
// rol/hudud doirasini hurmat qiladi (buildWhere ro'yxat bilan umumiy).
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Avtorizatsiya talab qilinadi", { status: 401 });
  const user = session.user as SessionUser;

  const sp = new URL(req.url).searchParams;
  const statusRaw = sp.get("status");
  const inefficient = sp.get("inefficient");
  const category = sp.get("category");

  const filters: PropertyFilters = {
    q: sp.get("q")?.trim() || undefined,
    regionId: sp.get("region") || undefined,
    soha: sp.get("soha") || undefined,
    categoryCode: category ? Number(category) : undefined,
    inefficient: inefficient === "1" ? true : inefficient === "0" ? false : undefined,
    syncStatus: statusRaw && statusRaw in SyncStatus ? (statusRaw as SyncStatus) : undefined,
  };

  const passThrough = new PassThrough();
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: passThrough, useStyles: true });
  const sheet = workbook.addWorksheet("Obyektlar");

  sheet.columns = [
    { header: "Kadastr raqami", key: "cad", width: 26 },
    { header: "Eski kadastr", key: "cadOld", width: 26 },
    { header: "Hudud", key: "region", width: 24 },
    { header: "Manba", key: "source", width: 18 },
    { header: "Nomi", key: "name", width: 28 },
    { header: "Manzil", key: "address", width: 34 },
    { header: "Binoning umumiy maydoni (m²)", key: "area", width: 24 },
    { header: "Foydali maydon (m²)", key: "buildingArea", width: 20 },
    { header: "Kategoriya kodi", key: "catCode", width: 15 },
    { header: "Kategoriya", key: "catName", width: 40 },
    { header: "Kategoriya manbai", key: "catSource", width: 16 },
    { header: "Lot raqami", key: "lot", width: 16 },
    { header: "Lot holati", key: "lotStatus", width: 22 },
    { header: "To'lov muddati (oy)", key: "payTerm", width: 18 },
    { header: "Savdo turi", key: "auctionGroup", width: 28 },
    { header: "Ijara shartnomalari", key: "rentCount", width: 18 },
    { header: "Ijara summasi", key: "rentSum", width: 18 },
    { header: "Ijara maydoni (m²)", key: "rentArea", width: 18 },
    { header: "Ijara eski kadastr orqali", key: "rentOldCad", width: 22 },
    { header: "Samaradorlik", key: "efficiency", width: 14 },
    { header: "Sync holati", key: "sync", width: 14 },
    { header: "Oxirgi sync", key: "lastSync", width: 20 },
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF07102B" } }; // --navy
  header.alignment = { vertical: "middle" };
  header.commit();

  // Qatorlarni fonda oqimga yozamiz — javob darhol qaytadi.
  (async () => {
    try {
      for await (const batch of iteratePropertiesForExport(user, filters)) {
        for (const r of batch) {
          const cat = effectiveCategory(r.integrationCategoryCode, r.manualCategoryCode);
          sheet
            .addRow({
              cad: r.cadNumber,
              cadOld: r.cadNumberOld ?? "",
              region: r.regionName,
              source: r.sourceName,
              name: r.name ?? "",
              address: r.address ?? "",
              area: r.area,
              buildingArea: r.buildingArea,
              catCode: cat?.code ?? "",
              catName: cat ? (CATEGORY_BY_CODE.get(cat.code)?.nameUz ?? "") : "Kategoriyasiz",
              catSource: cat ? (cat.source === "INTEGRATION" ? "Integratsiya" : "Qo'lda") : "",
              efficiency: r.isInefficient ? "Samarasiz" : "Samarali",
              sync: SYNC_LABEL[r.syncStatus] ?? r.syncStatus,
              lot: r.lotNumber ?? "",
              lotStatus: r.lotStatus ?? "",
              payTerm: r.paymentTermMonths ?? "",
              auctionGroup: r.auctionGroupName ?? "",
              rentCount: r.rentContractCount ?? "",
              rentSum: r.rentTotalSum ?? "",
              rentArea: r.rentTotalArea ?? "",
              rentOldCad: r.rentMatchedByOldCad ? "Ha" : "",
              lastSync: r.lastSyncedAt ? r.lastSyncedAt.toLocaleString("uz") : "",
            })
            .commit();
        }
      }
      sheet.commit();
      await workbook.commit();
    } catch (err) {
      console.error("[export] xato:", err);
      passThrough.destroy(err instanceof Error ? err : new Error("eksport xatosi"));
    }
  })();

  const fileName = `obyektlar-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(Readable.toWeb(passThrough) as ReadableStream, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
