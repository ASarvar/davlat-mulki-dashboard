import { REGIONS } from "./regions";
import { INTEGRATION_CATEGORIES } from "./categories";
import { IntegrationEntry } from "./types";

/**
 * BU FAYLNI HAQIQIY TASHQI TIZIM BILAN ALMASHTIRING.
 *
 * Hozircha bu yerda "Integratsiya" deb belgilangan 5 ta kategoriya
 * (bo'lib to'lash, sotilgan, beg'araz, savdoda turgan, savdoga chiqarish
 * jarayonida) uchun DEMO maqsadida taqlid (mock) ma'lumot qaytariladi.
 *
 * Haqiqiy integratsiyani ulash uchun:
 *   1. Tashqi tizimning REST/SOAP manzilini va autentifikatsiya
 *      ma'lumotlarini (token/API key) .env.local faylida saqlang, masalan:
 *        INTEGRATION_API_BASE_URL=https://api.example.gov.uz
 *        INTEGRATION_API_TOKEN=xxxxx
 *   2. fetchIntegrationCounts() funksiyasi ichidagi mock qismini quyidagi
 *      kabi haqiqiy so'rovga almashtiring:
 *
 *        const res = await fetch(
 *          `${process.env.INTEGRATION_API_BASE_URL}/objects/summary?year=2026`,
 *          {
 *            headers: { Authorization: `Bearer ${process.env.INTEGRATION_API_TOKEN}` },
 *            next: { revalidate: 300 }, // 5 daqiqada bir marta keshni yangilash
 *          }
 *        );
 *        const json = await res.json();
 *
 *   3. Tashqi tizimdan kelgan javobni IntegrationEntry[] shakliga moslang
 *      (regionId, categoryId, count maydonlari mos kelishi kerak — hududlar
 *      va kategoriyalar identifikatorlari lib/regions.ts va
 *      lib/categories.ts fayllaridagi bilan bir xil bo'lishi shart).
 *
 * Bu funksiya server tomonida (API route ichida) chaqiriladi, shuning
 * uchun API kalitlari hech qachon brauzerga (клиентга) chiqmaydi.
 */
export async function fetchIntegrationCounts(): Promise<IntegrationEntry[]> {
  // --- MOCK MA'LUMOT (demo uchun) ---
  const now = new Date().toISOString();
  const entries: IntegrationEntry[] = [];

  for (const region of REGIONS) {
    for (const category of INTEGRATION_CATEGORIES) {
      entries.push({
        regionId: region.id,
        categoryId: category.id,
        count: deterministicMockCount(region.id, category.id),
        syncedAt: now,
      });
    }
  }

  return entries;
  // --- MOCK MA'LUMOT TUGADI ---
}

// Demo rejimida har safar bir xil (lekin har xil hudud/kategoriya uchun
// turlicha) son chiqishi uchun oddiy deterministik "psevdo-tasodifiy" funksiya.
// Production kodida bu funksiya kerak bo'lmaydi.
function deterministicMockCount(regionId: string, categoryId: string): number {
  const str = `${regionId}:${categoryId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % 97;
  }
  return hash % 40; // 0-39 oralig'ida son
}
