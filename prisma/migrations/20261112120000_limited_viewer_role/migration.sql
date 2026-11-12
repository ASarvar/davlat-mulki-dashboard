-- Yangi rol: LIMITED_VIEWER ("Cheklangan kuzatuvchi") — menyuda kuzatuvchi ko'radigan
-- bo'limlar ko'rinadi, lekin har biri "Texnik ishlar olib borilmoqda" ekranini ochadi.
--
-- ⚠️ SectionAccess qatorlari YOZILMAYDI: menyu kuzatuvchining ruxsatlaridan olinadi
-- (`MAINTENANCE_MENU_ROLE`), bo'limlarning o'zi esa bu rolga koddagi qoida bilan yopiq
-- (`canAccessWith`), bazadagi sozlama ularni ocha olmaydi.
ALTER TYPE "Role" ADD VALUE 'LIMITED_VIEWER';
