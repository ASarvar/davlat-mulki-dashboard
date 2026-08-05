-- Yer/Bino ajratish (Davlat aktivlari agentligi + Direksiya dashboard jadvali uchun)
-- va Direksiyani bitta hududga (Toshkent sh.) cheklash.
--
-- ⚠️ Bu migratsiya avtomatik generatsiya qilingan diff'dan QO'LDA tozalangan:
-- Prisma "Property_hasPrivatizationLot_idx" / "Property_hasRentLot_idx" /
-- "Property_vacantArea_idx" larni DROP qilishni taklif qilgan edi — bular
-- schema.prisma'da e'lon qilinmagan, lekin dev bazada allaqachon mavjud (oldingi
-- drift, shu featurega aloqasi yo'q). Ishlash tezligi uchun muhim ustunlar
-- (buildWhere() va stats.ts filtrlarida faol ishlatiladi), shuning uchun
-- DROP INDEX qatorlari shu yerdan olib tashlandi — teginilmadi.

-- DropForeignKey (relation nomi o'zgardi: "OrgRegion" — pastdagi AddForeignKey bilan qayta tiklanadi)
ALTER TABLE "OrganizationSource" DROP CONSTRAINT "OrganizationSource_regionId_fkey";

-- AlterTable
ALTER TABLE "OrganizationSource" ADD COLUMN     "restrictedRegionId" TEXT;

-- AlterTable: yer uchastkasimi yoki bino — src/lib/area.ts -> isLandOnly()
ALTER TABLE "Property" ADD COLUMN     "isLand" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "OrganizationSource" ADD CONSTRAINT "OrganizationSource_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSource" ADD CONSTRAINT "OrganizationSource_restrictedRegionId_fkey" FOREIGN KEY ("restrictedRegionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Direksiyani Toshkent shahar bilan cheklaymiz (foydalanuvchi qarori, 2026-08-05).
-- Jonli tekshiruvda uning 59 ta obyektining barchasi ALLAQACHON Toshkent sh.da edi
-- (boshqa hududdan olib tashlanadigan narsa yo'q) — shu sabab faqat cheklovni
-- o'rnatamiz, hech qanday Property qatori o'chirilmaydi/ko'chirilmaydi.
UPDATE "OrganizationSource"
SET "restrictedRegionId" = (SELECT id FROM "Region" WHERE "cadastrePrefix" = '10')
WHERE "stir" = '202230031';
