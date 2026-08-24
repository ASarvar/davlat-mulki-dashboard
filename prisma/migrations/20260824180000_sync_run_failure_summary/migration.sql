-- Sinxronizatsiya xatolarining sababi RUN'ning o'zida saqlanadi.
--
-- ⚠️ Ilgari "qaysi API xato berdi" degan savolga `Property.lastSyncError` dan javob
-- olinardi, lekin u faqat OXIRGI holatni saqlaydi: keyingi sinxronizatsiya o'sha
-- obyektni yangilashi bilan avvalgi run'ning xatosi izsiz yo'qolardi. Natijada
-- tarixdagi "xato: 33" soni bilan aniqlangan sabablar soni (8) mos kelmasdi.
--
-- Format: { "API2: HTTP 500": 12, "API3: fetch failed": 4 }
ALTER TABLE "SyncRun" ADD COLUMN "failureSummary" JSONB;
