---
name: hisobot
description: Dashboard/hisobot statistikasi — stats.ts (StatsScope, rentBreakdown, kat 3/4/5/6 qo'shimcha ustunlar), soha (?soha=) va tuman (?tuman=) kesimlari, hududiy=1 qoidasi, landSplit, vizual panel, xarita (services/map.ts) va kunlik snapshot. Dashboard soni, ustuni, eksporti, drill-down havolasi yoki panel grafigiga tegadigan ish uchun oching.
---
# Hisobot va dashboard statistikasi

CLAUDE.md dan ko'chirilgan (2026-10-12) — matn o'zgarishsiz.

### Tuman (District) kesimi

⚠️ **Kalit — NOM emas, `District.code` (API 2 `district_id`).** Jonli 5441 obyektda tekshirilgan:
bitta nom hech qachon ikki kodga tegishli emas, bitta kod hech qachon ikki hududda uchramaydi —
lekin bitta kodning NOMI ikki xil yozilishi mumkin ("Buxoro sh." / "Buxoro shahar"). Shuning uchun
`resolveDistrictId()` (`services/districts.ts`) kod bo'yicha upsert qiladi, nomni har safar yangilaydi.
"Urganch" va "Urganch tumani" — bu **turli kodlar** (shahar va tuman), dublikat emas.

Tuman API 2 bilan birga keladi, ya'ni faqat `refreshBase` yoqilgan sinxronizatsiyada yangilanadi
(`syncPropertyBase` va `checkPropertyStatus`). 205 tuman, 5443 obyektdan 5441 tasi bog'langan.

**Dashboard:** `?tuman=<regionId>` — bitta hudud qatorini ochadi va **IKKALA jadvalda ham**
(kategoriyalar + ijara shartnomalari) o'sha hududning tumanlarini ko'rsatadi. Bitta parametr,
ikkita toggle — qaysi jadvaldan ochsangiz ham ikkalasi birga ochiladi.
Ma'lumot: `computeDistrictStats` (kategoriyalar, `RegionCategoryRow`) va `computeDistrictRentStats`
(ijara, `RegionStat`) — ikkalasi ham keshlanmaydi. Tuman qatorlari hudud qatori bilan **bir xil
ustunlarni** ishlatadi, chunki bir xil tuzilma qaytaradi va bitta komponentdan render bo'ladi
(`CategoryTableRow` / `RentTableRow`).
⚠️ `stats.ts` → `groupTotalsRows()` — hudud va tuman darajasidagi umumiy jamlanma (obyekt, ijara,
shartnoma, maydon, summa) BITTA parametrlangan so'rovdan keladi; `toRegionStat()` ikkalasini ham
`RegionStat`ga aylantiradi.
⚠️ `RegionCategoryRow.regionId` tuman kesimida **tuman id'sini** saqlaydi — u "guruh identifikatori",
qat'iy hudud emas.
⚠️ `stats.ts`dagi `categoryCountRows()`/`rentBreakdownRows()` — hudud va tuman kesimining IKKALASI
ham shu ikki funksiyani chaqiradi (guruh ustuni parametr). Yangi ustun qo'shsangiz bir joyda
o'zgartirasiz; SQL'ni takrorlab yozmang.

**Obyektlar:** `?district=<District.id>` filtri (`buildWhere`), jadvalda "Tuman" ustuni, obyekt
sahifasida "Tuman" maydoni, Excel eksportida ustun. Tuman tanlagichi faqat **hudud tanlanganda**
ko'rinadi — aks holda 205 ta variant bitta ro'yxatga tushib ketardi.

### Manba (soha) kesimi — `?soha=`
⚠️ `OrganizationSource`da **ikkita nom** bor, aralashtirmang:
- **`name` = SOHA (guruh)** — "Ijara markazi", "Davlat aktivlari agentligi",
  "Bino va mol-mulklarni vaqtinchalik saqlash direksiyasi". Barcha filtrlar SHU bo'yicha
  guruhlaydi, shuning uchun bitta sohaning hamma yozuvida harfma-harf bir xil bo'lishi shart.
- **`orgName` = to'liq rasmiy tashkilot nomi** — faqat ko'rsatish uchun.

Ilgari ikkalasi bitta maydon edi va `seed.ts` uzun rasmiy nomlarni `name`ga yozardi — natijada
toza o'rnatishda 1 ta emas, 14 ta "soha" paydo bo'lardi va filtr butunlay buzilardi (bazada
qo'lda "Ijara markazi" deb tuzatilgani uchun bilinmay kelgan). Seed endi `name`ni **hech qachon
qayta yozmaydi** (admin UI'da qayta nomlagan bo'lishi mumkin), faqat `orgName`ni yangilaydi;
upsert kaliti — **STIR** (endi global unikal, `@@unique([regionId, stir])` emas: `regionId`
NULL bo'lganda Postgres NULL'larni farqli deb hisoblab dublikatni o'tkazib yuborardi).

**Respublika darajasidagi manba** — `regionId = null` (Agentlik, Direksiya). Ularning obyektlari
istalgan hududda bo'lishi mumkin, shuning uchun hudud **kadastr raqamining birinchi bo'lagidan**
aniqlanadi (`Region.cadastrePrefix`, 2419 jonli obyektda 100% mos tekshirilgan):
`10`=Toshkent sh. `11`=Toshkent v. `12`=Sirdaryo `13`=Jizzax `14`=Samarqand `15`=Farg'ona
`16`=Namangan `17`=Andijon `18`=Qashqadaryo `19`=Surxondaryo `20`=Buxoro `21`=Navoiy
`22`=Xorazm `23`=Qoraqalpog'iston.
⚠️ Prefiks noma'lum bo'lsa obyekt **o'tkazib yuboriladi** (log'ga yoziladi), tasodifiy hududga
yozilmaydi — butun dashboard hudud kesimida qurilgan.
⚠️ `triggerRegionSync()` hududsiz manbalarni ham qo'shadi (`OR: [{regionId}, {regionId: null}]`)
va `SyncSourceJob.filterRegionId` orqali fan-out'da faqat mos prefiksli kadastrlarni oladi —
API 1 tashkilotning BARCHA kadastrlarini qaytargani uchun filtr shu bosqichda bo'lishi shart.
`syncSource.ts`da `totalCount` `cadastres.length` emas, **`jobs.length`** bilan oshiriladi
(filtrlangan kadastr leaf job bermaydi — aks holda run hech qachon yakunlanmasdi).

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

### Dashboard doirasi — `StatsScope` (2026-07-30)
Statistika funksiyalari (`computeDashboardStats`, `computeDistrictStats`,
`computeDistrictRentStats`, `computeDistrictStatsByRegion`) endi **bitta `StatsScope` obyekti**
qabul qiladi — ilgari `sourceName?: string` edi:
```ts
{ sourceName?: string;      // foydalanuvchi TANLAYDIGAN soha filtri (manba tugmalari)
  sourceIds?: string[]|null } // ROL doirasi (userSourceScope), foydalanuvchi o'zgartira olmaydi
```
Ikkalasi **AND** bilan birikadi. `sourceIds: []` (biriktirilmagan foydalanuvchi) ⇒ SQL sharti
`FALSE`, ya'ni hamma joyda 0. Qiymatlar `Prisma.join` bilan parametrlanadi.

⚠️ **Doirani uzatishni unutmang** — `getDashboardStats(scope)` kesh kaliti argumentdan
quriladi, ya'ni uzatilmasa cheklangan foydalanuvchiga boshqa birovning keshlangan natijasi
qaytishi mumkin. Ikkala Excel eksporti ham (`dashboard-categories`, `dashboard-rent`) doirani
qo'llaydi — aks holda moderator ekranda o'z tashkilotini ko'rib turib, eksport orqali butun
bazani yuklab olardi.

**Hududiy boshqarmaga biriktirilgan foydalanuvchi** (masalan "Ijara markazi — Andijon") uchun
hudud jadvali bitta qatordan iborat bo'lardi, shuning uchun uning hududi **tumanlar kesimida
avtomatik ochiladi** (`dashboard/page.tsx` → `autoTuman`). Yopish uchun `?tuman=none`.
Respublika darajasidagi tashkilot yoki bir nechta hudud bo'lsa — avtomatik ochilmaydi.
Manba tugmalari ham cheklanadi: faqat o'z tashkilotlarining sohalari ko'rsatiladi.
⚠️ `computeDistrictStatsByRegion()` butunlay bo'sh hudud guruhlarini tashlaydi — aks holda
bitta tashkilotga cheklangan foydalanuvchining Excel eksportida 14 hudud × 205 tuman nol
qator chiqardi (cheklovsiz foydalanuvchida har bir hududda obyekt bor, natija o'zgarmaydi).

**Ekranda ham shu printsip** (`dashboard/page.tsx` → `catRows`/`rentRows`): doira cheklangan
bo'lsa (`scopeIds !== null`) obyekti yo'q hudud qatorlari yashiriladi, va **bitta hudud qolganda
"J A M I" qatori ham ko'rsatilmaydi** (u o'sha yagona qatorning aynan nusxasi bo'lardi —
`showCatTotals`/`showRentTotals`). Cheklovsiz foydalanuvchida rasmiy hisobot shakli (14 hudud +
JAMI) o'zgarmaydi. Tashkilotda obyekt bo'lmasa jadval bo'sh qolmaydi — tushuntirish qatori chiqadi.

Hisobot kartalari (2026-10-21 dan 6 ta): Jami, Bo'sh turgan, Bo'sh turgan maydoni, **Savdoda
xususiylashtirish**, **Savdoda ijara** va **Ijara shartnomasi bor**. Savdo kartalari `COLUMNS` dagi
3/4-ustun getterlarini (maydon kichik ustunisiz) yig'adi — ya'ni jadvaldagi JAMI bilan va
`?category=3/4` ro'yxati bilan aynan bir xil (xususiyat mezoni, effektiv kategoriya EMAS).
"Ijara shartnomasi bor" — `s.totals.rentedObjects` (`rentContractCount > 0`, tekin+pullik), ijara
jadvalining "Ijaraga berilgan" JAMI'si; havola `hasAnyRentContract=1`. ⚠️ 6-ustun (kategoriya
"Ijara shartnomasi bor") bilan ADASHTIRMANG — u faqat pullik.

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
1. `order_statuses_id === 6` **yoki lot holati "Сотилган"** (`isSoldLotStatus`, 2026-10-09 —
   buyurtma holati kechikib o'tadi, jonli 5 ta) ⇒ sotilgan; `term_payment === 1` ⇒ kat 1, aks holda kat 2
   (⚠️ mezon `term_payment`, `details.tulov_muddati` **emas** — u sotuv bo'lib to'lash bo'lsa ham bo'sh keladi)
2. **API 6 da faol ijara loti** topilsa ⇒ kat 4 (Savdoda ijara). Bu kat 4 ning ASOSIY mezoni —
   API 4 dagi `group_name` real ma'lumotda hech qachon "ijaraga berish" bo'lmagan, va API 3/4
   ijara lotini umuman ko'rmasligi mumkin (shuning uchun `found` shartidan oldin tekshiriladi).
3. **haqiqiy** lot bor, sotilmagan **va lot ochiq** ⇒ kat 3 (Savdoda xususiylashtirish).
   ⚠️ `isLotOpen()` (2026-10-09, foydalanuvchi qarori) — OQ RO'YXAT: lot holati
   "...arizalarni qabul qilish" VA savdo sanasi bugun yoki keyin. Boshqa hamma holat
   (sotilmadi, to'xtatildi, bekor qilindi, yakunlandi, komissiyaga topshirildi, sanasiz
   "Савдода") kat 3 dan CHIQADI → ijara shartnomasi bo'lsa 5/6, aks holda 11. Sabab: API 3
   OXIRGI buyurtmani qaytaradi, tugagan bo'lsa ham (jonli: 793 tadan ~124 ta). Mezon davijara
   "taklif etilayotgan" bilan AYNAN bir xil — farq faqat obyekt/lot (bitta lot 2 kadastrda).
   `hasPrivatizationLot` ham shu shart bilan (`checkPropertyStatus.ts`); `AuctionLot` yozuvi
   saqlanaveradi (tarix). Bayroq sync paytida hisoblanadi — savdo kuni o'tgach keyingi
   sync'gacha (kuniga bir marta) kat 3 da turadi.
4. lot yo'q, API 3 `status_name` ∈ {`Экспертиза`, `Баҳолашда`, `Хатловда`} ⇒ kat 7
5. ijara shartnomasi bor ⇒ jami summa 0 ? kat 5 : kat 6
- **Ustuvorlik:** auksion > ijara > boshqa

⚠️ **`lot_number: 0` — lot YO'Q degani.** `lotStr()` uni null'ga aylantiradi; oddiy `String()` ishlatilsa
`"0"` truthy bo'lib, obyekt noto'g'ri "savdoda" kategoriyasiga tushadi (bir marta 92 ta obyektni buzgan).

Kategoriya kodini o'zgartirishdan oldin `manualCategoryCode` ishlatilganini tekshiring.

## Boshqaruv paneli — vizual panel + xarita (2026-09-05)

`/dashboard` — **vizual xulosa** (kartalar, grafiklar, xarita). Rasmiy hisobot shakli
(uchta jadval) `/dashboard/hisobot` ga ko'chdi. Ikkalasi bir xil
`resolveDashboardScope()` (`app/dashboard/scope.ts`) va bir xil `getDashboardStats()`
dan oziqlanadi — ekrandagi sonlar hech qachon ajralib qolmaydi.

**Panel hudud filtri (2026-10-21)** — `DashboardFilterBar.tsx`: sarlavha + Manba + Hudud,
STICKY (mobil'da `top-[60px]` — Sidebar paneli ostida, yopishganda sarlavha yashiriladi).
`?region=` → `StatsScope.regionId` → `sourceCond()`/`sourceWhere()`/`snapshotCond()` — ya'ni
kartalar, kategoriya, trend, KPI tarixi va xarita BIR joydan filtrlanadi. ⚠️ `Property.regionId`
bo'yicha, respublika tashkilotlarining shu hududdagi obyektlari HAM kiradi — shuning uchun
karta havolalari `region=` ni `hududiy=1` SIZ oladi (son = ro'yxat). Hudud tanlanganda
reyting va maydon grafiklari TUMANLAR kesimida (`computeDistrictStats/RentStats`, ular
respublika tashkilotlarini chiqaradi → havola `district=…&hududiy=1`). `SourceFilter`
`extraQs` bilan hudud tanlovini saqlaydi. Xarita: `lockedRegion` (o'z hudud tanlagichi
yashirin) + `fitOnMount` (birinchi chizishda hududga yaqinlashadi). Hisobot sahifasiga
bu filtr QO'SHILMAGAN (u yerda hudud — jadval qatorlari).

⚠️ **`SourceFilter` ga `basePath` propi MAJBURIY** — ilgari `/dashboard` qattiq
yozilgan edi va hisobotdagi manba tugmasi foydalanuvchini vizual panelga otib yuborardi.

Yangi umumiy qatlam: `lib/format.ts` (`nf`/`km`/`pct1`/`money` — **yagona joy**,
ilgari hisobot ichida lokal edi) · `lib/chartColors.ts` · `lib/geo.ts` ·
`components/{ui,charts,map}` · `services/{trends,map,snapshots}.ts`.

⚠️ **Matn SERVERDA formatlanadi.** `toLocaleString("uz-UZ")` Node'da `1 167`,
brauzerda `1,167` beradi — client grafik komponentiga tayyor SATR uzatiladi
(`countLabel`/`pctLabel`/`label`), son emas. Aks holda gidratsiya buziladi.

⚠️ **Recharts'da `isAnimationActive={false}` HAR BIR seriyada.** React 19 dev
rejimida ikki marta render bo'ladi va animatsiya yoqiq bo'lsa halqa/ustunlar bo'sh
`<g>` bo'lib qoladi (donutda aynan shu bo'lgan). `cx`/`cy` ham foiz emas, SON.

⚠️ **Panel "Kategoriya taqsimoti" — hisobotning JAMI qatori bilan AYNAN bir xil**
(2026-09-12, foydalanuvchi talabi: "izoh qo'shma, xuddi hisobotdagidek chiqar").
Sonlar `buildDashboardColumns()` ning "Soni" sub-ustunlari yig'indisi, ya'ni
3/4/5/6/12 XUSUSIYAT bo'yicha va kartalar yig'indisi jamidan katta. Shu sabab halqa
diagramma olib tashlandi (bo'laklar kesishardi) — o'rniga `CategoryBars` (ustunlar).
Ilgari halqa effektiv kategoriya taqsimotini ko'rsatardi va hisobotdan farq qilardi
(kat 3: 546 ↔ 631, kat 12 umuman yo'q edi). Havola sonning o'zi bilan bir mezonda:
bitta "Soni" → hisobot katagining havolasi (`category=N` + `qsExtra`); `landSplit`
kat 1–4 (Yer+Bino — effektiv kategoriyadan sanaladi) → `effectiveCategory=N`.

### Xarita — `services/map.ts` + `components/map/`

Koordinata `Property.lat/lng` da (`coordSource`, `coordsAt`). ⚠️ Manbasi —
`ObjectStatusCheck.rawResponse.$.api4`, ya'ni **auksion LOTINING nuqtasi**, kadastr
chegarasi emas; qamrov ~31% (faqat auksionga chiqqan obyektda bor). Ikkalasi ham
xarita sarlavhasida OCHIQ yoziladi.

⚠️ **Koordinata `refreshAuction` blokidan TASHQARIDA yoziladi** — bino auksion
tugagani uchun joyidan ko'chmaydi, ya'ni lot topilmasa `null` ga qaytarilmasligi kerak.
⚠️ **Standart Leaflet markeri ISHLATILMAYDI** — `marker-icon.png` `/obyektlar`
sub-path ostida 404 beradi. O'rniga ichki SVG'li `L.divIcon` pin (`components/map/pin.ts` →
`pinIcon()`, davijara.uz xaritasidagi shakl, 2026-09-12) — rasm fayli kerak emas.
Obyekt sahifasida ("Kategoriya biriktirish" ustida) kichik xarita — `ObjectLocationMap.tsx`:
bitta pin, g'ildirak-zoom o'chiq, o'rami `MapSection.tsx` → `ObjectMapSection` (2026-09-22).
⚠️ Hover kattalashtirish ICHKI `svg`da (`globals.css` → `.dm-pin`): marker elementining
o'z `transform`ini Leaflet joylashtirish uchun ishlatadi.
⚠️ `ssr:false` Server Component ichida build xatosi beradi — oraliq `"use client"`
o'ram (`MapSection.tsx`) shu uchun bor.
Tile manzili `MAP_TILE_URL` env orqali (standarti OSM); `tileerror` da ogohlantirish
chiqadi, nuqtalar baribir chiziladi.

**Xarita filtri (2026-10-21, `MapExplorer.tsx`)** — kategoriya (tugmalar, sanoq bilan),
hudud → tuman. ⚠️ FAQAT xaritaga ta'sir qiladi (foydalanuvchi tanlovi) — client'da,
server so'rovisiz. Kategoriya = pin rangi (`MapPoint.cat`, effektiv), dashboard
jadvalidagi 3/4/5/6/12 ustunlaridan farq qilishi mumkin. `MapPoint.r`/`d` — `MapData.regions`/
`districts` dagi INDEKS (cuid emas — payload). Hudud almashsa tuman tozalanadi; soha
almashsa `key` orqali butun filtr. Filtr o'zgarganda `PropertyMap` `focusKey` bo'yicha
ko'rinadigan nuqtalarga yaqinlashadi (`fitBounds`). "Hududlar" rejimi (pufakchalar)
olib tashlangan — `MapData` da `bubbles` yo'q. Hudud/tuman tanlagichi native `<select>`
EMAS, `components/ui/Dropdown.tsx` (ochilgan ro'yxat ilova uslubida, `z-[1100]` —
Leaflet ustida). Qamrov izohi sarlavha bilan bir qatorda.
To'liq ekranda g'ildirak Ctrl'siz kattalashtiradi (sahifa aylanmaydi), oddiy holatda —
faqat Ctrl bilan.
Kesh kaliti `dashboard-map-v3` (shakl o'zgarganda oshiring).

### Kunlik snapshot — `services/snapshots.ts` + `DashboardSnapshot`

`Property` ning statistika ustunlari har sinxronizatsiyada ustidan yoziladi, ya'ni
"kecha nechta obyekt bo'sh turgan edi" degan savolga bazada javob yo'q. Snapshot shu
bo'shliqni to'ldiradi.

- Gran **`(day, sourceId, regionId)`** — birlamchi kalitning O'ZI, NULL yo'q. Barcha
  kesimlar (rol doirasi, soha, hudud) shundan YIG'INDI bilan tiklanadi.
- ⚠️ `soha` (nom) ustuni ATAYLAB yo'q: `OrganizationSource.name` admin UI'da qayta
  nomlanishi mumkin → tarix ikkiga bo'linardi. JOIN joriy nomni beradi.
- Cron `QUEUE.DASHBOARD_SNAPSHOT`, **`0 2 * * *` Asia/Tashkent — kunlik sync (03:00)
  dan OLDIN**: sync o'rtasidagi o'lchov yarim yangilangan holatni yozib, trendda
  soxta sakrash berardi. Faol `SyncRun` bo'lsa o'tkazib yuboriladi (log'ga yoziladi).
- Qo'lda olish: `/dashboard/sync` → "Kunlik snapshot olish" (navbatga qo'yilmaydi,
  DARHOL bajariladi — worker o'chiq bo'lsa ham birinchi kun ma'lumot yozilsin).
- ⚠️ **Tarixni backfill qilib BO'LMAYDI.** `< 2` kun bo'lsa grafik UMUMAN
  ko'rsatilmaydi (`MIN_DAYS`) — bitta nuqtadan chiqadigan tekis chiziq "hech narsa
  o'zgarmadi" degan yolg'on xulosa berardi.
- ⚠️ Bu faylni **worker ham import qiladi** (`tsx`, Next'siz). Yozish yo'li faqat
  xom SQL ishlatadi va `unstable_cache` ga tegmaydi — kesh o'rami (`getKpiHistory`)
  Next so'rov konteksti tashqarisida chaqirilsa yiqiladi.

⚠️ **Hodisaviy trendlar** (`services/trends.ts`) snapshotga bog'liq EMAS va birinchi
kundanoq ishlaydi — manbasi `RentContract.contractDate` / `AuctionLot.auctionDate`.
`AuctionLot` har sinxronizatsiyada qayta yoziladi, ya'ni auksion trendi haqiqiy tarix
emas — grafik ostida shu ochiq yoziladi.

### ⚠️ Hudud havolalarida `hududiy=1` MAJBURIY

Hudud va tuman qatorlari respublika darajasidagi tashkilotlarni ("Markaziy apparat")
o'z ichiga OLMAYDI — ular alohida qatorda hisoblanadi. Lekin ularning obyektlari
kadastr prefiksi orqali oddiy hududlarga tarqalgan, ya'ni oddiy `?region=<id>`
havolasi ularni QAYTA olib kirardi va ro'yxatdagi son jadvaldagidan katta chiqardi
(jonli o'lchov: Toshkent sh. — 47 ↔ 71, 24 ta obyekt Agentlik markaziy apparatiniki).

- Ta'rif **yagona joyda**: `stats.ts` → `NATIONAL_SOURCE` (`recentPaymentCutoff()`
  naqshi). `nationalOrgRows()` ham, `buildWhere()` ham shundan oziqlanadi.
- Ro'yxat filtri: `PropertyFilters.regionBoundSource` → URL'da `hududiy=1`.
- Hisobotda havolalar `regionScope()` / `districtScope()` orqali quriladi — qo'lda
  `region=...` yozmang.
- ⚠️ **JAMI qatoriga va `tashkilot=<id>` qatoriga QO'SHILMAYDI** — birinchisi butun
  doira bo'yicha, ikkinchisi aynan o'sha tashkilot bo'yicha.

### ⚠️ `landSplit` sohalarda grafik BUTUNLAY binolar bo'yicha

"Davlat aktivlari agentligi"/"Direksiya" tanlanganda hududlar reytingi jami ham,
bo'sh turgan ham, ikkala havolasi ham binolardan quriladi
(`landSplit.total.building` va `rentBreakdown.vacant.buildingCount`, `&isLand=0`).
Ilgari ustun balandligi `r.inefficient` (yer + bino) dan olinib havola `&isLand=0`
bilan ochilardi: Andijonda ustun **256**, ro'yxat **9** ta obyekt berardi.
