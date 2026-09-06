import { isCadDataConfigured } from "./config";
import { fetchCadData } from "./cadData";
import { fetchPropertyBase as fetchApi2 } from "./api2";
import type { PropertyBaseData } from "./types";

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
 *   2. Yangi API obyektlarning ~2.5% iga `404`/`400` qaytaradi; zaxira sifatida
 *      API 2 ni sozlangan holda qoldirish ma'lumot yo'qotmaslikning kafolati.
 */
export async function fetchBase(
  cadNumber: string,
  tin: string | null | undefined,
): Promise<{ ok: true; data: PropertyBaseData } | { ok: false; reason: string }> {
  // STIR bo'lmasa yangi API'ni chaqirishning ma'nosi yo'q (u `400` qaytaradi) —
  // bunday holatda darhol API 2 ga tushamiz.
  if (isCadDataConfigured() && tin) return fetchCadData(cadNumber, tin);
  return fetchApi2(cadNumber);
}

/** Qaysi manba ishlatilayotgani — log va diagnostika uchun. */
export function baseSourceLabel(tin?: string | null): "cad_data" | "API2" {
  return isCadDataConfigured() && tin ? "cad_data" : "API2";
}
