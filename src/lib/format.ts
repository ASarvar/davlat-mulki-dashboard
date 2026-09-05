/**
 * Raqam formatlash — YAGONA joy (`lib/area.ts` naqshi).
 *
 * ⚠️ Ilgari `nf`/`km` rasmiy hisobot sahifasining ICHIDA lokal const edi. Endi ular
 * uch joyda kerak (hisobot, boshqaruv paneli, grafiklar) — takrorlansa ikki ekranda
 * bir xil son turlicha yaxlitlanib ko'rinardi.
 *
 * ⚠️ Hammasi "uz-UZ" lokalida: mingliklar ajratiladi, o'nlik vergul bilan.
 */

/** Mingliklar ajratilgan son. `digits` — o'nlik xonalar soni. */
export function nf(n: number, digits = 0): string {
  return n.toLocaleString("uz-UZ", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Maydon ming m² da (rasmiy hisobot shakli shunday). */
export function km(m2: number): string {
  return nf(m2 / 1000, 1);
}

/** Ulush foizda. Maxraj 0 bo'lsa 0 — bo'lishda NaN chiqmasin. */
export function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

/** Bir xonagacha aniqlikdagi ulush ("57,6%" kabi). */
export function pct1(n: number, d: number): string {
  return d > 0 ? nf((n / d) * 100, 1) : "0";
}

/**
 * Katta pul summasi — qiymat va birlik ALOHIDA qaytariladi, chunki KPI kartada
 * ular turli o'lchamda chiziladi ("38,9" katta, "mlrd so'm" kichik).
 */
export function money(n: number): { value: string; unit: string } {
  if (n >= 1e12) return { value: nf(n / 1e12, 1), unit: "trln so'm" };
  if (n >= 1e9) return { value: nf(n / 1e9, 1), unit: "mlrd so'm" };
  if (n >= 1e6) return { value: nf(n / 1e6, 1), unit: "mln so'm" };
  return { value: nf(n), unit: "so'm" };
}
