import { z } from "zod";

// Server-side env validatsiyasi. Yaroqsiz konfiguratsiyada ilova ishga tushmaydi.
const schema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url().optional(),

  UPLOAD_DIR: z.string().default("./data/uploads"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024),

  // Worker (pg-boss) sozlamalari.
  // batchSize kichik + poll katta bo'lsa, vaqtning ko'p qismi bo'sh kutishga ketadi
  // (o'lchov: 193 obyekt uchun ~20s ish, ~80s kutish). Shuning uchun batch kattaroq,
  // poll qisqaroq. batchSize'ni oshirganda Prisma connection pool'ini ham hisobga oling
  // (DATABASE_URL'ga ?connection_limit=... qo'shish mumkin).
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(25),
  WORKER_POLL_SECONDS: z.coerce.number().positive().default(1),

  // Tashqi API'lar
  // API 1 — token yo'q. So'rov: {API1_BASE_URL}/{API1_PATH}?inn={STIR}
  API1_BASE_URL: z.string().url().optional(),
  API1_PATH: z.string().default(""),
  // API 2 — token query parametr sifatida ketadi (?num=...&token=...)
  API2_BASE_URL: z.string().url().optional(),
  API2_PATH: z.string().default(""),
  API2_TOKEN: z.string().optional(),
  // API 3 va 4 — auksion zanjiri, ikkalasi ham BASIC AUTH (bir xil user/parol).
  // API 3: kadastr -> lot + order_id (POST). API 4: order_id -> to'liq auksion ma'lumoti.
  API3_BASE_URL: z.string().url().optional(),
  API4_BASE_URL: z.string().url().optional(),
  AUCTION_API_USER: z.string().optional(),
  AUCTION_API_PASSWORD: z.string().optional(),
  // So'rov parametrlari nomi — real API tasdiqlanmaguncha sozlanadigan qoldiramiz
  // (API 1 da javobdagi `inn` emas, `num` bo'lib chiqqan edi — taxminga tayanmaymiz).
  // Jonli tasdiqlangan: API 3 = POST body {cad_number}, API 4 = GET ?order=<order_id>
  API3_PARAM: z.string().default("cad_number"),
  API4_PARAM: z.string().default("order"),
  // API 5 — ijara shartnomalari (Basic auth, POST + kadastr)
  API5_BASE_URL: z.string().url().optional(),
  API5_USERNAME: z.string().optional(),
  API5_PASSWORD: z.string().optional(),
  // Jonli tasdiqlangan: API 5 POST body parametri `cadastre_number`
  API5_PARAM: z.string().default("cadastre_number"),

  // API 6 — faol IJARA LOTI (savdoda ijara kategoriyasini aniqlaydi).
  // Basic auth, POST body `cad_number` (API 5 dan farqli!).
  API6_BASE_URL: z.string().url().optional(),
  API6_USERNAME: z.string().optional(),
  API6_PASSWORD: z.string().optional(),
  API6_PARAM: z.string().default("cad_number"),

  API7_BASE_URL: z.string().url().optional(),
  API8_BASE_URL: z.string().url().optional(),
  API_STATUS_TOKEN: z.string().optional(),

  // Rate-limit / retry
  API_RATE_MAX: z.coerce.number().int().positive().default(10),
  API_RATE_DURATION_MS: z.coerce.number().int().positive().default(1000),
  API_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  API_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Env validatsiyasi muvaffaqiyatsiz:", parsed.error.flatten().fieldErrors);
  throw new Error("Yaroqsiz environment konfiguratsiyasi");
}

export const env = parsed.data;
