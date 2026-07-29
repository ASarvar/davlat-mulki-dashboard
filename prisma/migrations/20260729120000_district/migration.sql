-- Tuman (District) — API 2 javobidagi `district_id` + `district`.
--
-- Kalit: `code` (UZKAD district_id), NOM emas. Jonli 5441 obyektda tekshirilgan:
--   • bitta nom hech qachon ikki `district_id` ga tegishli emas (0 holat)
--   • bitta `district_id` hech qachon ikki hududda uchramaydi (0 holat)
--   • lekin bitta `district_id` da nom imlosi ikki xil bo'lishi mumkin
--     ("Buxoro sh." / "Buxoro shahar") — shuning uchun kanonik nom tanlanadi.

CREATE TABLE "District" (
    "id"        TEXT NOT NULL,
    "code"      INTEGER NOT NULL,
    "name"      TEXT NOT NULL,
    "regionId"  TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "District_code_key" ON "District"("code");
CREATE INDEX "District_regionId_idx" ON "District"("regionId");

ALTER TABLE "District"
  ADD CONSTRAINT "District_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Property" ADD COLUMN "districtId" TEXT;

CREATE INDEX "Property_districtId_idx" ON "Property"("districtId");

ALTER TABLE "Property"
  ADD CONSTRAINT "Property_districtId_fkey"
  FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────── Backfill: mavjud obyektlardan tumanlarni yig'ish ───────────────────
-- Kanonik nom = shu `code` uchun ENG KO'P uchragan imlo; teng bo'lsa eng uzuni
-- ("Buxoro shahar" > "Buxoro sh." — to'liqroq variant afzal).
INSERT INTO "District" ("id", "code", "name", "regionId", "createdAt", "updatedAt")
SELECT DISTINCT ON (code)
       md5(random()::text || code::text),
       code,
       name,
       "regionId",
       NOW(),
       NOW()
FROM (
  SELECT (p."rawApi2"->>'district_id')::int AS code,
         p."rawApi2"->>'district'           AS name,
         p."regionId",
         COUNT(*)                           AS freq
  FROM "Property" p
  WHERE p."rawApi2"->>'district_id' ~ '^[0-9]+$'
    AND COALESCE(p."rawApi2"->>'district', '') <> ''
  GROUP BY 1, 2, 3
) t
ORDER BY code, freq DESC, length(name) DESC, name;

UPDATE "Property" p
SET "districtId" = d.id
FROM "District" d
WHERE d.code = (p."rawApi2"->>'district_id')::int
  AND p."rawApi2"->>'district_id' ~ '^[0-9]+$';
