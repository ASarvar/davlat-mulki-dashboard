-- Balansga olingan sana — kadastrdagi huquq ro'yxatdan o'tgan eng oxirgi sana.
-- Hisoblash qoidasi `src/lib/balance.ts` → `balanceRegDate()` bilan AYNAN bir xil.
ALTER TABLE "Property" ADD COLUMN "balanceDate" DATE;
CREATE INDEX "Property_balanceDate_idx" ON "Property"("balanceDate");

-- Mavjud obyektlar uchun bazadagi `rawApi2` dan to'ldirish (API chaqirilmaydi).
-- ⚠️ Mavjud bo'lmagan sana (masalan `2026-02-30`) `::date` da XATO beradi va butun
-- migratsiyani yiqitardi — shuning uchun xavfsiz o'giruvchi (JS ham shunday sanani tashlaydi).
CREATE FUNCTION pg_temp.safe_day(t text) RETURNS date AS $$
BEGIN
  IF t IS NULL OR t !~ '^\d{4}-\d{2}-\d{2}' THEN RETURN NULL; END IF;
  RETURN LEFT(t, 10)::date;
EXCEPTION WHEN others THEN
  RETURN NULL;
END
$$ LANGUAGE plpgsql IMMUTABLE;

UPDATE "Property" p
SET "balanceDate" = s.d
FROM (
  SELECT t.id, MAX(pg_temp.safe_day(t.x)) AS d
  FROM (
    SELECT p1.id, l->>'date' AS x
    FROM "Property" p1
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(p1."rawApi2"->'land'->'legal') = 'array'
           THEN p1."rawApi2"->'land'->'legal' ELSE '[]'::jsonb END) l
    UNION ALL
    SELECT p2.id, l->>'date'
    FROM "Property" p2
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(p2."rawApi2"->'outer') = 'array'
           THEN p2."rawApi2"->'outer' ELSE '[]'::jsonb END) o
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(o->'legal') = 'array' THEN o->'legal' ELSE '[]'::jsonb END) l
  ) t
  GROUP BY t.id
) s
WHERE p.id = s.id AND s.d IS NOT NULL;
