-- Rasmiy hisobot `/dashboard` dan `/dashboard/hisobot` ga ko'chirildi va `SectionAccess`
-- registriga yangi bo'lim sifatida qo'shildi.
--
-- ⚠️ BU QATOR MAJBURIY. `SectionAccess`da qatori yo'q bo'lim `SUPER_ONLY` deb qaraladi
-- (fail-closed). Hisobot ilgari `/dashboard` sifatida BARCHA rollarga ochiq edi —
-- qatorsiz deploy qilinsa ertasiga super admindan boshqa hech kim rasmiy hisobotni
-- ko'ra olmasdi. Ya'ni bu yerda fail-closed standarti xavfsizlik emas, REGRESSIYA
-- bo'lardi: bo'lim yangi emas, shunchaki manzili o'zgargan.
--
-- `EVERYONE` — eski `/dashboard` bilan aynan bir xil qamrov (`allowRoles` = hamma rol).
INSERT INTO "SectionAccess" ("key", "visibility", "roles", "updatedAt") VALUES
  ('hisobot', 'EVERYONE', ARRAY[]::"Role"[], now() AT TIME ZONE 'UTC')
ON CONFLICT ("key") DO NOTHING;
