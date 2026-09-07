import { Prisma, type PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";
import { auctionDb, auctionDbConfigured } from "@/server/db/auctionDb";
import { parseCoordPair, type RawAuctionOrder } from "@/server/integrations/auctionOrders";

/**
 * Auksion buyurtmalarini TASHQI bazaga ham yozish (`orders` jadvali).
 *
 * ⚠️ Nima uchun bor: o'sha bazadan BOSHQA API'lar ma'lumot oladi, ya'ni uni
 * to'ldirish talab (foydalanuvchi, 2026-09-07). Bizning `AuctionOrder` jadvali
 * ham saqlanadi — ekrandagi ro'yxat/filtr/Excel o'sha yerdan o'qiydi.
 *
 * ⚠️ Ustunlar va qiymatlar `get-auc-order2.js` bilan AYNAN bir xil (59 ustun,
 * o'sha tartibda, o'sha sana formati). Sabab: o'sha jadvalni boshqa tizimlar
 * o'qiydi — biz uning shaklini o'zgartira olmaymiz va normalizatsiyani ham
 * "yaxshilay" olmaymiz, aks holda ular ko'radigan ma'lumot jimgina o'zgarardi.
 */

/**
 * Sana formati — skriptdagi `formatDateTime` ning AYNAN nusxasi.
 *
 * ⚠️ Bizning `parseApi4Date()` ISHLATILMAYDI: u `Date` qaytaradi, bu esa satr.
 * Tashqi jadvalning ustuni `text` bo'lsa `Date` boshqa ko'rinishda yozilib,
 * boshqa API'lar sanani o'qiy olmay qolardi. Satr esa `timestamp` ustunga ham,
 * `text` ustunga ham bir xil tushadi.
 */
function formatDateTime(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string" && v.includes(".")) {
    const parts = v.trim().split(" ");
    const d = parts[0].split(".");
    if (d.length === 3) return `${d[2]}-${d[1]}-${d[0]} ${parts[1] ?? "00:00:00"}`;
  }
  const dt = new Date(v as string);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

/**
 * Xom qiymatni JSON payload uchun tayyorlaydi.
 *
 * ⚠️ Obyekt (`scoring_params`) STRINGIFY QILINMAYDI. Skript uni `JSON.stringify`
 * qilardi, chunki `pg` orqali matn yuborilardi. Bu yerda esa qiymat
 * `jsonb_populate_recordset` ga tushadi: ustun `text` bo'lsa u obyektni o'zi JSON
 * matnga aylantiradi (natija bir xil), ustun `jsonb` bo'lsa obyekt to'g'ri
 * yoziladi. Oldindan stringify qilinsa `jsonb` ustunda IKKI marta kodlangan
 * satr paydo bo'lardi.
 */
function plain(v: unknown): unknown {
  return v === undefined ? null : v;
}

/** Postgres'ning raqamli tiplari — bularga tushadigan qiymat tozalanadi. */
const NUMERIC_TYPES = new Set([
  "smallint",
  "integer",
  "bigint",
  "numeric",
  "decimal",
  "real",
  "double precision",
]);
const INTEGER_TYPES = new Set(["smallint", "integer", "bigint"]);

/**
 * ⚠️ `boolean` ustunlar ALOHIDA o'giriladi. Jonli jadvalda (`project.orders`)
 * `with_discount` va `is_downgrade_auction` — `boolean`, API esa ularni RAQAM
 * qilib yuboradi (`0`; SIR 2026-09-07: 2 430 dan 1 539 tasida `0`, qolganlarida
 * `null`). `jsonb_populate_recordset` JSON raqamni boolean maydonga qo'ya
 * olmaydi ("expected json boolean") va butun to'plam yiqilardi.
 *
 * Skript bunga duch kelmagan: `pg` qiymatni tipsiz matn qilib yuborardi va
 * Postgres `'0'` ni `false` deb o'qirdi — shu sabab bu nomuvofiqlik ko'rinmay
 * kelgan.
 */
const BOOLEAN_TYPES = new Set(["boolean"]);

function toBool(v: unknown): boolean | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (s === "1" || s === "t" || s === "true" || s === "yes") return true;
  if (s === "0" || s === "f" || s === "false" || s === "no") return false;
  return null;
}

