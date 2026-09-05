-- Vizual boshqaruv paneli endi ALOHIDA bo'lim (`panel`) sifatida boshqariladi.
--
-- ⚠️ `panel` uchun QATOR YOZILMAYDI — qator yo'qligi `SUPER_ONLY` degani
-- (`sectionAccess.ts`, fail-closed). Ya'ni panel serverga chiqarilgandan keyin
-- avval FAQAT super admin ko'radi; u tekshirib bo'lgach `/dashboard/sections`
-- orqali boshqa rollarga ochadi. Aynan shu holat 1.10.0 da e'tibordan chetda
-- qolgan edi: panel `core` marshrutda (`/dashboard`) turgani uchun chiqarilgan
-- zahoti hamma rolga ochilib ketgan edi.
--
-- Qolgan rollar `/dashboard` ga kirganda `/dashboard/hisobot` ga (eski ko'rinish)
-- yo'naltiriladi, ya'ni ular uchun hech narsa o'zgarmaydi.

-- `dashboard` — endi `core` + `hidden` (faqat kirish marshruti, menyu bandi emas).
-- Uning qatori hech qachon o'qilmaydi (`canAccessWith` `core` ni bazadan OLDIN
-- tekshiradi), lekin "arvoh" qator sifatida qolib ketmasin: kelajakda kimdir
-- `core` ni olib tashlasa, eski `EVERYONE` qiymati bo'limni jimgina ochib yuborardi.
DELETE FROM "SectionAccess" WHERE key = 'dashboard';
