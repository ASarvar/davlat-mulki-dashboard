import { isCadDataConfigured, API2 } from "./config";
import { fetchCadData } from "./cadData";
import { fetchPropertyBase as fetchApi2 } from "./api2";
import type { PropertyBaseData } from "./types";

type BaseResult = { ok: true; data: PropertyBaseData } | { ok: false; reason: string };

/**
 * Obyektning asosiy ma'lumotini olishning YAGONA kirish nuqtasi.
 *
 * `CADDATA_*` sozlangan bo'lsa — yangi `cad_data` (kadastr poligoni bilan),
 * aks holda eski API 2. Chaqiruvchilar shu funksiyani ishlatadi, ikkalasini
 * qo'lda tanlamaydi.
 *
 * ⚠️ **Nima uchun API 2 butunlay olib tashlanmagan** (2026-09-06):
 *   1. `cad_data` da **STIR majburiy** va u obyektning HOZIRGI egasiga mos kelishi
 *      kerak. Balansdan chiqqan obyektning YANGI egasini aniqlashda esa biz
 *      aynan egani bilmaymiz — u yerda API 2 ishlatiladi (`syncSource.ts`).
 *   2. Yangi API obyektlarning ~2.5% iga xato qaytaradi; pastdagi ZAXIRA
 *      zanjiri shu holatda ma'lumot yo'qolmasligini ta'minlaydi.
 */
export async function fetchBase(
  cadNumber: string,
  tin: string | null | undefined,
  /**
   * Eski kadastr raqami (`Property.cadNumberOld`), ma'lum bo'lsa.
   * ⚠️ Kashfiyot bosqichida (`syncPropertyBase`) obyekt hali yangi bo'lishi
   * mumkin va bu qiymat yo'q — zanjir shunda ham ishlaydi, faqat bitta qadam
   * kam bo'ladi.
   */
  cadNumberOld?: string | null,
): Promise<BaseResult> {
  // STIR bo'lmasa yangi API'ni chaqirishning ma'nosi yo'q (u `400` qaytaradi) —
  // bunday holatda darhol API 2 ga tushamiz.
  if (!isCadDataConfigured() || !tin) return fetchApi2(cadNumber);

  const primary = await fetchCadData(cadNumber, tin);
  if (primary.ok) return primary;

  /**
   * ── ZAXIRA ZANJIRI (2026-09-07) ──
   *
   * ⚠️ Ilgari bu yerda hech narsa yo'q edi: `cad_data` xato qaytarsa obyekt
   * `FAILED` bo'lib qolardi, holbuki yuqoridagi izoh API 2 ni "kafolat" deb
   * ta'riflardi. Jonli holat (Jizzax, `[2032] kadastr topilmadi`) — obyekt
   * besh marta qayta urinilgan va har safar bo'sh qaytgan.
   *
   * ⚠️ Boshqa barcha tekshiruvlar (auksion, ijara, ijara loti, kommunal)
   * ALLAQACHON eski kadastr bilan qayta urinadi (`callWithCadFallback`) —
   * asosiy ma'lumot esa urinmasdi. Real ma'lumotda obyektlarning ~86% ida
   * eski kadastr bor, ya'ni bu arzon va samarali qadam.
   *
   * ⚠️ Zanjir FAQAT birinchi urinish muvaffaqiyatsiz bo'lganda ishlaydi
   * (~2.5% obyekt), shuning uchun umumiy so'rovlar soniga ta'siri kichik.
   */
  const attempts: (() => Promise<BaseResult>)[] = [];

  // 1) O'sha API, ESKI kadastr bilan.
  if (cadNumberOld && cadNumberOld !== cadNumber) {
    attempts.push(() => fetchCadData(cadNumberOld, tin));
  }
  // 2) Eski API 2 — u STIR SO'RAMAYDI, ya'ni `2108` (obyekt boshqa tashkilotga
  //    o'tgan) holatida ham ma'lumot beradi. Balansdan chiqqanlik qarori bunga
  //    BOG'LIQ EMAS — u API 1 ning ro'yxati bo'yicha qabul qilinadi.
  if (API2.baseUrl) {
    attempts.push(() => fetchApi2(cadNumber));
    if (cadNumberOld && cadNumberOld !== cadNumber) {
      attempts.push(() => fetchApi2(cadNumberOld));
    }
  }

  for (const attempt of attempts) {
    try {
      const res = await attempt();
      if (res.ok) return res;
    } catch {
      // ⚠️ Zaxiraning xatosi YUTILADI: foydalanuvchiga ASOSIY manbaning sababi
      // ko'rsatilishi kerak ("kadastr topilmadi"), zaxiraning ikkilamchi xatosi
      // emas — aks holda xato ro'yxati chalg'ituvchi bo'lardi.
    }
  }

  return primary;
}

/** Qaysi manba ishlatilayotgani — log va diagnostika uchun. */
export function baseSourceLabel(tin?: string | null): "cad_data" | "API2" {
  return isCadDataConfigured() && tin ? "cad_data" : "API2";
}