/**
 * Raqamli ustun uchun qiymatni tozalaydi — BIRINCHI sonni oladi.
 *
 * ⚠️ Nima uchun kerak (jonli o'lchov, SIR 2026-09-07): API ba'zan `lat` ga
 * IKKALA koordinatani birga soladi — `"40.303085, 68.415794"` (2 430 yozuvdan
 * 2 tasida). `lng` esa o'sha yozuvlarda to'g'ri, ya'ni birinchi son haqiqiy
 * kenglik. Tozalanmasa `double precision` ustunga yozib bo'lmaydi va BUTUN
 * to'plam (500 yozuv) yiqilardi.
 *
 * ⚠️ Bo'shliqlar oldin olib tashlanadi (`"1 200 000"` → `1200000`), o'nlik
 * ajratgich vergul bo'lsa nuqtaga o'giriladi.
 */
function toNumber(v: unknown, integer: boolean): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? (integer ? Math.trunc(v) : v) : null;
  const m = String(v).replace(/\s/g, "").match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return integer ? Math.trunc(n) : n;
}

/**
 * Tashqi jadvalning ustun tiplari (jadval nomi bo'yicha keshlanadi).
 *
 * ⚠️ Tiplar SHU YERDAN olinadi, kodda qattiq yozilmaydi: jadval boshqa tizimga
 * tegishli va uning `lat` ustuni `text` ham, `double precision` ham bo'lishi
 * mumkin. `text` bo'lsa qiymat XOM holida ketadi — skript nima yozgan bo'lsa,
 * boshqa API'lar o'shani ko'rishda davom etadi.
 */
const typeCache = new Map<string, Map<string, string>>();

async function columnTypes(db: PrismaClient, table: string): Promise<Map<string, string>> {
  const hit = typeCache.get(table);
  if (hit) return hit;
  const rows = await db.$queryRaw<{ column_name: string; data_type: string }[]>`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = ${table} AND table_schema = current_schema()`;
  const map = new Map(rows.map((r) => [r.column_name, r.data_type]));
  typeCache.set(table, map);
  return map;
}

/**
 * Tashqi `orders` jadvalining ustunlari — SKRIPTDAGI TARTIBDA.
 *
 * ⚠️ Birinchisi `order_id` bo'lishi SHART: u `ON CONFLICT` kaliti va quyida
 * `UPDATE SET` ro'yxatidan chiqarib tashlanadi.
 */
const COLUMNS: { col: string; get: (o: RawAuctionOrder) => unknown }[] = [
  { col: "order_id", get: (o) => o.order_id },
  { col: "old_order_id", get: (o) => o.old_order_id },
  { col: "new_order_id", get: (o) => o.new_order_id },
  { col: "order_statuses_id", get: (o) => o.order_statuses_id },
  { col: "name", get: (o) => o.name },
  { col: "region", get: (o) => o.region },
  { col: "region_soato", get: (o) => o.region_soato },
  { col: "area", get: (o) => o.area },
  { col: "area_soato", get: (o) => o.area_soato },
  { col: "group_name", get: (o) => o.group_name },
  { col: "category_name", get: (o) => o.category_name },
  { col: "category_id", get: (o) => o.category_id },
  { col: "joylashgan_manzil", get: (o) => o.joylashgan_manzil },
  { col: "bank_name", get: (o) => o.bank_name },
  { col: "bank_mfo", get: (o) => o.bank_mfo },
  { col: "bank_xr", get: (o) => o.bank_xr },
  { col: "order_status", get: (o) => o.order_status },
  { col: "lot_status", get: (o) => o.lot_status },
  { col: "lot_number", get: (o) => o.lot_number },
  { col: "start_price", get: (o) => o.start_price },
  { col: "paid_price", get: (o) => o.paid_price },
  { col: "center_fee", get: (o) => o.center_fee },
  { col: "sold_price", get: (o) => o.sold_price },
  { col: "full_price_paid", get: (o) => o.full_price_paid },
  { col: "with_discount", get: (o) => o.with_discount },
  { col: "lot_place_date", get: (o) => formatDateTime(o.lot_place_date) },
  { col: "auction_date", get: (o) => formatDateTime(o.auction_date) },
  { col: "winner_name", get: (o) => o.winner_name },
  { col: "winner_inn", get: (o) => o.winner_inn },
  { col: "winner_passport", get: (o) => o.winner_passport },
  { col: "winner_pinfl", get: (o) => o.winner_pinfl },
  { col: "winner_passport_date", get: (o) => formatDateTime(o.winner_passport_date) },
  { col: "winner_passport_issued_by", get: (o) => o.winner_passport_issued_by },
  { col: "winner_subject_type", get: (o) => o.winner_subject_type },
  { col: "winner_phone", get: (o) => o.winner_phone },
  { col: "winner_address", get: (o) => o.winner_address },
  { col: "score", get: (o) => o.score },
  // ⚠️ Skript buni `JSON.stringify` qiladi — `plain()` ham xuddi shunday qiladi.
  { col: "scoring_params", get: (o) => o.scoring_params },
  { col: "description", get: (o) => o.description },
  { col: "protocol_file_url", get: (o) => o.protocol_file_url },
  { col: "accept_state", get: (o) => o.accept_state },
  { col: "customer_description", get: (o) => o.customer_description },
  { col: "buyer_description", get: (o) => o.buyer_description },
  { col: "operator_description", get: (o) => o.operator_description },
  { col: "last_description", get: (o) => o.last_description },
  { col: "lot_statuses_id", get: (o) => o.lot_statuses_id },
  { col: "is_downgrade_auction", get: (o) => o.is_downgrade_auction },
  { col: "lot_accepted_time", get: (o) => formatDateTime(o.lot_accepted_time) },
  { col: "customer_name", get: (o) => o.customer_name },
  { col: "customer_inn", get: (o) => o.customer_inn },
  { col: "customer_soato", get: (o) => o.customer_soato },
  { col: "customer_licshet", get: (o) => o.customer_licshet },
  { col: "term_payment", get: (o) => o.term_payment },
  { col: "term_month", get: (o) => o.term_month },
  { col: "prop_set", get: (o) => o.prop_set },
  { col: "lat", get: (o) => o.lat },
  { col: "lng", get: (o) => o.lng },
  { col: "first_auction_date", get: (o) => formatDateTime(o.first_auction_date) },
  { col: "first_lot_place_date", get: (o) => formatDateTime(o.first_lot_place_date) },
];

