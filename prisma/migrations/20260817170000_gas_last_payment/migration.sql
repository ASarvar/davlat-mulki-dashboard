-- Gaz abonentining oxirgi to'lov sanasi.
--
-- ⚠️ "Abonent bor" bayrog'i yopilgan eski hisobni ham, faol hisobni ham bir xil
-- ko'rsatardi (jonli ma'lumotda sanalar 2024-yildan 2026-yilgacha tarqalgan).
-- To'lov sanasi `gasBilled` dan kuchliroq dalil: hisob-kitob abonent to'lamasa ham
-- davom etaveradi, to'lov esa kimdir obyektdan foydalanayotganini bildiradi.
ALTER TABLE "Property" ADD COLUMN "gasLastPaymentAt" TIMESTAMP(3);

-- Dashboard "oxirgi N oyda to'lov" ustuni shu bo'yicha FILTER qiladi.
CREATE INDEX "Property_gasLastPaymentAt_idx" ON "Property"("gasLastPaymentAt");
