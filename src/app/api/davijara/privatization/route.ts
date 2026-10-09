import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { AUCTION_GROUP_RENT } from "@/server/services/classification";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  davijara.uz uchun: xususiylashtirish savdosiga chiqarilgan obyektlar.   ║
 * ║  Chaqiruvchi — davijara SERVERI (brauzer emas), sessiyasiz.              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ⚠️ Yo'l `middleware.ts` matcher'ida ISTISNO qilingan — himoya shu yerda:
 * `x-davijara-token` == `DAVIJARA_API_TOKEN`. Token sozlanmagan bo'lsa 503
 * (ochiq qolib ketmaydi). Production'da davijara uni hostdan chaqiradi:
 * `http://127.0.0.1:3000/obyektlar/api/davijara/privatization`.
 *
 * ── Qaysi obyektlar ──
 * `hasPrivatizationLot` (sotilmagan, loti bor) va `auctionGroupName` IJARA EMAS.
 * ⚠️ Guruh sharti SHART: `hasPrivatizationLot` API 3+4 natijasidan `group_name`
 * ga qaramay yoziladi, kategoriya 3/4 esa aynan shu guruh bilan ajraladi
 * (`classification.ts`). `null` guruh — kat 3 bilan bir xil — xususiylashtirish.
 *
 * ⚠️ `hasPrivatizationLot` "HOZIR ARIZA QABUL QILINMOQDA" degani EMAS: lokal
 * bazada (2026-09-06 holati) 631 tadan 488 tasining loti "Mol-mulk (obyekt)
 * sotilmadi", 38 tasi "Vaqtincha to`xtatildi", faqat 71 tasida ariza qabul
 * qilinardi. Shuning uchun HAMMASI holati bilan beriladi va "savdoda" deb
 * qaysini ko'rsatishni davijara o'zi hal qiladi (`lotStatus`, `auctionDate`).
 *
 * ── Nima BERILMAYDI ──
 * Shaxsga doir ma'lumot ham, STIR ham yo'q: g'olib, balansda saqlovchining
 * F.I.O./STIR'i, ijarachi — hech biri `select` da emas. Faqat obyekt va lot.
 * Maydon qo'shsangiz shu qoidani saqlang: bu javob ommaviy saytga chiqadi.
 */

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): "ok" | "unconfigured" | "denied" {
  const expected = env.DAVIJARA_API_TOKEN;
  if (!expected) return "unconfigured";
  const given = req.headers.get("x-davijara-token") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "denied";
}

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function GET(req: NextRequest) {
  const auth = authorized(req);
  if (auth === "unconfigured") {
    return NextResponse.json({ success: false, error: "NOT_CONFIGURED" }, { status: 503 });
  }
  if (auth === "denied") {
    return NextResponse.json({ success: false, error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const rows = await prisma.property.findMany({
      where: {
        hasPrivatizationLot: true,
        removedFromBalance: false,
        OR: [{ auctionGroupName: null }, { auctionGroupName: { not: AUCTION_GROUP_RENT } }],
      },
      select: {
        cadNumber: true,
        name: true,
        address: true,
        area: true,
        buildingArea: true,
        isLand: true,
        lat: true,
        lng: true,
        coordSource: true,
        lotNumber: true,
        auctionOrderId: true,
        auctionGroupName: true,
        termPayment: true,
        auctionCheckedAt: true,
        region: { select: { code: true, name: true } },
        district: { select: { name: true } },
        auctionLots: {
          where: { type: "PRIVATIZATION" },
          select: {
            lotNumber: true,
            orderId: true,
            area: true,
            startPrice: true,
            auctionDate: true,
            lotStatus: true,
            orderStatus: true,
          },
        },
      },
      orderBy: { cadNumber: "asc" },
    });

    const objects = rows.map((p) => {
      // Bitta obyekt — bitta xususiylashtirish loti (`checkPropertyStatus.ts`).
      const lot = p.auctionLots[0];
      return {
        cadNumber: p.cadNumber,
        name: p.name,
        address: p.address,
        regionCode: p.region.code,
        regionName: p.region.name,
        districtName: p.district?.name ?? null,
        lat: p.lat,
        lng: p.lng,
        coordSource: p.coordSource,
        isLand: p.isLand,
        landArea: num(p.area),
        buildingArea: num(p.buildingArea),
        groupName: p.auctionGroupName,
        termPayment: p.termPayment === 1,
        lot: {
          lotNumber: lot?.lotNumber ?? p.lotNumber,
          orderId: lot?.orderId ?? p.auctionOrderId,
          area: num(lot?.area),
          startPrice: num(lot?.startPrice),
          auctionDate: lot?.auctionDate?.toISOString() ?? null,
          lotStatus: lot?.lotStatus ?? null,
          orderStatus: lot?.orderStatus ?? null,
        },
        checkedAt: p.auctionCheckedAt?.toISOString() ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      count: objects.length,
      objects,
    });
  } catch (err) {
    // ⚠️ Xato matni tashqariga chiqmaydi — Prisma xabarida jadval/ustun nomlari bor.
    console.error("[davijara/privatization]", err);
    return NextResponse.json({ success: false, error: "INTERNAL" }, { status: 500 });
  }
}
