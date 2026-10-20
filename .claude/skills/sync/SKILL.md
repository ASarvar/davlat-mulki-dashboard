---
name: sync
description: Sinxronizatsiya — SyncRunType (FULL_ALL/REGION/SINGLE/STATUS_REFRESH), to'rt modul (refreshBase/Auction/Rent/Utility), kommunal umumiy sync'ga kirmasligi, yangilanmagan modul hissasini tiklash, kunlik 03:00 cron, osilib qolgan run himoyasi (runProgress.ts) va ijara auksioni hodisalari (online-ijara auction_logs, har daqiqada — rentAuctionEvents.ts). src/server/queue yoki sync sahifasiga tegadigan ish uchun oching.
---
# Sinxronizatsiya (pg-boss navbati)

CLAUDE.md dan ko'chirilgan (2026-10-12) — matn o'zgarishsiz.

### Sinxronizatsiya turlari (`SyncRunType`) — 2026-07-27

`FULL_ALL`/`REGION`/`SINGLE` — to'liq zanjir (kashfiyot: API1/2 + holat: API3-6), o'zgarmagan.
Yangi **`STATUS_REFRESH`** — kashfiyotni (API1/2 fan-out) o'tkazib, MAVJUD obyektlarga
to'g'ridan-to'g'ri holat-API qo'yadi (`triggerStatusRefresh()`). Doirasi hudud **va/yoki**
soha (`OrganizationSource.name`) bilan cheklanadi, ikkalasi ham ixtiyoriy va birga ishlaydi.

