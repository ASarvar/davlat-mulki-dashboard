-- Hududlar tartibi (rasmiy hisobot shakli bo'yicha)
ALTER TABLE "Region" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Ijara jamlanmalari Property'da
ALTER TABLE "Property" ADD COLUMN "rentTotalArea" DECIMAL(14,2);
ALTER TABLE "Property" ADD COLUMN "rentMatchedByOldCad" BOOLEAN NOT NULL DEFAULT false;

-- Endi shartnoma tafsilotlari alohida jadvalda (bitta kadastrda 18 tagacha shartnoma).
-- Bu ustunlar faqat BIRINCHI shartnomani saqlardi — o'rnini RentContract egallaydi.
ALTER TABLE "Property" DROP COLUMN "rentContractNumber";
ALTER TABLE "Property" DROP COLUMN "rentTenantName";
ALTER TABLE "Property" DROP COLUMN "rentDocLink";

CREATE TABLE "RentContract" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "contractNumber" TEXT,
    "contractDate" TIMESTAMP(3),
    "contractSum" DECIMAL(18,2),
    "rentalArea" DECIMAL(14,2),
    "ownerTin" TEXT,
    "ownerName" TEXT,
    "tenantTin" TEXT,
    "tenantName" TEXT,
    "docLink" TEXT,
    "regionName" TEXT,
    "districtName" TEXT,
    "matchedByOldCad" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentContract_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RentContract_propertyId_idx" ON "RentContract"("propertyId");
CREATE INDEX "RentContract_contractNumber_idx" ON "RentContract"("contractNumber");

ALTER TABLE "RentContract" ADD CONSTRAINT "RentContract_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Kategoriyalarni qayta raqamlash ───
-- Yangi tartib: 1-6 INTEGRATION, 7-12 MANUAL.
-- Eski 11 (Ijara shartnomasi bor) -> 6,  eski 12 (Savdoda ijara) -> 5.
-- Qo'lda biriktirilgan obyektlar yo'q edi, shuning uchun manualCategoryCode bo'sh.

-- Category jadvalidagi yozuvlar seed orqali yangilanadi; avval FK ziddiyatini
-- oldini olish uchun yangi kodlarni qo'shamiz.
INSERT INTO "Category" ("code", "nameUz", "source", "excludeInefficient", "requiresDocument")
VALUES
  (5,  'Savdoda ijara',           'INTEGRATION', true,  false),
  (6,  'Ijara shartnomasi bor',   'INTEGRATION', true,  false)
ON CONFLICT ("code") DO UPDATE
  SET "nameUz" = EXCLUDED."nameUz",
      "source" = EXCLUDED."source",
      "excludeInefficient" = EXCLUDED."excludeInefficient",
      "requiresDocument" = EXCLUDED."requiresDocument";

-- Obyektlarni yangi kodlarga ko'chiramiz (11->6, 12->5)
UPDATE "Property" SET "integrationCategoryCode" = 6 WHERE "integrationCategoryCode" = 11;
UPDATE "Property" SET "integrationCategoryCode" = 5 WHERE "integrationCategoryCode" = 12;

-- Eski 11/12 yozuvlari endi MANUAL "bo'sh turgan" bo'ladi (seed to'g'rilaydi)
UPDATE "Category" SET "nameUz" = 'Bo''sh turgan', "source" = 'MANUAL',
       "excludeInefficient" = false, "requiresDocument" = true WHERE "code" = 11;
UPDATE "Category" SET "nameUz" = 'Bo''sh turgan maydoni mavjud', "source" = 'MANUAL',
       "excludeInefficient" = false, "requiresDocument" = true WHERE "code" = 12;
