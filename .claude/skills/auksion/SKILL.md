---
name: auksion
description: Auksion buyurtmalari reyestri (get-order API) — /dashboard/auksion. 14 viloyat akkaunti bo'yicha ~68 000 buyurtma: AuctionOrder/AuctionSyncRun modellari, sinxronlash (per_page, parallellik, retry), yangilash filtri (sana + viloyat), jonli progress, shaxsiy ma'lumot cheklovi va o'lchangan tezlik raqamlari. Auksion reyestriga tegadigan ish uchun oching — Property/AuctionLot/kategoriyalar bilan aloqasi yo'q.
---
# Auksion buyurtmalari reyestri (`/dashboard/auksion`) — 2026-09-07

⚠️ **MUSTAQIL quyi tizim** — `Property`/`AuctionLot`/kategoriyalarga TEGMAYDI.
Mustaqil `get-auc-order2.js` skriptidan ko'chirildi; skript endi kerak emas.

`AuctionLot` (API 3/4/6) kadastr bo'yicha **bittalab** so'raladi va faqat bizning
obyektlarimizni qamraydi. Bu API esa 14 viloyat akkaunti bo'yicha auksion
tizimidagi **barcha** buyurtmani sahifalab to'kadi — jonli o'lchov (2026-09-07):
**68 196 buyurtma**. Optimallashtirilgandan keyin 1 364 sahifa, **~16 daqiqa**
(71 yozuv/s, jonli o'lchov 2026-09-07).

```
integrations/auctionOrders.ts     mijoz (fetchOrderPage, auctionCredentials)
services/auctionOrders.ts         mapOrder + syncAuctionOrders + listAuctionOrders
services/auctionOrdersExternal.ts TASHQI bazaga yozish (59 ustun, skript formati)
db/auctionDb.ts                   tashqi baza ulanishi (AUCTION_DATABASE_URL)
QUEUE.AUCTION_ORDERS_SYNC         worker, cron "0 2 * * *" (obyektlar sync 03:00 dan OLDIN)
AuctionOrder (Postgres)           orderId birlamchi kalit, upsert
AuctionSyncRun (Postgres)         jarayon holati — ekrandagi jonli ko'rsatkich
```

## IKKI BAZAGA yoziladi (2026-09-07)

Har bir yozuv **bizning `AuctionOrder`** jadvaliga VA **tashqi `orders`** jadvaliga
(`AUCTION_DATABASE_URL`) tushadi. Sabab: tashqi bazadan **boshqa API'lar** ham
ma'lumot oladi (foydalanuvchi talabi) — skript aynan o'sha jadvalni to'ldirardi.

- ⚠️ **O'qish HAR DOIM bizning jadvaldan.** Tashqi jadvalda `credential` ustuni
  yo'q (akkaunt filtri ishlamasdi), `raw`/`syncedAt` ham yo'q va indekslarini biz
  boshqarmaymiz. Ro'yxat/filtr/Excel — faqat `AuctionOrder`.
- ⚠️ **Ustunlar va qiymatlar `get-auc-order2.js` bilan AYNAN bir xil** (59 ustun,
  o'sha tartib, o'sha sana formati `YYYY-MM-DD HH:mm:ss`). Normalizatsiyani
  "yaxshilash" mumkin emas — o'sha jadvalni boshqa tizimlar o'qiydi.
- ⚠️ **`VALUES (…)` ISHLAMAYDI.** Prisma har parametrni aniq `text` tipi bilan
  yuboradi va Postgres uni ustun tipiga keltirmaydi (`column "auction_date" is of
  type timestamp … but expression is of type text` — jonli sinov, 2026-09-07).
  Shuning uchun `jsonb_populate_recordset(NULL::orders, $1::jsonb)`: tiplar
  jadvalning O'ZIDAN olinadi, ya'ni uning sxemasini bilish shart emas.
- ⚠️ **`SELECT *` EMAS, ustunlar aniq sanaladi** — ro'yxatimizda yo'q ustunlar
  (masalan `created_at DEFAULT now()`) yangi qatorda NULL bo'lib yozilmasin.
- ⚠️ **Bitta to'plamda dublikat `order_id` tashlanadi** (oxirgisi qoladi), aks
  holda Postgres "ON CONFLICT DO UPDATE command cannot affect row a second time"
  beradi. Skriptda bu muammo yo'q edi — u har yozuvni alohida yuborardi.
- ⚠️ **Raqamli ustunlar TOZALANADI, matnli ustunlar XOM ketadi.** Ustun tiplari
  `information_schema` dan o'qiladi (jadval nomi bo'yicha keshlanadi). Sabab
  (jonli, SIR 2026-09-07): API ba'zan `lat` ga IKKALA koordinatani soladi —
  `"40.303085, 68.415794"` (2 430 dan 2 tasi; `lng` esa to'g'ri). `double
  precision` ustunda bu butun to'plamni yiqitardi. Ustun `text` bo'lsa qiymat
  o'zgarmaydi — skript nima yozgan bo'lsa o'sha.