**To'rtta mustaqil modul** (`SyncRun.refreshBase/refreshAuction/refreshRent/refreshUtility`,
har biri checkbox):
- `refreshBase` — API2 (asosiy ma'lumot: maydon, manzil, `rawApi2`)
- `refreshAuction` — API3/4 (auksion) **+** API6 (ijara loti) **BIRGA** — ajratib bo'lmaydi,
  chunki ikkalasi ham bitta `deriveAuctionCategory()` chaqiruviga kiradi va `AuctionLot`
  jadvalida birga saqlanadi (PRIVATIZATION + RENT turlari, bitta deleteMany+createMany).
- `refreshRent` — API5 (ijara shartnomalari), mustaqil (5/6 kod diapazoni auksiondan alohida)
- `refreshUtility` — suv/gaz/elektr (kommunal abonent tekshiruvi). **Kategoriyaga ta'sir
  qilmaydi**, shuning uchun quyidagi "diapazondan tiklash" mantig'i unga tegishli emas.

⚠️ **Kommunal UMUMIY sinxronizatsiyaga KIRMAYDI** (2026-08-24). `checkPropertyStatus.ts`da
`refreshUtility` standarti — qolgan uchtasidan farqli — **`false`**. Ya'ni
`FULL_ALL`/`REGION`/`SINGLE` va kunlik avtomatik sync uni butunlay o'tkazib yuboradi;
u FAQAT `/dashboard/sync` → "Faqat holat yangilash"da "Kommunal" belgisi **qo'lda**
tanlanganda ishlaydi (o'sha belgi ham endi standart holatda yoqilmagan).
`triggerFullSync/RegionSync/SingleSync` `SyncRun.refreshUtility: false` deb ham yozadi —
sxemadagi standart `true` bo'lgani uchun buni aniq berish shart.
**Sabab:** kommunal API'lar barqaror emas va ular auksion/ijara bilan bitta `Promise.all`
ichida bo'lgani uchun bitta HTTP 500 BUTUN obyekt tekshiruvini yiqitardi — obyektning
auksion/ijara ma'lumoti ham yangilanmay qolardi (jonli o'lchov: bir run'da 35 xatodan
34 tasi aynan kommunaldan; `UTIL_GAS`/`UTIL_ELECTRIC` HTTP 500 qaytargan).

⚠️ **Yangilanmagan modul tashqi API'ga UMUMAN chaqirilmaydi** — uning oldingi hissasi
`checkPropertyStatus.ts`dagi `AUCTION_RANGE`/`RENT_RANGE` orqali bazadagi joriy
`integrationCategoryCode`dan tiklanadi (auksion={1,2,3,4,7}, ijara={5,6} — kesishmaydi,
ustuvorlik har doim auksion>ijara>boshqa bo'lgani uchun joriy qiymat qaysi diapazonda
ekani o'sha modulning oxirgi natijasini aniq bildiradi — qayta hisoblash shart emas).
`refreshBase=false` bo'lsa `rawApi2`/maydon o'zgarmaydi; live API4dan `rentedArea` kerak
bo'lganda (maydon tuzatish) `refreshRent=false` bo'lsa saqlangan `rentTotalArea` ishlatiladi.
Jonli API bilan ikki yo'nalishda tekshirildi (auksion-ustuvor va ijara-ustuvor obyektlarda) —
qisman yangilash boshqa modulning kategoriyasini **hech qachon** `null`ga almashtirmaydi.

**Kunlik avtomatik to'liq sinxronizatsiya** — `worker.ts` ishga tushganda pg-boss
`.schedule("daily-full-sync", "0 3 * * *", {}, {tz:"Asia/Tashkent"})` chaqiradi (faqat worker
process, Next.js emas). Idempotent — qayta ishga tushganda jadval qayta yozilaveradi.
Faol run bor bo'lsa `assertNoActiveRun()` xato tashlaydi — kunlik ishga tushirish buni
`try/catch` bilan jim o'tkazib yuboradi (log'ga yozadi, keyingi kunga qoldiradi).

⚠️ **Osilib qolgan run — butun jadvalni bloklaydi** (jonli hodisa: 29.09 dagi FULL_ALL
`QUEUED`/`totalCount=0` holatida qolib, 12 kun birorta avtomatik sync ham, snapshot ham
o'tmagan; worker ishlab turgan, cron har kuni "completed"). Ikki himoya (2026-10-09,
`services/runProgress.ts`):
- **Fan-out hisobi:** `SyncRun.sourcesTotal/sourcesDone/sourcesFailed`. Har bir
  `sync-source` jobi (xato bo'lsa ham) `sourceFinished()` chaqiradi; hammasi tugab
  `totalCount = 0` bo'lsa run shu yerda yopiladi (xato bo'lsa `FAILED`, sabab `API1: …`).
  `finalizeIfComplete()` endi `sourcesDone >= sourcesTotal` ni ham talab qiladi.
- **`closeStaleRuns()`** — `progressAt ?? startedAt ?? createdAt` dan beri
  `STALE_RUN_HOURS` (6) soat o'sish bo'lmagan faol run'ni `FAILED` qiladi
  (`failureSummary` → `SYNC: Osilib qoldi…`, audit `CLOSE_STALE_SYNC`). Chaqiriladi:
  `assertNoActiveRun()` (har bir trigger, kunlik cron ham) va `takeDashboardSnapshot()`.

### Ijara auksioni hodisalari — deyarli real vaqt (2026-10-20, `services/rentAuctionEvents.ts`)

Kunlik sync'dan tashqari, **ijara** lotlari har daqiqada yangilanadi: worker cron
`rent-auction-events` (`* * * * *`) online-ijara bazasidagi (`auctionDb()`, ya'ni
`DB_HOST`/`DB_NAME`… — `orders` yoziladigan o'sha baza) jurnaldan o'qiydi:

```
auction_logs (action = 'e-auction_push', id > kursor) ─ object_id ─▶ auctions.object_id
auctions.id = e-auksion order_id ─▶ AuctionLot.orderId / Property.auctionOrderId ─▶ Property
   └─ status-check: refreshAuction + refreshRent (base va kommunal — yo'q), syncRunId'siz
```

- `e-auction_push` — e-auksion online-ijara webhook'iga (`/api/v1/auction/order/event?id=`)
  yuborgan bildirishnoma. Bir buyurtma soniyasiga 2–3 marta keladi — bitta aylanishda
  `GROUP BY` bilan birlashadi.
- ⚠️ **FAQAT IJARA.** Jonli tekshiruv: bizning 2 343 xususiylashtirish `order_id` sidan
  `auctions` da 0 ta, ijaradan 354 tadan 332 tasi. Auksion reyestri (`AuctionOrder`) ham
  faqat ijara akkauntlari. Kat 3 (xususiylashtirish) hamon faqat API 3/4 orqali, kunlik.
- **Kursor** `ExternalCursor` (`online-ijara:auction_logs`) — navbatga qo'yilgandan KEYIN
  suriladi. Birinchi ishga tushishda hozirgi `max(id)` dan boshlaydi (tarixni ~800 ming
  hodisani qayta o'ynamaydi). Orqada qolsa 50 000 `id` dan bo'lib yetib oladi.
- ⚠️ `auction_logs` da `action`/`created_at` ga indeks YO'Q — faqat `id` oralig'i bo'yicha
  o'qiladi. `auctions` dan faqat `id`/`object_id` (g'olib ma'lumoti va `username`/`password`
  ustunlari bor — `SELECT *` qilinmasin).
- **Yangi buyurtma** (bizda lot yo'q): avval `AuctionOrder.cadastreNumber`, bo'lmasa
  `get-order` (`customerInn` akkaunti, noma'lum bo'lsa 14 akkaunt birma-bir, ~75 ms dan)
  → kadastr → `Property`. Topilmagani 6 soat qayta so'ralmaydi (boshqa tashkilot obyekti).
- `get-order` "Foydalanuvchinig buyurtmasi aniqlanmadi" (begona akkaunt) → `not_found`,
  xato emas (ilgari 3 marta backoff bilan qayta so'ralardi).
- `syncRunId` yo'qligi sababli `assertNoActiveRun()` ni bloklamaydi; qo'lda sync bilan
  birga ishlashi mumkin. Job xato tashlamaydi — bir xil xato log'ga bir marta yoziladi.
- Ma'lum cheklov: `id` tartibi commit tartibi emas — bir soniyada parallel commit bo'lgan
  kichik `id` o'tkazib yuborilishi mumkin; kunlik 03:00 sync qoplaydi.
