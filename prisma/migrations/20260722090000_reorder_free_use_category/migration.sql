-- Kategoriya tartibi o'zgardi: "Tekin foydalanish" endi "Savdoda ijara"dan keyin turadi.
--   eski 3 (Tekin foydalanish)         -> 5
--   eski 4 (Savdoda xususiylashtirish)  -> 3
--   eski 5 (Savdoda ijara)              -> 4
--
-- Aylanma almashtirish bo'lgani uchun avval vaqtinchalik kodlarga (100+) ko'chiramiz.
-- MUHIM: Property.integrationCategoryCode -> Category.code FK bor, shuning uchun
-- vaqtinchalik kodlar ham Category jadvalida mavjud bo'lishi SHART (aks holda 23503).
-- Qo'lda biriktirilgan obyekt yo'q edi, ya'ni faqat integrationCategoryCode tegishli.

INSERT INTO "Category" ("code", "nameUz", "source", "excludeInefficient", "requiresDocument")
VALUES
  (103, 'tmp-3', 'INTEGRATION', true, false),
  (104, 'tmp-4', 'INTEGRATION', true, false),
  (105, 'tmp-5', 'INTEGRATION', true, false)
ON CONFLICT ("code") DO NOTHING;

UPDATE "Property" SET "integrationCategoryCode" = "integrationCategoryCode" + 100
  WHERE "integrationCategoryCode" IN (3, 4, 5);

UPDATE "Property" SET "integrationCategoryCode" = 5 WHERE "integrationCategoryCode" = 103;
UPDATE "Property" SET "integrationCategoryCode" = 3 WHERE "integrationCategoryCode" = 104;
UPDATE "Property" SET "integrationCategoryCode" = 4 WHERE "integrationCategoryCode" = 105;

DELETE FROM "Category" WHERE "code" IN (103, 104, 105);

-- Nomlarni yangi tartibga moslaymiz (seed ham shu qiymatlarni yozadi).
UPDATE "Category" SET "nameUz" = 'Savdoda xususiylashtirish' WHERE "code" = 3;
UPDATE "Category" SET "nameUz" = 'Savdoda ijara'             WHERE "code" = 4;
UPDATE "Category" SET "nameUz" = 'Tekin foydalanish'         WHERE "code" = 5;
