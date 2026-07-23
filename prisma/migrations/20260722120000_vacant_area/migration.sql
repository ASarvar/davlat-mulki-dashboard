-- Bo'sh maydon = foydali maydon − ijaraga berilgan (manfiy bo'lsa 0).
-- Ustun sifatida saqlanadi, chunki Prisma ikki ustunni o'zaro solishtira olmaydi
-- (filtr "Bo'sh maydoni bor" kategoriyasi uchun kerak).
ALTER TABLE "Property" ADD COLUMN "vacantArea" DECIMAL(14,2);

-- Mavjud ma'lumot uchun boshlang'ich hisob.
UPDATE "Property"
SET "vacantArea" = GREATEST(COALESCE("buildingArea", 0) - COALESCE("rentTotalArea", 0), 0);

CREATE INDEX "Property_vacantArea_idx" ON "Property"("vacantArea");