/** Yozib boriladigan ustunlar — diagnostika/sinov uchun. */
export const EXTERNAL_COLUMN_NAMES = COLUMNS.map((c) => c.col);

/**
 * Bitta so'rovdagi yozuvlar soni.
 *
 * ⚠️ Parametr chegarasi bu yerda MUHIM EMAS — butun to'plam BITTA `jsonb`
 * parametr bo'lib ketadi. Chunk faqat xotira va bitta tranzaksiyaning hajmi
 * uchun. Skript har yozuv uchun alohida `BEGIN`/`COMMIT` qilardi (68 000
 * tranzaksiya); bu yerda 500 tasi bitta so'rovda ketadi.
 */
const CHUNK = 500;

/** ⚠️ Jadval nomi SQL ga XOM qo'shiladi — identifikatorni parametrlab bo'lmaydi. */
function tableName(): string {
  const t = env.AUCTION_ORDERS_TABLE;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) {
    throw new Error(`AUCTION_ORDERS_TABLE yaroqsiz: faqat harf/raqam/pastki chiziq`);
  }
  return t;
}

export { auctionDbConfigured };

/**
 * Yozuvlarni tashqi bazaga upsert qiladi va yozilgan sonni qaytaradi.
 * Tashqi baza sozlanmagan bo'lsa — `0`, xato emas.
 *
 * ⚠️ Bitta to'plamda BIR XIL `order_id` ikki marta uchrasa Postgres
 * "ON CONFLICT DO UPDATE command cannot affect row a second time" xatosini
 * beradi (skriptda bu bo'lmagan — u har yozuvni alohida yuborardi). Shuning
 * uchun oldin dublikat tashlanadi, OXIRGISI saqlanadi.
 */
export interface ExternalPushResult {
  saved: number;
  /** Tashqi jadval qabul qilmagan yozuvlar (bittalab urinishdan keyin). */
  failed: number;
  /** Birinchi xato xabari. */
  error?: string;
}

