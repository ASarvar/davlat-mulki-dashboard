import type { StatusApiConfig } from "./config";
import { httpJson, NotFoundError } from "./http";
import type { StatusApiCall, StatusCheckResult } from "./types";

interface StatusResponse {
  found?: boolean;
  status?: string | null;
  [k: string]: unknown;
}

// Bitta holat-API (3–8) uchun chaqiruv funksiyasini yasaydi.
// Berilgan kadastr (yangi YOKI eski) bo'yicha holatni tekshiradi.
export function makeStatusApiCall(cfg: StatusApiConfig): StatusApiCall {
  return async (cadNumber: string): Promise<StatusCheckResult> => {
    if (!cfg.baseUrl) throw new Error(`${cfg.source}_BASE_URL sozlanmagan`);
    try {
      const res = await httpJson<StatusResponse>({
        baseUrl: cfg.baseUrl,
        path: `check/${encodeURIComponent(cadNumber)}`,
        token: cfg.token,
        rateKey: cfg.source,
      });
      // "found" aniq false bo'lsa yoki status yo'q bo'lsa — topilmadi deb hisoblaymiz.
      const found = res.found !== false && Boolean(res.status ?? res.found);
      return {
        found,
        status: res.status ?? null,
        impliesCategoryCode: found ? cfg.impliesCategoryCode : null,
        raw: res,
      };
    } catch (err) {
      if (err instanceof NotFoundError) {
        return { found: false, status: null, impliesCategoryCode: null, raw: null };
      }
      throw err;
    }
  };
}
