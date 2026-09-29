-- 1) Ichki o'tkazish tarixi — obyekt yangi egasiga ko'chsa ham eski egasining
--    "Balansdan chiqarilgan" ro'yxatida qoladi (`syncPropertyBase.ts` → `isTransferredHere()`).
CREATE TABLE "BalanceTransfer" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fromSourceId" TEXT NOT NULL,
    "toSourceId" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3) NOT NULL,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BalanceTransfer_propertyId_idx" ON "BalanceTransfer"("propertyId");
CREATE INDEX "BalanceTransfer_fromSourceId_idx" ON "BalanceTransfer"("fromSourceId");

ALTER TABLE "BalanceTransfer" ADD CONSTRAINT "BalanceTransfer_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BalanceTransfer" ADD CONSTRAINT "BalanceTransfer_fromSourceId_fkey" FOREIGN KEY ("fromSourceId") REFERENCES "OrganizationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BalanceTransfer" ADD CONSTRAINT "BalanceTransfer_toSourceId_fkey" FOREIGN KEY ("toSourceId") REFERENCES "OrganizationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) Eski API 2 shaklidagi obyektlar: balansga olingan sana — `registration_date`.
--    Qoida `src/lib/balance.ts` → `balanceRegRecord()` bilan AYNAN bir xil: FAQAT huquq
--    yozuvlari (`land.legal[]` / `outer[].legal[]`) UMUMAN bo'lmaganda; noto'g'ri sana tashlanadi.
CREATE FUNCTION pg_temp.safe_day(t text) RETURNS date AS $$
BEGIN
  IF t IS NULL OR t !~ '^\d{4}-\d{2}-\d{2}' THEN RETURN NULL; END IF;
  RETURN LEFT(t, 10)::date;
EXCEPTION WHEN others THEN
  RETURN NULL;
END
$$ LANGUAGE plpgsql IMMUTABLE;

UPDATE "Property" p
SET "balanceDate" = pg_temp.safe_day(p."rawApi2"->>'registration_date')
WHERE p."balanceDate" IS NULL
  AND jsonb_typeof(p."rawApi2") = 'object'
  AND pg_temp.safe_day(p."rawApi2"->>'registration_date') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p."rawApi2"->'land'->'legal') = 'array'
           THEN p."rawApi2"->'land'->'legal' ELSE '[]'::jsonb END)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p."rawApi2"->'outer') = 'array'
           THEN p."rawApi2"->'outer' ELSE '[]'::jsonb END) o
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(o->'legal') = 'array' THEN o->'legal' ELSE '[]'::jsonb END) l
  );
