# Davlat mulki obyektlari monitoringi — Dashboard (2026)

Hududiy boshqarmalar balansidagi davlat mulki obyektlarini 2026-yilda
ijaraga berish, shartnomalar rasmiylashtirilishi va ijara to'lovlari
bo'yicha holatni hudud va kategoriya kesimida ko'rsatuvchi panel.

## Ishga tushirish

```bash
npm install
npm run dev
```

Brauzerda: http://localhost:3000

- `/` — asosiy reestr (hudud × kategoriya jadvali, yig'indilar)
- `/kiritish` — qo'lda kiritiladigan kategoriyalar uchun forma (son + asos fayl)

## Loyiha tuzilishi

```
app/
  page.tsx                 asosiy reestr sahifasi (server component)
  kiritish/page.tsx         qo'lda ma'lumot kiritish sahifasi
  api/data/route.ts         GET — barcha ma'lumot, POST — son yangilash
  api/upload/route.ts       POST — son + asos fayl yuklash
lib/
  regions.ts                14 ta hudud ro'yxati
  categories.ts              10 ta kategoriya (integratsiya/qo'lda belgisi bilan)
  integration.ts             tashqi API integratsiyasi uchun joy (hozircha mock)
  db.ts                      qo'lda kiritilgan ma'lumotlarni saqlash qatlami
  dashboard.ts                ikkala manbani birlashtiruvchi funksiya
components/
  SummaryCards.tsx, DataMatrix.tsx, EntryForm.tsx, ManualStatusList.tsx
data/db.json                 qo'lda kiritilgan ma'lumotlar (demo "baza")
public/uploads/<categoryId>/  har bir kategoriya uchun alohida fayl papkasi
```

## Kategoriyalar mantig'i

- **1–5-kategoriyalar** (`isIntegration: true`) — `lib/integration.ts` orqali
  tashqi tizimdan keladi deb hisoblanadi. Hozircha bu yerda **demo/mock**
  ma'lumot bor — haqiqiy API tayyor bo'lganda shu faylni almashtirish kifoya
  (fayl ichida qanday almashtirish kerakligi batafsil izohlangan).
- **6–10-kategoriyalar** (`isIntegration: false`) — `/kiritish` sahifasida
  hudud bo'yicha qo'lda kiritiladi va har bir yozuvga **bitta asos fayl**
  biriktiriladi. Fayl fizik jihatdan `public/uploads/<categoryId>/` papkasiga
  saqlanadi va ma'lumotlar bazasida faqat o'sha (hudud, kategoriya) juftligiga
  bog'lanadi — shu sababli bitta fayl boshqa kategoriyaga "sizib o'ta olmaydi".

## Nextjs yoki React? — asoslash

Bu loyihaga **Next.js** to'g'ri tanlov, chunki:

1. **Backend shart** — integratsiya API'sini chaqirish, faylni qabul
   qilish/saqlash va sonlarni yangilash uchun serverga ehtiyoj bor. Oddiy
   React (Vite/CRA) bilan buning uchun alohida Node/Express backend loyihasi
   kerak bo'lardi — Next.js esa App Router API Routes orqali buni bitta
   loyihada beradi.
2. **Maxfiy ma'lumotlar xavfsizligi** — tashqi integratsiya tizimining
   token/kaliti faqat serverda (`lib/integration.ts`) ishlatiladi va
   brauzerga hech qachon chiqmaydi. Agar integratsiya to'g'ridan-to'g'ri
   client (React SPA)dan chaqirilsa, kalitni yashirishning imkoni yo'q.
3. **Server-side rendering** — asosiy jadval server komponentida
   tayyorlanadi, ya'ni sahifa ochilganda ma'lumot allaqachon tayyor holda
   keladi (bo'sh ekran + keyin "loading" holati yo'q).
4. Kelajakda autentifikatsiya (masalan, har bir hududiy boshqarma faqat
   o'z hududini ko'rishi/tahrirlashi) qo'shish Next.js middleware orqali
   ancha oson.

## Optimizatsiya bo'yicha tavsiyalar

Bu loyiha ishlaydigan **prototip** sifatida qurilgan. Productionga
chiqarishdan oldin quyidagilarga e'tibor bering:

1. **JSON fayl o'rniga haqiqiy ma'lumotlar bazasi.** `lib/db.ts` hozircha
   `data/db.json` faylini o'qib-yozadi — bu faqat demo uchun yaroqli.
   Bir nechta foydalanuvchi bir vaqtda yozsa, ma'lumot ustma-ust tushishi
   (race condition) mumkin, Vercel kabi serverless muhitda esa fayl tizimi
   umuman doimiy emas. Tavsiya: **PostgreSQL + Prisma ORM** (yoki
   Supabase/PlanetScale) ga o'tish. `getManualEntries`/`upsertManualEntry`
   interfeysi shunday almashtirish uchun ataylab ajratilgan.

2. **Fayllarni obyekt xotirasida saqlash.** Hozir fayllar `public/uploads/`
   papkasida (server diskida) saqlanadi. Bulutli deploy (Vercel, va h.k.)da
   disk vaqtinchalik bo'lgani uchun fayllar yo'qolib qolishi mumkin.
   Tavsiya: **S3 (yoki mahalliy MinIO / Yandex Object Storage)** ga
   yuklab, bazada faqat URL saqlash.

3. **Autentifikatsiya va ruxsatlar (RBAC).** Hozirda istalgan foydalanuvchi
   istalgan hudud uchun ma'lumot kiritishi mumkin. Real tizimda har bir
   hududiy boshqarma faqat o'z hududi bo'yicha kiritishi, markaziy apparat
   esa hammasini ko'rishi kerak bo'ladi — NextAuth.js yoki korporativ
   SSO (masalan, single sign-on) qo'shish tavsiya etiladi.

4. **Integratsiya keshi.** `fetchIntegrationCounts()` haqiqiy API bilan
   ishlaganda har safar sahifa ochilganda so'rov yubormasin — Next.js'ning
   `fetch(..., { next: { revalidate: 300 } })` (ISR) yoki fon rejimida
   davriy sinxronizatsiya (cron job / queue) orqali keshlash tavsiya
   etiladi. Bu tashqi tizimga ortiqcha yuk tushishining oldini oladi.

5. **Validatsiya va audit.** Kiritilgan sonlar uchun chegaralar (masalan,
   haqiqiy obyektlar reestridan oshib ketmasligi) va har bir o'zgarish
   uchun audit-log (kim, qachon, qaysi hudud/kategoriya uchun o'zgartirgan)
   qo'shish nazoratni kuchaytiradi.

6. **Katta fayllar uchun to'g'ridan-to'g'ri yuklash.** Hozirgi
   `/api/upload` fayl serverdan o'tadi. Fayllar katta yoki foydalanuvchilar
   ko'p bo'lsa, presigned URL orqali to'g'ridan-to'g'ri S3'ga yuklashni
   ko'rib chiqing — bu server yukini kamaytiradi.

7. **Ma'lumotlarni eksport qilish.** Reestr jadvalidan Excel/PDF hisobot
   chiqarish funksiyasi (masalan `exceljs` yoki serverda PDF generatsiya)
   qo'shish amaliy jihatdan foydali bo'ladi.

8. **Testlar.** `lib/dashboard.ts` va API route'lar uchun unit/integration
   testlar (Vitest/Playwright) qo'shish, ayniqsa integratsiya va qo'lda
   kiritish mantig'ini regressiyadan himoya qilish uchun muhim.
