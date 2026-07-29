import { prisma } from "@/lib/prisma";

/**
 * API 2 dan kelgan tuman ma'lumotini `District` jadvaliga yozadi va id sini qaytaradi.
 *
 * ⚠️ Kalit — NOM emas, `code` (UZKAD `district_id`). Sabab jonli ma'lumotda tekshirilgan:
 * bitta tumanning nomi ikki xil yozilishi mumkin ("Buxoro sh." / "Buxoro shahar"), lekin
 * `district_id` barqaror (5441 obyektda: bitta nom hech qachon ikki kodga, bitta kod hech
 * qachon ikki hududga tegishli emas). Shuning uchun nomni har safar yangilaymiz — API'dagi
 * oxirgi imlo saqlanadi, guruhlash esa kod bo'yicha ketaveradi.
 *
 * Kod yoki nom bo'lmasa `null` qaytaradi (obyekt tumansiz qoladi — 5443 dan 2 tasi shunday).
 */
export async function resolveDistrictId(
  code: number | null | undefined,
  name: string | null | undefined,
  regionId: string,
): Promise<string | null> {
  if (code == null || !Number.isFinite(code) || !name?.trim()) return null;

  const district = await prisma.district.upsert({
    where: { code: Math.trunc(code) },
    create: { code: Math.trunc(code), name: name.trim(), regionId },
    // `regionId` ham yangilanadi: obyekt noto'g'ri hududga biriktirilgan bo'lsa
    // (masalan respublika manbasida kadastr prefiksi xato o'qilgan bo'lsa) API 2
    // haqiqati ustun turadi.
    update: { name: name.trim(), regionId },
    select: { id: true },
  });
  return district.id;
}

/** Hudud bo'yicha tumanlar (filtr tanlagichi uchun). Hudud berilmasa — hammasi. */
export async function listDistricts(regionId?: string) {
  return prisma.district.findMany({
    where: regionId ? { regionId } : {},
    orderBy: [{ region: { sortOrder: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, regionId: true },
  });
}
