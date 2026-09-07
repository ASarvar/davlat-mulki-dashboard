import { PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";

/**
 * TASHQI auksion bazasiga ulanish (`AUCTION_DATABASE_URL`).
 *
 * ⚠️ Nima uchun ikkinchi `PrismaClient`, `pg` EMAS: yangi bog'liqlik qo'shish
 * `package-lock.json` ni LINUX'da qayta yaratishni talab qilardi (CLAUDE.md).
 * Prisma 5.2 dan beri `datasourceUrl` konstruktorda beriladi, ya'ni bir xil
 * generatsiya qilingan mijoz istalgan bazaga ulanadi.
 *
 * ⚠️ Bu mijoz FAQAT xom SQL uchun: tashqi jadval bizning `schema.prisma` da yo'q
 * va bo'lmasligi ham kerak — u boshqa tizimga tegishli, migratsiyasini biz
 * boshqarmaymiz.
 *
 * ⚠️ Sozlanmagan bo'lsa `null` qaytadi — chaqiruvchi jim o'tkazib yuboradi.
 */
const globalForAuctionDb = globalThis as unknown as { auctionDb?: PrismaClient };

export function auctionDbConfigured(): boolean {
  return Boolean(env.AUCTION_DATABASE_URL);
}

export function auctionDb(): PrismaClient | null {
  const url = env.AUCTION_DATABASE_URL;
  if (!url) return null;

  if (!globalForAuctionDb.auctionDb) {
    globalForAuctionDb.auctionDb = new PrismaClient({
      datasourceUrl: url,
      // ⚠️ `query` log YO'Q: SQL'da g'olibning passport/JSHSHIR qiymatlari
      // parametr sifatida ketadi va log'ga tushib qolardi.
      log: ["error"],
    });
  }
  // ⚠️ Global keshlash production'da HAM saqlanadi (asosiy `prisma.ts` dan farqli):
  // worker uzoq ishlaydigan jarayon, har sinxronizatsiyada yangi pool ochish
  // tashqi bazada ulanishlar to'planib qolishiga olib kelardi.
  return globalForAuctionDb.auctionDb;
}
