import type { ComponentType, SVGProps } from "react";
import {
  HandCoins,
  CircleCheckBig,
  Gavel,
  Tags,
  Gift,
  ScrollText,
  Hourglass,
  CircleX,
  MapPinOff,
  DoorClosed,
  SquareDashed,
  Shapes,
} from "lucide-react";

export type CategoryIcon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Kategoriya ikonkalari — `chartColors.ts` dagi `CATEGORY_COLOR` bilan JUFT.
 *
 * ⚠️ Kalitlar `lib/categories.ts` dagi kodlar bilan bir xil (kod 8 mavjud emas —
 * u yerda izohga olingan, shuning uchun bu yerda ham yo'q). Yangi kategoriya
 * qo'shilsa IKKALA jadvalga ham qator qo'shing, aks holda halqadagi rang bilan
 * kartadagi ikonka ajralib qoladi.
 *
 * Ikonka rangni TAKRORLAMAYDI, uni to'ldiradi: 11 va 12 oltinlari bir-biriga
 * juda yaqin va faqat rangga qarab ularni ajratib bo'lmasdi (`chartColors.ts`
 * izohidagi bir xil sabab) — ikonka o'sha farqni ko'zga ko'rinadigan qiladi.
 */
export const CATEGORY_ICON: Record<number, CategoryIcon> = {
  1: HandCoins, // Sotilgan — bo'lib to'lash sharti bilan
  2: CircleCheckBig, // Sotilgan
  3: Gavel, // Savdoda xususiylashtirish
  4: Tags, // Savdoda ijara
  5: Gift, // Tekin foydalanish
  6: ScrollText, // Ijara shartnomasi bor
  7: Hourglass, // Savdoga chiqarish jarayonida
  9: CircleX, // Yaroqsiz
  10: MapPinOff, // Chekka hudud
  11: DoorClosed, // Bo'sh turgan
  12: SquareDashed, // Bo'sh maydoni bor
};

/** Registrda yo'q kod uchun zaxira — karta ikonkasiz qolmasin. */
export const FALLBACK_ICON: CategoryIcon = Shapes;

export function categoryIcon(code: number): CategoryIcon {
  return CATEGORY_ICON[code] ?? FALLBACK_ICON;
}
