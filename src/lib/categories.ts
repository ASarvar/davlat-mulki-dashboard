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
  { code: 8, nameUz: "Savdosi to'xtatilgan", short: "Savdo to'xtatilgan", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  { code: 9, nameUz: "Foydalanishga yaroqsiz holatda", short: "Yaroqsiz holat", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  { code: 10, nameUz: "Chekka hududlarda joylashgan", short: "Chekka hudud", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  { code: 11, nameUz: "Bo'sh turgan", short: "Bo'sh turgan", source: "MANUAL", excludeInefficient: false, requiresDocument: true },
  { code: 12, nameUz: "Bo'sh turgan maydoni mavjud", short: "Bo'sh maydon bor", source: "MANUAL", excludeInefficient: false, requiresDocument: true },
];

export const CATEGORY_BY_CODE = new Map<number, CategoryMeta>(CATEGORIES.map((c) => [c.code, c]));
export const MANUAL_CATEGORIES = CATEGORIES.filter((c) => c.source === "MANUAL");

// Obyektning effektiv kategoriyasi: integratsiya (1–4) > qo'lda (5–10).
export function effectiveCategory(
  integrationCode: number | null,
  manualCode: number | null,
): CategoryMeta | null {
  const code = integrationCode ?? manualCode;
  return code != null ? (CATEGORY_BY_CODE.get(code) ?? null) : null;
}
