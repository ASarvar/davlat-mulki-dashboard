import type { FallbackResult } from "@/server/integrations/withCadFallback";
import type { StatusApiSource } from "@/server/integrations/types";

export interface StatusResultBySource extends FallbackResult {
  source: StatusApiSource;
}

// 1–8 kategoriyalar samaradorlik hisobidan chiqariladi (excludeInefficient=true).
// Bu ro'yxat Category jadvali bilan mos (seed) — tezkorlik uchun konstanta.
export const EXCLUDED_CATEGORY_CODES: ReadonlySet<number> = new Set([1, 2, 3, 4, 5, 6, 7, 8]);

// API 3–8 natijalaridan integratsiya kategoriyasini (1–4) aniqlaydi.
// Bir nechta tekshiruv ijobiy bo'lsa — eng kichik kod (eng yuqori ustuvorlik) tanlanadi.
export function deriveIntegrationCategory(results: StatusResultBySource[]): number | null {
  const codes = results
    .filter((r) => r.found && r.impliesCategoryCode != null)
    .map((r) => r.impliesCategoryCode as number);
  if (codes.length === 0) return null;
  return Math.min(...codes);
}

// Obyekt samarasiz foydalanilayotganmi?
// Ustuvorlik: integratsiya (1–4) > qo'lda (5–10). 1–8 => samarali (chiqariladi),
// 9–10 yoki kategoriyasiz => SAMARASIZ.
export function computeIsInefficient(
  integrationCategoryCode: number | null,
  manualCategoryCode: number | null,
): boolean {
  const effective = integrationCategoryCode ?? manualCategoryCode;
  if (effective == null) return true; // hali kategoriyalanmagan => samarasiz nomzod
  return !EXCLUDED_CATEGORY_CODES.has(effective);
}
