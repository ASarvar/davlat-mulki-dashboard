-- Balansdan chiqarilgan obyektlar (2026-08-06).
--
-- API 1 tashkilotning JORIY kadastr ro'yxatini qaytaradi, lekin sinxronizatsiya
-- shu paytgacha faqat QO'SHAR/YANGILAR edi. Natijada ro'yxatdan tushib qolgan
-- (boshqa STIRga o'tkazilgan) obyekt bazada abadiy qolib, dashboard sonini
-- API'dagidan katta qilib ko'rsatardi — jonli misol: Andijon, API 157 ta,
-- baza 159 ta.
--
-- Endi `syncSource.ts` har sinxronizatsiyada solishtiradi va bunday obyektni
-- shu bayroq bilan belgilaydi. O'CHIRILMAYDI — tarix saqlanishi kerak
-- (foydalanuvchi qarori). Dashboard hisoblariga kirmaydi, obyektlar ro'yxatida
-- faqat ADMIN "Balansdan chiqarilgan" kategoriyasini tanlaganda ko'rinadi.
--
-- ⚠️ Migratsiyaning O'ZI hech qanday obyektni belgilamaydi (default = false).
-- Mavjud obyektlar keyingi to'liq sinxronizatsiyada avtomatik aniqlanadi.

ALTER TABLE "Property" ADD COLUMN "removedFromBalance" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Property" ADD COLUMN "removedAt"          TIMESTAMP(3);
-- Yangi egasi — API 2 `subjects[0]` dan. Aniqlanmasligi mumkin (API javob bermasa).
ALTER TABLE "Property" ADD COLUMN "removedToStir"      TEXT;
ALTER TABLE "Property" ADD COLUMN "removedToName"      TEXT;

-- Bu shart deyarli HAR BIR ro'yxat/statistika so'roviga qo'shiladi.
CREATE INDEX "Property_removedFromBalance_idx" ON "Property"("removedFromBalance");
