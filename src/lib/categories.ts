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

export const CATEGORIES: CategoryMeta[] = [
  { code: 1, nameUz: "Bo'lib to'lash sharti bilan sotilgan", short: "Bo'lib to'lash sotuv", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 2, nameUz: "Sotilgan - kadastr hujjati rasmiylashtirilmagan", short: "Sotilgan (hujjatsiz)", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 3, nameUz: "Beg'araz foydalanishga berilgan", short: "Beg'araz foydalanish", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 4, nameUz: "Xususiylashtirish va ijaraga berish uchun savdoda turgan", short: "Savdoda (xus./ijara)", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 5, nameUz: "Savdoga chiqarish jarayonida", short: "Savdoga chiqmoqda", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  { code: 6, nameUz: "Savdosi to'xtatilgan", short: "Savdo to'xtatilgan", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  { code: 7, nameUz: "Foydalanishga yaroqsiz holatda", short: "Yaroqsiz holat", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  { code: 8, nameUz: "Chekka hududlarda joylashgan", short: "Chekka hudud", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  { code: 9, nameUz: "Bo'sh turgan", short: "Bo'sh turgan", source: "MANUAL", excludeInefficient: false, requiresDocument: true },
  { code: 10, nameUz: "Bo'sh turgan maydoni mavjud", short: "Bo'sh maydon bor", source: "MANUAL", excludeInefficient: false, requiresDocument: true },
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
