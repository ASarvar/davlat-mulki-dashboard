import type { NextRequest } from "next/server";

/**
 * Mijoz IP'si — audit uchun.
 *
 * ⚠️ Ilova reverse-proxy (nginx) ortida ishlaydi, shuning uchun `X-Forwarded-For`
 * BIRINCHI qiymati olinadi: nginx unga zanjirni qo'shib boradi va eng chapdagi —
 * haqiqiy mijoz. Sarlavha yo'q bo'lsa `null` yoziladi, soxta qiymat emas.
 */
export function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}
