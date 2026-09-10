-- Auksion buyurtmasining tafsilotlari: ijara maydoni va kadastr raqami.
-- Ommaviy get-order javobida `details` yo'q — har buyurtmaga alohida so'rov
-- bilan to'ldiriladi (`services/auctionOrderDetails.ts`).
ALTER TABLE "AuctionOrder" ADD COLUMN "rentArea" DECIMAL(12,2);
ALTER TABLE "AuctionOrder" ADD COLUMN "cadastreNumber" TEXT;
ALTER TABLE "AuctionOrder" ADD COLUMN "detailsCheckedAt" TIMESTAMP(3);
