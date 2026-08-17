-- Kommunal xizmatlar (suv/gaz/elektr) tekshiruvi.
--
-- Xom javoblar mavjud "ObjectStatusCheck" jadvaliga yoziladi (apiSource = 'WATER'/'GAS'/
-- 'ELECTRIC') — yangi jadval kerak emas. Bu yerda faqat dashboard agregati uchun
-- materiallashtirilgan bayroqlar qo'shiladi.
--
-- ⚠️ "utilityCheckedAt" NULL = TEKSHIRILMAGAN (abonent yo'q EMAS). Tashqi API "abonent
-- yo'q" va "bu hudud qamralmagan" holatini farqlay olmaydi, shuning uchun tekshirilmagan
-- obyekt dashboardda alohida ustunda ko'rsatiladi.
ALTER TABLE "Property"
  ADD COLUMN "hasWater"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hasGas"           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hasElectric"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "gasConsuming"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "gasBilled"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "utilityCheckedAt" TIMESTAMP(3);

CREATE INDEX "Property_utilityCheckedAt_idx" ON "Property"("utilityCheckedAt");

-- STATUS_REFRESH ning 4-moduli (refreshBase/refreshAuction/refreshRent yonida).
ALTER TABLE "SyncRun"
  ADD COLUMN "refreshUtility" BOOLEAN NOT NULL DEFAULT true;
