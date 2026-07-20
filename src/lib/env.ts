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
  API3_BASE_URL: z.string().url().optional(),
  API4_BASE_URL: z.string().url().optional(),
  API5_BASE_URL: z.string().url().optional(),
  API6_BASE_URL: z.string().url().optional(),
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
