# Davlat mulki monitoring platformasi

Davlat mulki obyektlaridan foydalanish samaradorligini kuzatuvchi **ichki (internal)** veb-platforma.
14 hudud, hozircha ~2400 obyekt, 70–80k gacha o'sishi rejalashtirilgan. Interfeys **o'zbek tilida**.

## Stack

Next.js 15 (App Router) · TypeScript strict · Prisma + PostgreSQL · **pg-boss** (navbat, Redis YO'Q) ·
Auth.js v5 (Credentials) · Tailwind · lucide-react · exceljs.

**Ikki muhit — chalkashtirmang:**
- **Dev (Windows) — Docker YO'Q.** Postgres native (**5433-portda**), `.env`, `npm run dev`,
  worker alohida jarayon. Ish tartibi o'zgarmagan.
- **Production (Linux) — Docker.** 4 servis: `db` (postgres:15) · `migrate` (bir martalik) ·
  `web` · `worker`. Sozlamalar `.env.production` da, batafsil — `DEPLOY.md`.

## Buyruqlar

```bash
npm run dev          # ilova (3000-port MAJBURIY — NEXTAUTH_URL unga bog'langan)
npm run worker       # fon jarayoni — sync ISHLASHI UCHUN SHART
npm run typecheck    # tsc --noEmit
npm run db:seed      # kategoriyalar + hududlar + super-admin
npm run prisma:migrate
```

Serverda (`DEPLOY.md`da to'liq): `docker compose up -d --build` — migratsiya avtomatik.

⚠️ **`docker compose down -v` — HECH QACHON.** `-v` `pgdata` va `uploads` volume'larini
o'chiradi: butun baza + barcha asoslovchi PDF/rasmlar yo'qoladi.

### Docker'ga tegishli ikki fayl (o'zgartirsangiz — ikkalasini birga)
- `next.config.mjs` → `output: "standalone"` — Dockerfile'ning `web` bosqichi shunga tayanadi.
- `prisma/schema.prisma` → `binaryTargets = ["native", "debian-openssl-3.0.x"]` — `native`
  Windows uchun, ikkinchisi konteyner uchun. Olib tashlansa konteynerda "Query engine not found".

Dockerfile ikkita runtime bosqichi beradi: **`web`** (standalone, `node server.js`) va
**`tools`** (to'liq `node_modules` — `tsx` bilan worker va `prisma` CLI bilan migratsiya shu yerdan).
Worker `tsx` orqali ishlagani uchun uni standalone image'ga sig'dirib bo'lmaydi — shuning uchun
ikki bosqich.

⚠️ **`package-lock.json` LINUX'da yaratilishi shart.** Windows'da `npm install` qilgan lock
Windows'da `npm ci` dan o'tadi, lekin Docker build'da **yiqiladi**
(`npm error code EUSAGE ... lock file's picomatch@2.3.2 does not satisfy picomatch@4.0.5`).
Sabab platformaga bog'liq bog'liqlik daraxti — npm versiyasi emas (10.9.0 va 10.9.8 ikkalasi ham
Linuxda bir xil yiqilgan). Linux'da yaratilgan lock esa **ikkala platformada ham** ishlaydi.
Shuning uchun `npm install` bilan bog'liqlik qo'shsangiz, lockni shunday qayta yarating:

```bash
docker run --rm -v "$PWD":/w -w /w node:22-bookworm-slim npm install --package-lock-only
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

### Rollar (6 ta)
- `SUPER_ADMIN` — hammasi.
- `ADMIN` — super admin bilan bir xil, lekin super adminni ko'rmaydi/boshqarmaydi.
- `RAHBARIYAT` — **hamma hudud** (hudud biriktirilmaydi); so'rovni **yakuniy tasdiqlaydi** (2-bosqich);
  9/10 kategoriyani "Bo'sh turgan"ga qaytara oladi (`removeManualCategory`).
- `MODERATOR` — hamma obyektni ko'radi; biriktirilgan hudud(lar) (`UserRegion` yoki `allRegions`)
  so'rovlarini **qabul qiladi** (1-bosqich) yoki rad etadi. To'g'ridan-to'g'ri biriktira **olmaydi**.
- `IJROCHI` (Hudud ijrochisi) — bitta hudud (`regionId`); "Bo'sh turgan" obyektni Yaroqsiz/Chekka'ga
  biriktirish **so'rovini** yuboradi (darhol emas).
- `VIEWER` — faqat ko'rish.

⚠️ Enum `NAZORATCHI` → `IJROCHI` deb qayta nomlangan (migratsiya `20260725120000_rahbariyat_two_stage`).
Yorliqlar `src/lib/roles.ts` → `ROLE_LABEL` da; kodda rol satrini qo'lda yozmang.

**Email YO'Q — `username` (login) + parol.** Ochiq ro'yxatdan o'tish yo'q; userlarni faqat
SUPER_ADMIN/ADMIN qo'shadi (ADMIN, ADMIN/SUPER_ADMIN yarata olmaydi). Sync/Manbalar/Userlar —
faqat SUPER_ADMIN+ADMIN. Rol doirasi bir joyda: `authz.ts` → `userRegionScope()`,
`assertRegionWriteAccess()` (endi **async**). RAHBARIYAT `userRegionScope()`da `null` (cheklovsiz).

### Tasdiqlash workflow — IKKI BOSQICH (`assignment.ts` + `CategoryChangeRequest`)
```
IJROCHI so'rov  →  PENDING_MODERATOR  →  (moderator qabul)  →  PENDING_RAHBARIYAT
                                      →  (rad, sabab bilan)  →  REJECTED
                   PENDING_RAHBARIYAT →  (rahbariyat tasdiq) →  APPROVED  ⇒ kategoriya QO'LLANADI
                                      →  (rad, sabab bilan)  →  REJECTED
```
⚠️ **Kategoriya faqat oxirgi bosqichda qo'llanadi.** Moderator "qabul qilish"i hech narsani
o'zgartirmaydi — u faqat statusni `PENDING_RAHBARIYAT`ga o'tkazadi. UI'da ham "Tasdiqlash" emas,
"Qabul qilish" deb yoziladi (`RequestRow.tsx`).
- **Rad etishda sabab MAJBURIY** (`reviewRequest` xato tashlaydi; tugma ham client'da bloklanadi) —
  ijrochi sababni bildirishnomada ko'radi.
- Rad etilsa PDF va rasmlar diskdan ham o'chadi.
- Bildirishnomalar: har bosqichda ijrochiga; rahbariyat qarori haqida **qabul qilgan moderatorga ham**.
- Kim qaysi bosqichni ko'radi — `reviewableStages()` (moderator → 1, rahbariyat → 2, admin → ikkalasi).
  Hudud cheklovi amalda faqat moderator bosqichida ishlaydi.
- Bosqich maydonlari alohida: `moderatorId/moderatorNote/moderatorAt` va `rahbarId/rahbarNote/rahbarAt`
  (eski yagona `reviewedBy*` uchligi moderator maydonlariga qayta nomlangan).

**So'rovlar tarixi** — `/dashboard/requests` **hamma rolga** ochiq. Sahifada ikki bo'lim:
"Ko'rib chiqish kutilmoqda" (faqat `reviewableStages()` bo'sh bo'lmasa) va "So'rovlar tarixi"
(`listRequestHistory()`, hammaga, o'z doirasida: ijrochi → o'z so'rovlari, moderator → o'z hududlari,
rahbariyat/admin/kuzatuvchi → hammasi). Tarixda har ikki bosqich qarori (kim + izoh) ko'rinadi.

⚠️ **Kategoriyani qaytarishda (`removeManualCategory`) sabab MAJBURIY** va u
`PropertyCategoryAssignment`ga **11 (Bo'sh turgan)** yozuvi sifatida saqlanadi — shunda obyekt
sahifasidagi "Biriktirishlar tarixi"da nima uchun qaytarilgani ko'rinadi. Ya'ni bu jadval endi
faqat "biriktirish" emas, **qaytarish**ni ham yozadi.

Biriktirish formasi faqat **9 (Yaroqsiz), 10 (Chekka)** — `ASSIGNABLE_CATEGORY_CODES`, raqamsiz.
**Fayllar:** PDF majburiy (15MB), **4tagacha ixtiyoriy rasm** (JPG/PNG/WEBP, `MAX_IMAGE_ATTACHMENTS`,
har biri `MAX_IMAGE_UPLOAD_BYTES` = 5MB — PDF'dan alohida, kichikroq chegara).
⚠️ Rasmlar alohida jadval emas — asosiy PDF hujjatning **bolalari** (`Document.parentId`, self-relation,
`onDelete: Cascade`). Shuning uchun PDF o'chsa rasmlar ham o'chadi va so'rov/darhol-biriktirish
yo'llarining ikkalasi ham bitta `documentId` FK bilan ishlayveradi. Diskdan o'chirishda
`{ OR: [{ id }, { parentId: id }] }` bilan storageKey'larni oldin yig'ish kerak (kaskad DB'da, disk emas).
PDF siqish YO'Q — foydalanuvchi tanlovi (Ghostscript kerak bo'lardi).

## Tashqi API'lar (hammasi jonli tasdiqlangan)

| API | So'rov | Auth |
|---|---|---|
| 1 | `GET {API1_BASE_URL}?num={STIR}` | yo'q |
| 2 | `GET {API2_BASE_URL}?num={CAD}&token={API2_TOKEN}` | token **query'da**, headerda emas |
| 3 | `POST {API3_BASE_URL}` body `{cad_number}` | Basic (`AUCTION_API_*`) |
| 4 | `GET {API4_BASE_URL}?order={order_id}` | Basic (bir xil juftlik) |
| 5 | `POST {API5_BASE_URL}` body `{cadastre_number}` | Basic (`API5_*`) |
| 6 | `POST {API6_BASE_URL}` body `{cad_number}` | Basic (`API6_*`) |

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
- **API 2 maydonlari:** `area` ← `object_area_p` (**binoning umumiy maydoni**),
  `buildingArea` ← `object_area_u` (**foydali maydon**).
  ⚠️ Shartnoma maydoni foydali maydondan katta bo'lsa (obyekt aslida yer uchastkasi) — ikkala ustun
  ham `land_area` dan olinadi. Real ma'lumotda 84 holatdan 81 tasi shu bilan tuzaldi, 13 tasida
  `land_area` ham yetarli emas. `Property.vacantArea` = `GREATEST(foydali − ijarada, 0)` ustun sifatida
  saqlanadi (Prisma ikki ustunni solishtira olmaydi, filtr uchun kerak).
  ⚠️ Obyekt sahifasida (`/dashboard/objects/[...cad]`) "Binoning umumiy maydoni"/"Foydali maydon"
  `Property.area`/`buildingArea` emas, `rawApi2.object_area_p`/`object_area_u`dan **to'g'ridan-to'g'ri**
  o'qiladi — chunki DB ustunlari yuqoridagi `land_area` tuzatishi bilan almashtirilgan bo'lishi mumkin,
  bu yerda esa API 2 ning xom qiymati ko'rsatilishi kerak. Karta ostidagi "Barcha kadastr ma'lumotlari"
  kengaytmasi (`CadastreRawData.tsx`) barcha `land_area*`/`object_area*` maydonlarini xom holda
  ko'rsatadi — suffikslar (`_i`, `_b`, `_f`, `_z`, `_d`, `_bd`, `_nz`, `_legal`) ma'nosi jonli javobda
  hujjatlashtirilmagan, shuning uchun taxmin qilib nomlanmagan.
- **Kadastr raqamlarida `/` bor** (`10:11:01:01:01:5030/03`) — obyekt sahifasi catch-all
  `/dashboard/objects/[...cad]`, URL qurish faqat `src/lib/cadastre.ts` orqali.
- Xom javoblar `ObjectStatusCheck.rawResponse` va `Property.rawApi2` da saqlanadi — **shuni saqlashda
  davom eting**: mantiq o'zgarsa API'ni qayta chaqirmasdan qayta hisoblash mumkin (7 daqiqa → 2 soniya).
- **API 4 (`order`) maydonlari:** `start_price` va `auction_date` bor, lekin **maydon yo'q** — aksincha
  API 6 (ijara) dan farqli, `auction_date` jonli javobda ISO **emas**, `"DD.MM.YYYY HH:mm:ss"` formatida
  (`parseApi4Date`, `auction.ts`). Maydon `details[key="hudud_kvm_2"]` da keladi va ko'pincha toza son
  emas — erkin matn: `"Huquqiy hujjatga asosan 1048,93 (Amalda 1112,23)"` yoki
  `"Umumiy maydoni: 47,0 kv.m."` (real ma'lumotda ~48% holat). `parseAreaText()` ikkita raqam bo'lsa
  **"Amalda"** (haqiqiy o'lchangan) qiymatini ustuvor oladi — foydalanuvchi tasdiqlagan tanlov.

## Kategoriyalar (12 ta, `src/lib/categories.ts` + `prisma/seed.ts`)

| Kod | Nomi | Manba |
|---|---|---|
| 1 | Sotilgan (bo'lib to'lash sharti bilan) | integratsiya |
| 2 | Sotilgan | integratsiya |
| 3 | Savdoda xususiylashtirish | integratsiya |
| 4 | Savdoda ijara | integratsiya |
| 5 | Tekin foydalanish | integratsiya |
| 6 | Ijara shartnomasi bor | integratsiya |
| 7 | Savdoga chiqarish jarayonida | **qo'lda + PDF** va integratsiya (API 3 statusi) |
| 8–10 | Savdo to'xtatilgan / yaroqsiz / chekka hudud | **qo'lda + PDF** |
| 11–12 | Bo'sh turgan / bo'sh maydoni bor | **qo'lda + PDF** |

**Faqat 11–12 = SAMARASIZ.** `EXCLUDED_CATEGORY_CODES = {1..10}`.
Hech qanday integratsiya kategoriyasi topilmasa obyekt **11 (Bo'sh turgan)** bo'ladi — "kategoriyasiz"
holati yo'q (`CAT_VACANT` default).

⚠️ **Bitta obyekt = bitta kategoriya modeli yetarli emas.** Obyekt bo'lib-bo'lib bir nechta lotga
chiqarilishi (real: bitta obyektda 13 ta ijara loti) va bir vaqtda HAM xususiylashtirish, HAM ijara
savdosida bo'lishi mumkin (44 ta shunday). Shuning uchun `AuctionLot` jadvali (`PRIVATIZATION`/`RENT`)
va `Property.hasPrivatizationLot` / `hasRentLot` bayroqlari bor. **"Savdoda" = hozir savdoda turgan:**
sotilgan obyektning ham loti bor, shuning uchun `hasPrivatizationLot` da `!isSold` sharti bor
(aks holda kat 3 da 1427 ta chiqadi, 524 o'rniga).

**Dashboard jadvalida 3, 4, 5, 6 va 12-ustunlar effektiv kategoriyadan EMAS, xususiyatdan hisoblanadi**
(`stats.ts` → `rentBreakdown`): sotilgan yoki savdodagi obyekt ham ijara shartnomasiga ega bo'lishi
mumkin va o'sha ustunlarda ko'rinishi kerak. Shuning uchun ustunlar yig'indisi "Jami"dan katta chiqadi.
⚠️ **`buildWhere()` ham shu mantiqni takrorlashi shart** — aks holda jadvaldagi raqamni bosganda
ro'yxat bo'sh chiqadi. Kod: kat 3 → `hasPrivatizationLot`, kat 4 → `hasRentLot`, kat 5 → `rentTotalSum = 0`,
kat 6 → `> 0`, kat 12 → `vacantArea > 0`.
Jadval ustunlari kengaytirilgan (`stats.ts` → `buildDashboardColumns()`, ikki qatorli sarlavha):
3 → **soni · ijara shartnoma soni**, 4 → **soni · maydon · ijara shartnoma soni**, 5/6 → **soni ·
foydali · ijarada · bo'sh**, 11 → **soni · foydali**, 12 → **soni · bo'sh**, qolganlari bitta "soni"
ustuni. Sahifada (`dashboard/page.tsx`) maydonlar **ming m²** da ko'rsatiladi; faqat "soni" katagi
ro'yxatga havola. `/dashboard/objects?category=12` da "Maydon" ustuni "Bo'sh maydon"ga almashadi.
⚠️ `buildDashboardColumns()` **markazlashtirilgan** — sahifa va `/api/export/dashboard-categories`
(Excel eksporti) bir xil funksiyani chaqiradi (`buildWhere()` bilan bir xil printsip); ustun
qo'shsangiz/o'zgartirsangiz ikkalasi ham avtomatik yangilanadi.

### Manba (soha) kesimi — `?soha=`
`OrganizationSource.name` = soha ("Ijara markazi", "Davlat aktivlari"...). Bitta soha 14 hududda
14 ta yozuv sifatida yashaydi (har birida o'z STIR'i) — ya'ni "manba turi" uchun alohida jadval YO'Q,
guruhlash **nom bo'yicha** ketadi (`listSourceNames()` noyob nomlarni beradi).

Bir xil `soha` query param **uch joyda** ishlatiladi va bir xil mezonni bildiradi:
- `/dashboard?soha=` → `getDashboardStats(soha)` (umumiy = param yo'q)
- `/dashboard/objects?soha=` → `buildWhere()` → `{ source: { name: soha } }`
- `/api/export/dashboard-categories?soha=` → o'sha statistika

Dashboard'dagi barcha drill-down havolalar `objHref()` orqali quriladi — u `soha`ni avtomatik
qo'shadi, shuning uchun yangi havola qo'shsangiz **`objHref()` ishlating**, qo'lda URL yozmang.
⚠️ `stats.ts`dagi raw SQL'lar `Prisma.sql` bilan **parametrlangan** (`$queryRawUnsafe` emas) —
`soha` foydalanuvchi kiritadigan qiymat. Yangi so'rov qo'shsangiz shu uslubni saqlang.
⚠️ Hudud kesimida filtr **JOIN shartida** (`LEFT JOIN ... AND ${srcCond}`), `WHERE`da emas — aks
holda o'sha manbada obyekti yo'q hudud jadvaldan butunlay tushib qolardi (0 o'rniga yo'qoladi).
Kesh kaliti `dashboard-stats-v8` + argument, ya'ni har bir soha o'z keshiga ega.

⚠️ **`computeDashboardStats()`dagi `inefficient` (Bo'sh turgan) soni `byCategoryRaw`dan (code=11)
olinadi, `Property.isInefficient` ustunidan ALOHIDA so'rov bilan EMAS.** Ilgari alohida
`prisma.property.count({isInefficient:true})` so'rovi bor edi — bir xil `Promise.all` ichida bo'lsa
ham, u `byCategoryRaw`dan mustaqil so'rov bo'lgani uchun worker faol sinxronlanayotganda ikkisi
orasida bitta obyekt yangilanib qolsa, tepadagi karta pastdagi jadvaldan bir necha songa farq qilib
qolardi (poyga holati — `isInefficient` ustuni o'zi buzilmagan bo'lsa ham ko'rinadi). Effektiv
kategoriya=11 sharti `computeIsInefficient()` bilan matematik teng (`manualCategoryCode` faqat
9/10/null, `integrationCategoryCode` faqat 1–7/null bo'ladi), shuning uchun bitta so'rovdan olish
xavfsiz. Yangi dashboard agregat qo'shsangiz shu naqshni saqlang: bir xil hisoblanadigan ikki son
hech qachon ikkita alohida so'rovdan kelmasin.
⚠️ **Kat 3/4 "Ijara shartnoma soni"** — `rentContractCount` (API 5) EFFEKTIV kategoriyadan emas,
`hasPrivatizationLot`/`hasRentLot` bayroqlaridan taqsimlanadi (foydalanuvchi tasdiqlagan qoida):
obyekt xususiylashtirish lotida bo'lsa (ijara lotida ham bo'lsa ham) — kat 3 ga; **faqat** ijara
lotida bo'lsa — kat 4 ga. Ikkalasida ham lot yo'q bo'lsa (masalan faqat ijara shartnomasi, lot yo'q)
hech qaysi ustunga qo'shilmaydi. SQL: `SUM(cnt) FILTER (WHERE priv)` / `SUM(cnt) FILTER (WHERE rentlot
AND NOT priv)` (`stats.ts` → `rentRaw`).

⚠️ **Kat 1/3/4/7 "Ijaraga berilgan obyektlar soni"** — yuqoridagi "Ijara shartnoma soni" bilan
ARALASHTIRMANG: bu yerda **obyektlar soni** (`COUNT(*)`), u yerda **shartnomalar yig'indisi**
(`SUM(cnt)`). Kat 3/4 taqsimoti bir xil qoida (priv → kat 3, faqat rentlot → kat 4). Kat 1 (Sotilgan,
bo'lib to'lash) va kat 7 (Savdoga chiqarish jarayonida) — effektiv kategoriya (`cat = 1` / `cat = 7`)
bo'yicha, lot bayrog'iga bog'liq emas. SQL: `privLotRentedObjects`, `rentLotOnlyRentedObjects`,
`cat1RentedObjects`, `cat7RentedObjects` (`stats.ts` → `rentRaw`).

⚠️ **Kategoriyaga bog'liq bo'lmagan qo'shimcha ustunlar** — `buildDashboardColumns()`ning natijasi
EMAS (u faqat 1–12 kategoriya ustunlarini beradi), balki `dashboard/page.tsx` va
`/api/export/dashboard-categories`da **qo'lda**, aniq joyga qo'shiladi:
- **"Auksion savdolarida (Xususiy. va Ijara)"** — kat 4 ("Savdoda ijara") ustunidan DARHOL KEYIN
  joylashadi. `hasPrivatizationLot` **YOKI** `hasRentLot` (`rentBreakdown.onAnyAuction` — kat 3/4
  BIRLASHMASI, kesishma EMAS). ⚠️ Foydalanuvchi buni ikki bosqichda aniqlashtirdi: avval "bir
  vaqtda ikkalasida ham" (kesishma, 44 ta) deb so'ralgan va shunday qilingan, keyin "ikkalasiga ham
  tegishli bo'lsa faqat bittasini qo'sh" deb tuzatilgan — bu birlashma (AND emas, OR) ekanini
  bildiradi: kat3 (525) + kat4 (69) − kesishma (44) = 550. Ro'yxat filtri:
  `PropertyFilters.onAnyAuction` → `{ OR: [{ hasPrivatizationLot: true }, { hasRentLot: true }] }`.
- **"Ijaraga berilgan obyektlar"** — kat 6 ("Ijara shartnomasi bor") ustunidan DARHOL KEYIN
  joylashadi. Qiymati: `counts["5"] + counts["6"]` — ya'ni FAQAT effektiv kategoriyasi 5 yoki 6
  bo'lgan obyektlar (`rentBreakdown.onlyFreeOrPaidCategory`). ⚠️ Kat 5/6 ustunlarining o'z "Soni"si
  (`free.count`/`paid.count`) bundan FARQ QILADI — ular XUSUSIYAT bo'yicha (savdodagi/sotilgan
  obyekt ham kirishi mumkin), bu yangi ustun esa faqat SOF kat 5/6 obyektlarini sanaydi
  (foydalanuvchi aniq talab qilgan: "boshqa kategoriyalar... ularni qo'shma"). Ro'yxat filtri:
  `PropertyFilters.hasRentContract` → effektiv kategoriya `OR` (5 yoki 6), `rentContractCount`ga
  emas (aks holda kat 3/4dagi ijara shartnomali obyektlar ham kirib ketardi).
- **"To'liq ijara berilgan"** — jadval OXIRIDA, "Jami" ustuniga o'xshab: shartnoma bor (tekin
  foydalanish yoki pullik) VA `vacantArea = 0`. Ro'yxat filtri: `PropertyFilters.fullyRented`.

Barchasi `stats.ts` → `RegionCategoryRow.rentBreakdown`da hisoblanadi. Excel eksportida
(`route.ts` → `exportCols`) kategoriya ustunlari va bu ikkitasi **BITTA** massivga (`ExportCol[]`)
yig'iladi, so'ng kenglik/sarlavha/qiymat sikllari shu bitta massiv ustidan yuradi — 3 ta alohida
siklda `colIdx`ni mustaqil hisoblashdan ko'ra xavfsizroq (kategoriyalardan biri izohga
olinganda/qo'shilganda — masalan kat 8 — barcha sikllar avtomatik izchil qoladi).

Aniqlash qoidalari (`classification.ts` → `deriveAuctionCategory`, tartib muhim):
1. `order_statuses_id === 6` ⇒ sotilgan; `term_payment === 1` ⇒ kat 1, aks holda kat 2
   (⚠️ mezon `term_payment`, `details.tulov_muddati` **emas** — u sotuv bo'lib to'lash bo'lsa ham bo'sh keladi)
2. **API 6 da faol ijara loti** topilsa ⇒ kat 4 (Savdoda ijara). Bu kat 4 ning ASOSIY mezoni —
   API 4 dagi `group_name` real ma'lumotda hech qachon "ijaraga berish" bo'lmagan, va API 3/4
   ijara lotini umuman ko'rmasligi mumkin (shuning uchun `found` shartidan oldin tekshiriladi).
3. **haqiqiy** lot bor, sotilmagan ⇒ kat 3 (Savdoda xususiylashtirish)
4. lot yo'q, API 3 `status_name` ∈ {`Экспертиза`, `Баҳолашда`, `Хатловда`} ⇒ kat 7
5. ijara shartnomasi bor ⇒ jami summa 0 ? kat 5 : kat 6
- **Ustuvorlik:** auksion > ijara > boshqa

⚠️ **`lot_number: 0` — lot YO'Q degani.** `lotStr()` uni null'ga aylantiradi; oddiy `String()` ishlatilsa
`"0"` truthy bo'lib, obyekt noto'g'ri "savdoda" kategoriyasiga tushadi (bir marta 92 ta obyektni buzgan).

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
   manba qo'shib yuborgan. Hozir 14 hududning har biri uchun haqiqiy tashkilot nomi/STIR
   (`prisma/seed.ts` → `REGIONS`) bor, lekin manba **faqat hududda umuman manba bo'lmasa** yaratiladi —
   mavjud manbani qayta yozmaydi.
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
