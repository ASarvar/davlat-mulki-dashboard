import { z } from "zod";
import { config as loadDotenv } from "dotenv";

/**
 * ⚠️ `.env.auction` — auksion buyurtmalari API'sining ALOHIDA fayli (foydalanuvchi
 * shunday yuritadi, 2026-09-07). Uni HECH KIM avtomatik o'qimaydi: Next.js faqat
 * `.env`/`.env.local`/`.env.production` ni, worker esa `dotenv/config` orqali `.env` ni
 * yuklaydi. Shuning uchun bu yerda aniq yuklanadi — zod tekshiruvidan OLDIN.
 *
 * ⚠️ `override: false` (dotenv standarti) — ya'ni allaqachon o'rnatilgan qiymat
 * (`.env`, `.env.production` yoki Docker `environment:`) USTUN turadi. Serverda
 * alohida fayl yaratmasdan, kalitlarni to'g'ridan-to'g'ri `.env.production` ga
 * yozish ham ishlaydi.
 *
 * ⚠️ Fayl yo'q bo'lsa — xato EMAS: auksion bo'limi ixtiyoriy, sozlanmagan bo'lsa
 * sahifa "sozlanmagan" ogohlantirishini ko'rsatadi.
 */
loadDotenv({ path: ".env.auction", quiet: true });

// ⚠️ Foydalanuvchining faylida kalitlar UMUMIY nomlar bilan (`API_URL`,
// `REGIONS_CREDENTIALS`) — mustaqil skriptdan qolgan. Bizning env fazomizda esa
// `API_URL` juda xavfli nom (API1_BASE_URL … API6_BASE_URL yonida ma'nosiz), shuning
// uchun ular shu yerda AUCTION_ORDERS_* ga ko'chiriladi. Foydalanuvchi faylini
// o'zgartirmasdan ishlayveradi; yangi nomlarni bevosita bergan bo'lsa — o'sha ustun.
if (!process.env.AUCTION_ORDERS_URL && process.env.API_URL) {
  process.env.AUCTION_ORDERS_URL = process.env.API_URL;
}
if (!process.env.AUCTION_ORDERS_CREDENTIALS && process.env.REGIONS_CREDENTIALS) {
  process.env.AUCTION_ORDERS_CREDENTIALS = process.env.REGIONS_CREDENTIALS;
}

