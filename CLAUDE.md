# Davlat mulki monitoring platformasi

Davlat mulki obyektlaridan foydalanish samaradorligini kuzatuvchi **ichki (internal)** veb-platforma.
14 hudud, hozircha ~2400 obyekt, 70–80k gacha o'sishi rejalashtirilgan. Interfeys **o'zbek tilida**.

## Stack

Next.js 15 (App Router) · TypeScript strict · Prisma + PostgreSQL · **pg-boss** (navbat, Redis YO'Q) ·
Auth.js v5 (Credentials) · Tailwind · lucide-react · exceljs.

**Docker ishlatilmaydi.** Postgres native (bu mashinada **5433-portda**), ilova `npm run dev`/`start`,
worker alohida jarayon.

## Buyruqlar

```bash
npm run dev          # ilova (3000-port MAJBURIY — NEXTAUTH_URL unga bog'langan)
npm run worker       # fon jarayoni — sync ISHLASHI UCHUN SHART
npm run typecheck    # tsc --noEmit
npm run db:seed      # kategoriyalar + hududlar + super-admin
npm run prisma:migrate
```

## Arxitektura

**3 bosqichli pipeline** (`src/server/queue/`):

```
sync-source    API 1: STIR → kadastrlar ro'yxati (fan-out)
property-base  API 2: kadastr → asosiy ma'lumot (cad_number_old shu yerdan)
status-check   API 3+4 (auksion zanjiri) + API 5 (ijara) → kategoriya
```

- `src/server/integrations/` — tashqi API mijozlari. `http.ts` markaziy: retry/backoff, rate-limit,
  Basic/Bearer auth, `shouldRetry` (body ichidagi vaqtinchalik xatolar uchun).
- `src/server/services/` — biznes mantiq. `classification.ts` kategoriyani aniqlaydi,
  `properties.ts` `buildWhere()` orqali rol/hudud doirasini **bir joyda** saqlaydi (ro'yxat + eksport ishlatadi).
- **Eski kadastr fallback:** har bir tekshiruv avval yangi, topilmasa eski kadastr bilan urinadi.
  Real ma'lumotda obyektlarning ~86% ida eski kadastr bor — bu asosiy yo'l, istisno emas.

### Rollar
`SUPER_ADMIN` (hammasi) · `REGION_USER` (faqat o'z hududi, kategoriya+PDF biriktiradi) · `VIEWER` (ko'rish).
Ochiq ro'yxatdan o'tish yo'q — foydalanuvchini faqat admin qo'shadi.

## Tashqi API'lar (hammasi jonli tasdiqlangan)

| API | So'rov | Auth |
|---|---|---|
| 1 | `GET {API1_BASE_URL}?num={STIR}` | yo'q |
| 2 | `GET {API2_BASE_URL}?num={CAD}&token={API2_TOKEN}` | token **query'da**, headerda emas |
| 3 | `POST {API3_BASE_URL}` body `{cad_number}` | Basic (`AUCTION_API_*`) |
| 4 | `GET {API4_BASE_URL}?order={order_id}` | Basic (bir xil juftlik) |
| 5 | `POST {API5_BASE_URL}` body `{cadastre_number}` | Basic (`API5_*`) |

**Parametr nomlari taxminga tayanmaydi** — har biri jonli sinovda aniqlangan va `.env` orqali
sozlanadi (`API3_PARAM`, `API4_PARAM`, `API5_PARAM`). API 1 da javobda `inn`, so'rovda esa `num` edi.

### API tuzoqlari (real ma'lumotdan)
- **API 2:** `cad_number_old` yo'q bo'lsa `""` qaytadi, `null` emas — tozalanmasa fallback bo'sh
  kadastr bilan chaqiriladi.
- **API 2 throttling:** HTTP **200** + `{code: 90000, "Message throttled out"}`. 429 emas! Shuning uchun
  `httpJson`'da `shouldRetry` bor — yangi API qo'shsangiz, u rate-limitni body ichida bildiradimi tekshiring.
- **API 3:** `success:true` bo'lsa ham `lot_number`/`order_id` `null` bo'lishi mumkin (`"Муаммоли"`).
  Shuning uchun "savdoda" kategoriyasi haqiqiy `lotNumber` talab qiladi.
- **API 4:** parametr o'qilmasa `result` o'ramisiz `{result_msg:"Xatolik", result_code:0}` qaytadi —
  ya'ni `result_code === 0` muvaffaqiyat kafolati emas, `result.order` borligini ham tekshirish shart.
- **Kadastr raqamlarida `/` bor** (`10:11:01:01:01:5030/03`) — obyekt sahifasi catch-all
  `/dashboard/objects/[...cad]`, URL qurish faqat `src/lib/cadastre.ts` orqali.
- Xom javoblar `ObjectStatusCheck.rawResponse` va `Property.rawApi2` da saqlanadi — **shuni saqlashda
  davom eting**: mantiq o'zgarsa API'ni qayta chaqirmasdan qayta hisoblash mumkin (7 daqiqa → 2 soniya).

## Kategoriyalar (12 ta, `src/lib/categories.ts` + `prisma/seed.ts`)

| Kod | Nomi | Manba |
|---|---|---|
| 1 | Sotilgan (bo'lib to'lash sharti bilan) | integratsiya |
| 2 | Sotilgan | integratsiya |
| 3 | Tekin foydalanish | integratsiya |
| 4 | Savdoda xususiylashtirish | integratsiya |
| 5 | Savdoda ijara | integratsiya |
| 6 | Ijara shartnomasi bor | integratsiya |
| 7–10 | Savdoga chiqmoqda / to'xtatilgan / yaroqsiz / chekka hudud | **qo'lda + PDF** |
| 11–12 | Bo'sh turgan / bo'sh maydoni bor | **qo'lda + PDF** |

**Faqat 11–12 va kategoriyasiz = SAMARASIZ.** `EXCLUDED_CATEGORY_CODES = {1..10}`.

Aniqlash qoidalari (`classification.ts`):
- `order_statuses_id === 6` ⇒ sotilgan; `term_payment === 1` ⇒ kat 1, aks holda kat 2
  (⚠️ mezon `term_payment`, `details.tulov_muddati` **emas** — u sotuv bo'lib to'lash bo'lsa ham bo'sh keladi)
- lot bor, sotilmagan ⇒ `group_name === "Davlat mulkini ijaraga berish"` ? kat 5 : kat 4
- ijara shartnomasi bor ⇒ jami summa 0 ? kat 3 : kat 6
- **Ustuvorlik:** auksion > ijara > boshqa

Kategoriya kodini o'zgartirishdan oldin `manualCategoryCode` ishlatilganini tekshiring.

## Ishlash tartibi — MUHIM

1. **Kod o'zgargach worker'ni qayta ishga tushiring.** `tsx` watch emas — ishlab turgan worker eski
   kodni xotirasida saqlaydi. Bir marta shu sabab 400 obyekt jimgina noto'g'ri kategoriyaga qaytgan.
   Belgisi: bir xil ma'lumot bir sync ichida ikki xil natija beradi.
2. **`next build` ni `next dev` bilan birga ishlatmang** — umumiy `.next` buziladi
   (`ENOENT app/page.js`, `Cannot find module './vendor-chunks/...'`).
   To'g'ri tartib: serverni to'xtatish → `.next` o'chirish → qayta ishga tushirish.
3. **`prisma generate`** dev server ishlab turганда Windows'da EPERM beradi — avval to'xtating.
4. **`db:seed` ni jonli bazada ehtiyot bilan** — u `upsert` qiladi; ilgari real STIR yoniga soxta
   manba qo'shib yuborgan. Hozir placeholder faqat hududda manba umuman bo'lmasa yaratiladi.
5. Prisma'da `Json` ustunlar uchun `where: { field: { equals: null } }` SQL NULL bilan mos kelmaydi —
   xom SQL (`"rawApi2" IS NULL`) ishlating.

## Konventsiyalar

- Izohlar va UI matni — **o'zbek tilida**.
- Ma'lumot yo'qotadigan amallar (o'chirish) UI'da **bloklanadi**, sababi tugma yonida ko'rsatiladi
  (masalan: obyekti bor manbani o'chirib bo'lmaydi — "Faol" belgisini oling).
- Dashboard aggregatlari `unstable_cache` (tag `dashboard`, 60s TTL) — worker alohida jarayon
  bo'lgani uchun `revalidateTag` chaqira olmaydi, shuning uchun TTL kerak.
- Rasmiy hisobot jadvallarida **J A M I qatori birinchi** (oltin fon, qizil raqamlar),
  hududlar `Region.sortOrder` bo'yicha.