export async function pushOrdersExternal(orders: RawAuctionOrder[]): Promise<ExternalPushResult> {
  const db = auctionDb();
  if (!db || orders.length === 0) return { saved: 0, failed: 0 };

  // ⚠️ Dublikat `order_id` tashlanadi (OXIRGISI qoladi): bitta `ON CONFLICT`
  // so'rovi bir qatorga ikki marta tegib bo'lmaydi.
  const byId = new Map<number, RawAuctionOrder>();
  for (const o of orders) {
    const id = Number(o.order_id);
    if (Number.isInteger(id)) byId.set(id, o);
  }
  const rows = [...byId.values()];
  if (rows.length === 0) return { saved: 0, failed: 0 };

  const name = tableName();
  const types = await columnTypes(db, name);
  const table = Prisma.raw(`"${name}"`);
  const cols = Prisma.raw(COLUMNS.map((c) => `"${c.col}"`).join(", "));
  const updates = Prisma.raw(
    COLUMNS.slice(1)
      .map((c) => `"${c.col}" = EXCLUDED."${c.col}"`)
      .join(", "),
  );

  const toRow = (o: RawAuctionOrder) => {
    // ⚠️ `lat`/`lng` JUFTLIK sifatida o'qiladi — `toNumber` har biridan birinchi
    // sonni olardi, ya'ni `lng: "40.30, 68.41"` da uzunlik o'rniga kenglik
    // yozilardi. Faqat raqamli ustunda qo'llanadi; `text` ustunda xom qiymat.
    const coords = parseCoordPair(o.lat, o.lng);
    return Object.fromEntries(
      COLUMNS.map((c) => {
        const t = types.get(c.col);
        const v = plain(c.get(o));
        if (!t) return [c.col, v];
        if (BOOLEAN_TYPES.has(t)) return [c.col, toBool(v)];
        // Matnli ustunda qiymat XOM ketadi — skript nima yozgan bo'lsa o'sha
        // (jonli jadvalda `lat`/`lng` aynan `text`).
        if (!NUMERIC_TYPES.has(t)) return [c.col, v];
        if (c.col === "lat") return [c.col, coords.lat];
        if (c.col === "lng") return [c.col, coords.lng];
        return [c.col, toNumber(v, INTEGER_TYPES.has(t))];
      }),
    );
  };

  // ⚠️ `jsonb_populate_recordset(NULL::<jadval>, …)` — ustun TIPLARI jadvalning
  // O'ZIDAN olinadi. Oddiy `VALUES (…)` ishlamaydi: Prisma har parametrni ANIQ
  // `text` tipi bilan yuboradi va Postgres uni ustun tipiga o'zi keltirmaydi
  // (`column "auction_date" is of type timestamp … but expression is of type
  // text` — jonli sinov, 2026-09-07). Bu yo'l tashqi jadval sxemasini oldindan
  // bilishni talab qilmaydi.
  //
  // ⚠️ `SELECT *` EMAS, ustunlar ANIQ sanaladi: aks holda ro'yxatimizda yo'q
  // ustunlar (masalan `created_at DEFAULT now()`) yangi qatorda NULL bo'lib
  // yozilib, o'sha jadvalni ishlatadigan boshqa tizimlarni buzardi.
  //
  // ⚠️ Ustun/jadval nomlari kod ichidagi O'ZGARMAS ro'yxatdan; API javobidagi
  // matn faqat BITTA `jsonb` parametr ichida ketadi, SQL ga hech qachon
  // qo'shilmaydi.
  const write = (batch: RawAuctionOrder[]) =>
    db.$executeRaw(
      Prisma.sql`INSERT INTO ${table} (${cols})
                 SELECT ${cols} FROM jsonb_populate_recordset(NULL::${table}, ${JSON.stringify(batch.map(toRow))}::jsonb)
                 ON CONFLICT (order_id) DO UPDATE SET ${updates}`,
    );

  let saved = 0;
  let failed = 0;
  let error: string | undefined;
  /**
   * ⚠️ Nosozlik TIZIMLI (ulanish uzildi, jadval yo'q) — bittalab urinish
   * ma'nosiz. Busiz to'liq sinxronizatsiyada 68 000 ta befoyda so'rov ketardi
   * va har biri ulanish taymautini kutardi.
   */
  let systemic = false;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    try {
      await write(chunk);
      saved += chunk.length;
    } catch (e) {
      error ??= e instanceof Error ? e.message : String(e);
      if (systemic) {
        failed += chunk.length;
        continue;
      }

      // ⚠️ BITTALAB qayta urinish. Jonli sinovda (SIR) bitta yaroqsiz `lat`
      // qiymati 500 yozuvlik to'plamni butunlay yiqitgan va 2 430 dan 400 tasi
      // yo'qolgan edi. Endi faqat AYNAN buzuq yozuv tushib qoladi.
      let streak = 0;
      for (const [j, row] of chunk.entries()) {
        try {
          await write([row]);
          saved++;
          streak = 0;
        } catch {
          failed++;
          // Ketma-ket 3 ta xato — bu ma'lumot emas, tizimli nosozlik.
          if (++streak >= 3) {
            systemic = true;
            failed += chunk.length - j - 1;
            break;
          }
        }
      }
    }
  }
  return { saved, failed, error };
}
