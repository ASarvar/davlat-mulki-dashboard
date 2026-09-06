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

-- Auksion buyurtmalari reyestri (68 000+ qator). Qidiruv `contains` bilan ishlaydi,
-- ya'ni trigram indekssiz har so'rov to'liq skanerlash bo'lardi.
CREATE INDEX IF NOT EXISTS auctionorder_name_trgm
  ON "AuctionOrder" USING gin ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS auctionorder_address_trgm
  ON "AuctionOrder" USING gin ("address" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS auctionorder_lotnumber_trgm
  ON "AuctionOrder" USING gin ("lotNumber" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS auctionorder_customername_trgm
  ON "AuctionOrder" USING gin ("customerName" gin_trgm_ops);