- ⚠️ **`lat`/`lng` JUFTLIK sifatida o'qiladi** — `parseCoordPair()`
  (`integrations/auctionOrders.ts`), bizning `mapOrder()` ham SHU funksiyani
  ishlatadi (ilgari `num()` edi va bunday satrni `null` qilardi). Ikkita son
  topilsa IKKINCHISI uzunlik: har biridan "birinchi son"ni olish `lng` ga
  kenglikni yozib, nuqtani xaritada boshqa joyga tashlardi.
- ⚠️ **Xato bitta YOZUVGA cheklanadi.** To'plam yiqilsa qatorlar BITTALAB qayta
  yuboriladi (jonli sinovda o'sha ikkita `lat` 500 yozuvlik to'plamni yiqitib,
  2 430 dan 400 tasini yo'qotgan edi). Yo'qolganlar soni
  `perCredential[].externalFailed` da.
  ⚠️ **Lekin ketma-ket 3 ta xatodan keyin to'xtaydi** (`systemic`) va qolgan
  to'plamlar bittalab urinilmaydi: baza umuman yetib bo'lmasa, aks holda to'liq
  sinxronizatsiyada 68 000 ta befoyda so'rov ketardi (har biri taymaut kutib).
  O'lchangan: 1 200 yozuv, yetib bo'lmaydigan baza → 0.0 s.
- ⚠️ **`boolean` ustunlar ALOHIDA o'giriladi.** Jonli jadvalda `with_discount` va
  `is_downgrade_auction` — `boolean`, API esa RAQAM yuboradi (`0`). JSON raqamni
  boolean maydonga qo'yib bo'lmaydi ("expected json boolean") va butun to'plam
  yiqilardi. Skript bunga duch kelmagan: `pg` tipsiz matn yuborardi, Postgres
  `'0'` ni `false` deb o'qirdi.

### Jonli `project.orders` jadvali (server, 2026-09-07)

68 187 qator, **63 ustun**, `order_id bigint PRIMARY KEY`. Biz 59 tasini
yozamiz; qolgan 4 tasi — **BOSHQA tizimniki, tegilmaydi**: `created_at`/
`updated_at` (DEFAULT `CURRENT_TIMESTAMP`), `rent_area`, `cadastre_number`.
Jonli sinovda tasdiqlangan: sinxronizatsiyadan keyin ular O'ZGARMAY qoladi.

Tip tuzoqlari (hammasi jonli tekshirilgan):

| Ustun | Jadval tipi | API yuboradi | Nima bo'ladi |
|---|---|---|---|
| `lat` / `lng` | `text` | ba'zan juftlik | XOM ketadi — skriptdagidek |
| `with_discount`, `is_downgrade_auction` | `boolean` | raqam `0` | `toBool()` |
| `lot_number` | `bigint` | satr `"25338528"` | `toNumber()` |
| `*_date` (3 ta) | `date` | `DD.MM.YYYY HH:mm` | satr → `date` |
| `winner_subject_type` | `varchar(50)` | raqam | matnga o'tadi |

⚠️ `ijara_audit.orders` — **NOTO'G'RI baza**: 65 625 qator, 58 ustun, oxirgi
auksion 2026-07-13 (2 oy eskirgan). Jonli to'ldirilayotgani `project`.

- **Jonli sinov (SIR, 2026-09-07), serverning AYNAN sxemasi bilan:** 2 430 yozuv,
  49 sahifa, 33 s, tashqi bazaga 2 430 (xato 0). Koordinata 2 313, lot 2 268,
  `with_discount` 1 539 tasida to'ldi. `rent_area`/`cadastre_number`/`created_at`
  saqlanib qoldi.

### ⚠️ Serverda: `DB_HOST=localhost` DOCKER ichida ishlamaydi

Tashqi baza — host'da o'rnatilgan ALOHIDA Postgres (bizniki compose'da `db`,
host'da `127.0.0.1:5435`). Konteyner ichida `localhost` — konteynerning o'zi.
`docker-compose.yml` → `worker` ga `extra_hosts: host.docker.internal:host-gateway`
qo'shilgan, ya'ni `.env.production` da **`DB_HOST=host.docker.internal`** bo'lishi
kerak. Bundan tashqari host Postgres'i docker ko'prigidan ulanishni qabul qilishi
shart (`listen_addresses` + `pg_hba.conf` da `172.17.0.0/16`).
Agar tashqi baza ham konteyner bo'lsa — `DB_HOST` o'rniga o'sha servis nomi va
umumiy tarmoq kerak.
- ⚠️ **Tashqi bazaning xatosi sinxronizatsiyani TO'XTATMAYDI** — u boshqa tizim.
  Xato `AuctionSyncRun.perCredential[].externalError` ga yoziladi va panelda
  sariq qator bo'lib chiqadi, run esa `DONE` bo'lib qolaveradi (bizning reyestr
  to'liq — buni `FAILED` deb ko'rsatish yolg'on bo'lardi).
- ⚠️ **Yangi bog'liqlik YO'Q** — ikkinchi `PrismaClient` `datasourceUrl` bilan
  ochiladi (`pg` qo'shish `package-lock.json` ni Linux'da qayta yaratishni talab
  qilardi). Bu mijoz FAQAT xom SQL uchun; tashqi jadval `schema.prisma` da yo'q
  va bo'lmasligi ham kerak.
- Sozlanmagan bo'lsa (`AUCTION_DATABASE_URL` yo'q) tashqi yozuv butunlay
  o'tkazib yuboriladi — xato emas. `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/
  `DB_PASSWORD` berilgan bo'lsa `env.ts` ulanish satrini o'zi yig'adi (eski
  `.env.auction` bloki o'zgarishsiz ishlaydi).

## Yangilash DOIRASI — sana va akkaunt (2026-09-07)

⚠️ **API sana bo'yicha filtrlay OLMAYDI.** 54 ta parametr nomi sinaldi
(`date_from`, `from_date`, `begin_date`, `start_date`, `dateFrom`, `year`,
`period`, `since`, `after` va h.k., ikki formatda) — hech biri javobga ta'sir
qilmadi. Tartib ham sana bo'yicha emas: QR akkauntida 2026-yil yozuvlari 25-,
40-, 70-, 85-sahifalarda tarqoq, 2021-yil esa 1-, 85-, 95-sahifalarda. Ya'ni
**"oxirgi sahifalardan teskari o'qib to'xtash" ham ishlamaydi.**

Shuning uchun sana filtri FAQAT YOZISHDA qo'llanadi (`inScope()`): sahifalar
baribir to'liq o'qiladi, tejash bazada. Jonli o'lchov: joriy yil = 68 196
yozuvning **9.7%** i.

⚠️ **SANASI YO'Q yozuv HAR DOIM saqlanadi** (fail-open). 5 307 yozuvda umuman
sana yo'q (`auctionDate`, `lotPlaceDate`, `firstLotPlaceDate` — uchalasi ham),
va ularning **367 tasi HALI FAOL**: "Buyurtma yaratilgan/yuborilgan/tasdiqni
kutish". Oddiy sana filtri aynan eng yangi buyurtmalarni jimgina tashlab ketardi.

⚠️ **Kunlik cron `{ currentYear: true }` bayrog'i bilan chaqiriladi, aniq sana
bilan EMAS** — jadval bir marta ro'yxatdan o'tadi, aniq sana yozilsa 1-yanvarda
eski yil bilan qotib qolardi.

⚠️ **`singletonKey` doirani O'Z ICHIGA OLADI**
(`auction-orders-sync:<from>:<to>:<akkauntlar>`) — aks holda "faqat TOSH-SH"
so'rovi navbatdagi to'liq yangilash tufayli jimgina tashlanib ketardi.

⚠️ **SANA FILTRI VAQTNI DEYARLI TEJAMAYDI** — o'lchangan (2026-09-07):
to'liq **16d 37s** ↔ joriy yil **15d 3s** (atigi ~10%), garchi yozuvlar
68 196 → 11 890 ga (83% kam) tushsa ham. Sabab: vaqtning deyarli hammasi
HTTP'da (sahifalar baribir to'liq o'qiladi), bazaga yozish esa kichik ulush.
Uning FOYDASI — bazaga keraksiz yozuvni kamaytirish (WAL/bloat), tezlik emas.

⚠️ **HAQIQIY TEZLIK LEVERI — AKKAUNT filtri**: bitta viloyat + joriy yil (SIR)
**26 soniya** (502 yozildi, 1 928 sana bo'yicha tashlandi, jami 2 430 =
akkauntning aniq soni). "Bitta viloyatni yangilash" kerak bo'lganda shuni
ishlating, sana filtrini emas.

⚠️ **Migratsiya QO'LDA yoziladi.** `prisma migrate dev` bu loyihada ishlamaydi:
pg_trgm GIN indekslari migratsiyadan tashqarida qo'llanadi
(`prisma/apply-indexes.ts`) va Prisma buni "drift" deb ko'rib **butun bazani
reset qilishni** taklif qiladi. To'g'ri yo'l: migratsiya papkasini qo'lda
yaratib, `prisma db execute` bilan qo'llash va `prisma migrate resolve
--applied <nom>` bilan belgilash.

## Tezlik — o'lchangan qiymatlar (2026-09-07)

⚠️ **`per_page` ISHLAYDI va 50 da CHEGARALANADI** — 100/200/500 so'ralganda ham 50
qaytaradi. Standart 20 edi; 50 ga o'tish so'rovlar sonini **3 417 → 1 364** qildi.
⚠️ **Sana/holat bo'yicha filtr YO'Q**: `date_from`, `from_date`, `begin_date`,
`start_date`, `order_statuses_id`, `sort`, `order_by` — hammasi sinaldi, javobga
umuman ta'sir qilmadi. Ya'ni **inkremental sinxronlash imkonsiz**, har safar
to'liq to'kish shart. Tartib ham `order_id` yoki sana bo'yicha emas (1-sahifa
2021, oxirgisi 2023) — "yangilarigacha o'qib to'xtash" ham ishlamaydi.
⚠️ **Sahifa parallelligi** (`AUCTION_ORDERS_CONCURRENCY`, standart 4): o'lchov —
1 oqim 1.8 sahifa/s, 3 oqim 1.8, 6 oqim 3.5, xato 0 ta. Foyda bor, lekin chiziqli
emas. **Akkauntlar baribir KETMA-KET** — 14 oqim shlyuzni bosardi.
⚠️ **ASOSIY TORMOZ BIZDA EMAS**: server sahifa chuqurlashgani sari sekinlashadi —
2-sahifa 343 ms, 25-sahifa 665 ms, 50-sahifa 1 114 ms, 99-sahifa **2 303 ms**
(klassik OFFSET narxi). Shuning uchun `per_page` ni oshirish eng kuchli lever:
sahifa soni kamaysa, umumiy offset narxi ham kamayadi. Parallellikni oshirish
bundan ancha kam foyda beradi.
⚠️ Qidiruv uchun `prisma/sql/pg_trgm.sql` da 4 ta GIN indeks (`name`, `address`,
`lotNumber`, `customerName`) — usiz har `contains` 68 000 qatorni skanerlardi.
⚠️ `auctionFacets()` keshlangan (5 daq), lekin `auctionTotals()` — YO'Q: worker
`revalidateTag` chaqira olmaydi, ya'ni sinxronizatsiya tugagach ekranda eski son
turardi. Ikkalasi shu sabab ajratilgan.

⚠️ **Auth Basic EMAS** — login/parol so'rov **tanasida** ketadi va har viloyatning
o'z juftligi bor. `http.ts` dagi umumiy Basic yordamchisi bu yerda ishlamaydi.

⚠️ **`result_code !== 0` — HTTP 200 bilan keladigan mantiqiy xato** (API 2 ning
`code: 90000` tuzog'i bilan bir xil naqsh). `res.ok` ni tekshirish yetarli emas.

⚠️ **Sozlamalar `.env.auction` da** — Next.js ham, worker ham uni O'ZI o'qimaydi,
`lib/env.ts` uni **aniq yuklaydi** (`override: false`, ya'ni `.env.production`
dagi qiymat ustun). Eski nomlar (`API_URL`, `REGIONS_CREDENTIALS`) ham qabul
qilinadi va `AUCTION_ORDERS_*` ga ko'chiriladi — `API_URL` bizning env fazomizda
(API1_BASE_URL … API6_BASE_URL yonida) juda chalkash nom.
⚠️ **`REGIONS_CREDENTIALS` — SIR**: 14 ta login/parol. Xato xabariga QO'SHMANG
(ishlab chiqishda `JSON.parse` yiqilib butun qiymatni logga bosgan edi).
⚠️ Skriptdagi `DB_*` kalitlari kerak emas — ma'lumot loyihaning o'z bazasiga yoziladi.

⚠️ **Tartib `order_id` ham, sana ham bo'yicha EMAS** (1-sahifa 2021, oxirgisi 2023
bo'lishi mumkin) — ya'ni "yangilarigacha o'qib to'xtash" ishonchsiz. Har safar
to'liq to'kiladi, `orderId` bo'yicha upsert qilinadi.
⚠️ Akkauntlar **ketma-ket** yuklanadi, parallel emas — 14 oqim shlyuzda
`result_code` xatolarini boshlardi (kommunal API'lardagi bilan bir xil saboq).
⚠️ `boss.ts` da unga alohida **`expireInSeconds: 1800`** beriladi; umumiy 120s
job'ni o'rtasida uzardi (YATT indeksi bilan bir xil sabab). **Bundan kattaroq
qo'ymang**: bu ayni paytda "worker o'lsa job qachon qayta uriniladi" degani ham —
dastlab 7200 qo'yilgan edi va worker to'xtaganda job 2 soat `active` bo'lib
osilib qoldi, qayta ishga tushirish ham, ekrandagi ko'rsatkich ham bloklandi.
`AUCTION_RUN_STALE_MINUTES` (30) shu qiymatga moslashtirilgan.

⚠️ Sahifa xatosi 3 marta qayta uriniladi (backoff 1/2/4s), keyin BUTUN akkauntni
to'xtatadi — ataylab: yarim yuklangan ketma-ketlik "ma'lumot to'liq" degan
yolg'on taassurot berardi. Boshqa akkauntlar davom etadi, natija `PARTIAL` bo'ladi.

⚠️ **SHAXSIY MA'LUMOT**: g'olibning F.I.Sh., passport, JSHSHIR, telefon, manzili
va bank hisob raqami saqlanadi. Shuning uchun `sections.ts` da `allowRoles`
**faqat adminlar** (foydalanuvchi qarori) — bazadagi sozlama uni kengaytira
olmaydi. Jadvalda ko'rinmaydi, faqat qator ochilganda; Excel eksporti
`private, no-store` bilan beriladi va `requireSection("auksion")` bilan qorovullangan.

⚠️ Sana `parseApi4Date()` (auction.ts) bilan o'qiladi — **ikkinchi parser
yozmang**: API "DD.MM.YYYY" va "DD.MM.YYYY HH:mm:ss" ni beradi, API 4 dagi bilan
aynan bir xil.
