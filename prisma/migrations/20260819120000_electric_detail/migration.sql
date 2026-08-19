-- Elektr, 2-bosqich (`het_data_detail`).
--
-- 1-bosqich (`het_data`) faqat abonent KODINI beradi — ism ham, sarf ham, to'lov ham
-- yo'q. Shu sababli `hasElectric` "kod topildi"dan boshqa hech narsani bildirmasdi.
-- Tafsilot chaqiruvi (customer_type + soato + licshet) FIO, manzil, balans, oylik
-- sarf (SALDO_PERIOD) va to'lov tarixini beradi.

-- Oxirgi ELECTRIC_CONSUMING_MONTHS oyda CURRENT_EE_KWH > 0 — hisoblagich bo'yicha
-- haqiqiy sarf (gazdagi "gasConsuming" ning muqobili).
ALTER TABLE "Property" ADD COLUMN "electricConsuming" BOOLEAN NOT NULL DEFAULT false;

-- Oxirgi to'lov sanasi — "yaqinda to'lov bo'lgan" mezoni endi gaz YOKI elektr.
ALTER TABLE "Property" ADD COLUMN "electricLastPaymentAt" TIMESTAMP(3);

-- ⚠️ Qamrov sifatining asosiy o'lchovi: tafsilotdagi KADASTR_CODE obyektning o'z
-- kadastri bilan mos keldimi. Jonli sinovda 20:08:41:01:01:0019 so'rovi
-- KADASTR_CODE = 20:08:09:01:01:0024 bo'lgan jismoniy shaxs abonentini qaytardi,
-- ya'ni "abonent bor" ko'pincha BOSHQA obyektning uy xo'jaligini ko'rsatadi.
ALTER TABLE "Property" ADD COLUMN "electricCadastreMatch" BOOLEAN NOT NULL DEFAULT false;

-- Dashboard "oxirgi N oyda to'lov" ustuni gaz bilan birga shu ustundan ham FILTER qiladi.
CREATE INDEX "Property_electricLastPaymentAt_idx" ON "Property"("electricLastPaymentAt");
