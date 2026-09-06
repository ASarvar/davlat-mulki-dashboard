import { z } from "zod";
import { env } from "@/lib/env";

/**
 * Auksion buyurtmalari — `get-order` API mijozi.
 *
 * ⚠️ Mavjud API 3/4/6 dan PRINSIPIAL farqi: ular kadastr bo'yicha BITTA obyektni
 * so'raydi, bu esa akkaunt (viloyat) bo'yicha BARCHA buyurtmalarni sahifalab beradi.
 * Ya'ni bu qidiruv emas, TO'LIQ TO'KISH (2026-09-07 o'lchovi: 14 akkaunt, 68 196
 * buyurtma, 3 417 sahifa).
 *
 * ⚠️ Autentifikatsiya Basic EMAS — login/parol so'rov TANASIDA ketadi va har
 * viloyatning o'z juftligi bor. Shuning uchun `http.ts` dagi umumiy Basic yordamchisi
 * bu yerda ishlamaydi.
 */

/** Bitta viloyat akkaunti. `name` — qisqartma (QR, AND, TOSH-SH …). */
export interface AuctionCredential {
  name: string;
  username: string;
  password: string;
}

const credentialSchema = z.array(
  z.object({ name: z.string().min(1), username: z.string().min(1), password: z.string().min(1) }),
);

/**
 * Akkauntlar ro'yxati. Sozlanmagan yoki JSON buzuq bo'lsa — **bo'sh massiv**, xato emas:
 * auksion bo'limi ixtiyoriy va uning nosozligi butun ilovani yiqitmasligi kerak.
 *
 * ⚠️ Xato xabariga JSON qiymati QO'SHILMAYDI — u 14 ta login/paroldan iborat.
 */
export function auctionCredentials(): AuctionCredential[] {
  const raw = env.AUCTION_ORDERS_CREDENTIALS;
  if (!raw) return [];
  try {
    const parsed = credentialSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error("AUCTION_ORDERS_CREDENTIALS: kutilgan shakl emas ([{name,username,password}])");
      return [];
    }
    return parsed.data;
  } catch {
    console.error("AUCTION_ORDERS_CREDENTIALS: yaroqsiz JSON");
    return [];
  }
}

/** Bo'lim ishlashi uchun ikkalasi ham kerak. */
export function auctionConfigured(): boolean {
  return Boolean(env.AUCTION_ORDERS_URL) && auctionCredentials().length > 0;
}

/** API javobidagi bitta buyurtma — barcha maydonlar ixtiyoriy (real javobda ko'pi `null`). */
export type RawAuctionOrder = Record<string, unknown> & { order_id?: number };

export interface OrderPage {
  /** Jami buyurtmalar (akkaunt bo'yicha). */
  total: number;
  /** Jami sahifalar. */
  pages: number;
  orders: RawAuctionOrder[];
}

/**
 * Bitta sahifani oladi.
 *
 * ⚠️ `result_code !== 0` — HTTP 200 bilan keladigan MANTIQIY xato (API 2 ning
 * `code: 90000` tuzog'i bilan bir xil naqsh). Shuning uchun `res.ok` ni tekshirish
 * yetarli emas.
 */
export async function fetchOrderPage(cred: AuctionCredential, page: number): Promise<OrderPage> {
  const url = env.AUCTION_ORDERS_URL;
  if (!url) throw new Error("AUCTION_ORDERS_URL sozlanmagan");

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: cred.username,
      password: cred.password,
      language: "uz",
      page,
    }),
    signal: AbortSignal.timeout(env.API_TIMEOUT_MS * 2),
  });

  if (!res.ok) throw new Error(`get-order HTTP ${res.status} (${cred.name}, sahifa ${page})`);

  const data = (await res.json()) as {
    result_code?: number;
    result_msg?: string;
    total?: number;
    pages?: number;
    orders?: RawAuctionOrder[];
  };

  if (data.result_code !== 0) {
    // ⚠️ `result_msg` API'dan keladi va parolni O'Z ICHIGA OLMAYDI, lekin akkaunt
    // nomidan boshqa hech narsa qo'shilmaydi — login xatosida ham sir chiqmasin.
    throw new Error(`get-order xatosi (${cred.name}): ${data.result_msg ?? data.result_code}`);
  }

  return {
    total: data.total ?? 0,
    pages: data.pages ?? 1,
    orders: data.orders ?? [],
  };
}
