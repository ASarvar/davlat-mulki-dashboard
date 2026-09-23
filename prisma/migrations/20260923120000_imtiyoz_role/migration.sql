-- Yangi rol: IMTIYOZ ("Imtiyoz operatori") — faqat /dashboard/imtiyoz ni ko'radi.
--
-- ⚠️ Bo'lim ruxsati keyingi migratsiyada ALOHIDA: Postgres yangi enum qiymatini
-- u qo'shilgan tranzaksiya ichida ishlatishga ruxsat bermaydi ("unsafe use of new value").
ALTER TYPE "Role" ADD VALUE 'IMTIYOZ';
