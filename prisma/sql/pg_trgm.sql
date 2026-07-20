-- pg_trgm: kadastr/nom/manzil bo'yicha tezkor partial (contains/startsWith) qidiruv.
-- Bu SQL `prisma migrate` bilan ifodalab bo'lmaydi (GIN + operator class), shu sabab qo'lda.
-- Idempotent: qayta ishga tushirsa xato bermaydi.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS property_cadnumber_trgm
  ON "Property" USING gin ("cadNumber" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS property_cadnumber_old_trgm
  ON "Property" USING gin ("cadNumberOld" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS property_name_trgm
  ON "Property" USING gin ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS property_address_trgm
  ON "Property" USING gin ("address" gin_trgm_ops);