// Server-side env validatsiyasi. Yaroqsiz konfiguratsiyada ilova ishga tushmaydi.
const schema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url().optional(),

  UPLOAD_DIR: z.string().default("./data/uploads"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(15 * 1024 * 1024),

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

  // ── Kadastr ma'lumotlari (`cad_data`) — API 2 ning O'RNINI bosadi (2026-09-06) ──
  // GET {CADDATA_BASE_URL}?tin={STIR}&cad_number={KADASTR}, Basic auth.
  // ⚠️ API 2 dan farqli o'laroq STIR ham MAJBURIY — kadastrning o'zi yetarli emas.
  // ⚠️ Sozlanmagan bo'lsa tizim eski API 2 ga qaytadi (`isCadDataConfigured()`).
  CADDATA_BASE_URL: z.string().url().optional(),
  CADDATA_USERNAME: z.string().optional(),
  CADDATA_PASSWORD: z.string().optional(),

  API7_BASE_URL: z.string().url().optional(),
  API8_BASE_URL: z.string().url().optional(),
  API_STATUS_TOKEN: z.string().optional(),

  // ── Kommunal xizmatlar: suv / gaz / elektr ──
  // Uchalasi ham GET `?cad_number=...` + Basic auth (API 3/4 bilan bir xil server va
  // odatda bir xil login/parol, lekin alohida sozlanadi — kelajakda ajralishi mumkin).
  //
  // ⚠️ Uchalasi ham "topilmadi"ni HTTP 404 emas, **HTTP 200 + body ichida** qaytaradi,
  // va uchalasining javob tuzilmasi BUTUNLAY BOSHQACHA (uch xil vendor):
  //   suv    -> topildi: {pid, fio, saldo}       | topilmadi: {err_code: -425}
  //   gaz    -> topildi: {abonent: {...}}        | topilmadi: {abonent: null, result_code: 73}
  //   elektr -> topildi: {abonent:{customerCode:[...]}} | topilmadi: o'sha, massivlar bo'sh
  // Har biriga alohida "topildi" prediktati kerak — `integrations/utilities.ts` ga qarang.
  WATER_API_BASE_URL: z.string().url().optional(),
  GAS_API_BASE_URL: z.string().url().optional(),
  ELECTRIC_API_BASE_URL: z.string().url().optional(),
  /**
   * Elektr — 2-BOSQICH (`het_data_detail`). 1-bosqich (`het_data`) faqat abonent
   * KODLARINI beradi, ism/sarf/to'lov bermaydi; tafsilot shu ikkinchi chaqiruvdan
   * keladi (API 3 -> API 4 auksion zanjiri bilan bir xil naqsh).
   *
   * ⚠️ Parametrlari `cad_number` EMAS — jonli tasdiqlangan (2026-08-19):
   *   `?customer_type={customerType[i]}&soato={soato[i]}&licshet={customerCode[i]}`
   * ya'ni 1-bosqichdagi UCH massiv INDEKS BO'YICHA tekislangan va har bir indeks
   * bitta abonentni bildiradi. Shuning uchun `UTILITY_API_PARAM` bu yerga TEGISHLI EMAS.
   * Auth — 1-bosqich bilan bir xil Basic (`UTILITY_API_USER/PASSWORD`).
   */
  ELECTRIC_DETAIL_API_BASE_URL: z.string().url().optional(),
  UTILITY_API_USER: z.string().optional(),
  UTILITY_API_PASSWORD: z.string().optional(),
  // Jonli tasdiqlangan: uchalasida ham query parametri `cad_number`.
  UTILITY_API_PARAM: z.string().default("cad_number"),
  // Gaz uchun "sarflayapti" mezoni: oxirgi shuncha oyda `gas_consume > 0` bo'lsa.
  GAS_CONSUMING_MONTHS: z.coerce.number().int().positive().default(6),
  /**
   * Elektr uchun "sarflayapti" mezoni: oxirgi shuncha oyda `CURRENT_EE_KWH > 0`.
   * Gazdan ALOHIDA sozlanadi, chunki elektr javobi ~11 oylik `SALDO_PERIOD` beradi va
   * elektrda hisoblagichsiz abonent deyarli uchramaydi (gazdagi "norma bo'yicha
   * hisoblash" muammosi elektrda yo'q) — ya'ni mezon qat'iyroq bo'lishi mumkin.
   */
  ELECTRIC_CONSUMING_MONTHS: z.coerce.number().int().positive().default(6),
  // "Yaqinda to'lov bo'lgan" mezoni (dashboard ustuni va `?utility=recentlyPaid` filtri):
  // gaz YOKI elektrning oxirgi to'lovi shuncha oy ichida bo'lsa. Hisob-kitob
  // (`gasBilled`) abonent to'lamasa ham davom etadi, TO'LOV esa obyekt haqiqatan
  // ishlatilayotganini bildiradi.
  UTILITY_RECENT_PAYMENT_MONTHS: z.coerce.number().int().positive().default(3),

  // ── Xarita foni (tile) ──
  // ⚠️ Standarti OSM: ichki tarmoqda tashqi internet bo'lmasligi mumkin, shuning uchun
  // manzil KODSIZ almashtiriladigan qilingan (ichki geoserverga o'tish uchun).
  // Fon yuklanmasa xarita bo'sh qolmaydi — nuqtalar baribir chiziladi va ogohlantirish
  // ko'rsatiladi (`tileerror`).
  MAP_TILE_URL: z.string().url().default("https://tile.openstreetmap.org/{z}/{x}/{y}.png"),
  MAP_TILE_ATTRIBUTION: z.string().default("© OpenStreetMap"),

  // ── Ijara imtiyozi (ПҚ-3782): Soliq + TIEK ──
  // Uchalasi ham kommunal API'lar bilan BIR XIL shlyuzda (10.190.5.2:8675/markaz) va
  // odatda bir xil Basic juftlikda, lekin alohida sozlanadi (kelajakda ajralishi mumkin).
  //   comp_workers  -> yuridik shaxs xodimlari, GET ?tin&year&period&page&size
  //   yatt_workers  -> YATT shartnomalari, GET ?page&size (⚠️ tadbirkor bo'yicha FILTRLAMAYDI)
  //   minzdrav_pas  -> nogironlik reyestri, GET ?pinfl
  IMTIYOZ_COMP_WORKERS_URL: z.string().url().optional(),
  IMTIYOZ_YATT_WORKERS_URL: z.string().url().optional(),
  IMTIYOZ_TIEK_URL: z.string().url().optional(),
  IMTIYOZ_API_USER: z.string().optional(),
  IMTIYOZ_API_PASSWORD: z.string().optional(),

  /**
   * Nogironlik reyestriga bir vaqtda nechta parallel so'rov.
   * ⚠️ Rate-limit qo'yilmagan (`rateKey` yo'q) — aynan shu son yagona throttle.
   * Oshirsangiz shlyuz 400 xodimli korxonada 500 qaytara boshlaydi.
   */
  IMTIYOZ_TIEK_CONCURRENCY: z.coerce.number().int().positive().default(15),
  /** Imtiyoz uchun kerakli ulush (0.3 = 30%, ПҚ-3782). */
  IMTIYOZ_REQUIRED_RATIO: z.coerce.number().positive().max(1).default(0.3),
  /** Nogironlik holati kunlar davomida o'zgarmaydi. */
  IMTIYOZ_TIEK_CACHE_HOURS: z.coerce.number().int().positive().default(24),
  /** Yakuniy natija keshi (faqat aniq xulosalar uchun). */
  IMTIYOZ_RESULT_CACHE_MINUTES: z.coerce.number().int().positive().default(60),
  /** YATT sahifasi hajmi — server kichikroq cheklov qo'ysa avtomatik moslashadi. */
  IMTIYOZ_YATT_PAGE_SIZE: z.coerce.number().int().positive().default(500),
  /**
   * YATT sinxronlash parallelligi. Katta OFFSET'li sahifalarda shlyuz 500 qaytarmasligi
   * uchun ataylab kichik.
   */
  IMTIYOZ_YATT_CONCURRENCY: z.coerce.number().int().positive().default(5),
  /**
   * Indeks shu muddatdan yosh bo'lsa, navbatdagi jadval ishga tushishi O'TKAZIB
   * YUBORILADI. To'liqsiz sinxronlashdan keyin esa har safar qayta uriniladi
   * (6 soatlik cron). 24 soatlik tsikl + 2 soat xavfsizlik marjasi.
   */
  IMTIYOZ_YATT_FRESH_HOURS: z.coerce.number().int().positive().default(22),

  // ── Auksion buyurtmalari (get-order) ──
  // POST {AUCTION_ORDERS_URL} body {username, password, language, page} → sahifalangan
  // `orders` massivi. Har viloyatning O'Z akkaunti bor, shuning uchun Basic auth emas —
  // login/parol so'rov tanasida ketadi.
  AUCTION_ORDERS_URL: z.string().url().optional(),
  /**
   * 14 viloyat akkaunti: `[{"name":"QR","username":"…","password":"…"}, …]`.
   * ⚠️ JSON SATR bo'lib keladi — `auctionCredentials()` uni tekshirib ochadi.
   * Bu yerda `.transform()` qilinmaydi: yaroqsiz JSON butun ilovani ishga
   * tushmaydigan qilib qo'yardi, holbuki auksion bo'limi ixtiyoriy.
   */
  AUCTION_ORDERS_CREDENTIALS: z.string().optional(),
  /**
   * Bitta sahifadagi yozuvlar (`per_page`).
   * ⚠️ Server 50 da CHEGARALAYDI — 100/200/500 so'ralganda ham 50 qaytaradi
   * (jonli o'lchov, 2026-09-07). Kattaroq qiymat berish foydasiz, kichikroq esa
   * so'rovlar sonini keraksiz oshiradi.
   */
  AUCTION_ORDERS_PAGE_SIZE: z.coerce.number().int().positive().max(50).default(50),
  /**
   * Bir vaqtda nechta sahifa yuklanadi (bitta akkaunt ichida).
   * ⚠️ O'lchov (2026-09-07): 1 → 1.8 sahifa/s, 3 → 1.8, 6 → 3.5, xato 0 ta.
   * Ya'ni foyda bor, lekin chiziqli emas — server o'zi qisman navbatga qo'yadi.
   * 4 — ehtiyotkor standart; kommunal API'lardagi saboq (bitta 500 butun
   * tekshiruvni yiqitgan) shlyuzni bosmaslikni talab qiladi.
   */
  AUCTION_ORDERS_CONCURRENCY: z.coerce.number().int().positive().max(10).default(4),
  /** Sahifalar to'plamlari orasidagi pauza (ms). */
  AUCTION_ORDERS_DELAY_MS: z.coerce.number().int().nonnegative().default(100),
  /** Sahifa uchun urinishlar soni (backoff bilan) — xato butun akkauntni to'xtatadi. */
  AUCTION_ORDERS_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),

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
