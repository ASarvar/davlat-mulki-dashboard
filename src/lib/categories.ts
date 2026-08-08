// Kategoriyalar UI metama'lumoti (seed bilan mos). Mantiq manbai — DB (Category jadvali);
// bu yerda faqat ko'rsatish uchun label/short va select ro'yxati.
export interface CategoryMeta {
  code: number;
  nameUz: string;
  short: string;
  source: "INTEGRATION" | "MANUAL";
  excludeInefficient: boolean;
  requiresDocument: boolean;
}

// Tartib foydalanuvchi tomonidan belgilangan: avval INTEGRATION (1–6), keyin MANUAL (7–12).
// 11–12 (bo'sh turgan) — yagona SAMARASIZ kategoriyalar.
export const CATEGORIES: CategoryMeta[] = [
  { code: 1, nameUz: "Sotilgan (Bo'lib to'lash sharti bilan)", short: "Sotilgan (bo'lib to'lash)", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 2, nameUz: "Sotilgan", short: "Sotilgan", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 3, nameUz: "Savdoda xususiylashtirish", short: "Savdoda xususiy.", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 4, nameUz: "Savdoda ijara", short: "Savdoda ijara", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 5, nameUz: "Tekin foydalanish", short: "Tekin foydalanish", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 6, nameUz: "Ijara shartnomasi bor", short: "Ijara shartnomasi bor", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  // 7 — qo'lda ham tanlanadi, API 3 status_name ("Экспертиза"/"Баҳолашда"/"Хатловда") ham beradi.
  { code: 7, nameUz: "Savdoga chiqarish jarayonida", short: "Savdoga chiqmoqda", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  // { code: 8, nameUz: "Savdosi to'xtatilgan", short: "Savdo to'xtatilgan", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  { code: 9, nameUz: "Foydalanishga yaroqsiz holatda", short: "Yaroqsiz holat", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  { code: 10, nameUz: "Chekka hududlarda joylashgan", short: "Chekka hudud", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  { code: 11, nameUz: "Bo'sh turgan", short: "Bo'sh turgan", source: "MANUAL", excludeInefficient: false, requiresDocument: true },
  { code: 12, nameUz: "Bo'sh turgan maydoni mavjud", short: "Bo'sh maydon bor", source: "MANUAL", excludeInefficient: false, requiresDocument: true },
];

export const CATEGORY_BY_CODE = new Map<number, CategoryMeta>(CATEGORIES.map((c) => [c.code, c]));
export const MANUAL_CATEGORIES = CATEGORIES.filter((c) => c.source === "MANUAL");

/**
 * "Balansdan chiqarilgan" — obyekt endi tashkilot balansida emas (API 1 ro'yxatidan
 * tushib qolgan, odatda boshqa STIRga o'tkazilgan). `Property.removedFromBalance`
 * bayrog'i bilan belgilanadi (`syncSource.ts`).
 *
 * ⚠️ Bu ATAYIN `CATEGORIES` massivida YO'Q va `Category` jadvalida ham saqlanmaydi:
 *  - `buildDashboardColumns()` `CATEGORIES` ustidan yuradi — qo'shilsa dashboardda
 *    keraksiz ustun paydo bo'lardi (holbuki bunday obyekt hisobga UMUMAN kirmasligi kerak);
 *  - `ASSIGNABLE_CATEGORIES`ga tushib, qo'lda biriktirish formasida ko'rinib qolardi.
 * U faqat obyektlar ro'yxatidagi FILTR qiymati va yorliq sifatida ishlatiladi.
 */
export const CAT_REMOVED_FROM_BALANCE = 13;
export const REMOVED_FROM_BALANCE_LABEL = "Balansdan chiqarilgan";

// Qo'lda biriktirish formasida ko'rsatiladigan kategoriyalar: faqat 9 (Yaroqsiz) va
// 10 (Chekka). 7/11/12 formadan olib tashlangan (foydalanuvchi talabi). Nazoratchi
// aynan shu ikkisiga "Bo'sh turgan" obyektni biriktirish so'rovini yuboradi.
export const ASSIGNABLE_CATEGORY_CODES = [9, 10] as const;
export const ASSIGNABLE_CATEGORIES = CATEGORIES.filter((c) =>
  (ASSIGNABLE_CATEGORY_CODES as readonly number[]).includes(c.code),
);

// Obyektning effektiv kategoriyasi: integratsiya (1–4) > qo'lda (5–10).
// Ikkalasi ham null bo'lsa — 11 (Bo'sh turgan), DB'da "kategoriyasiz" holati yo'q
// (integrationCategoryCode'ga 11 hech qachon yozilmaydi, faqat shu yerda fallback sifatida).
export function effectiveCategory(
  integrationCode: number | null,
  manualCode: number | null,
): CategoryMeta | null {
  const code = integrationCode ?? manualCode ?? 11;
  return CATEGORY_BY_CODE.get(code) ?? null;
}
