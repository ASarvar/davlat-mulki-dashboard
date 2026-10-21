# Davlat mulki monitoring platformasi

Davlat mulki obyektlaridan foydalanish samaradorligini kuzatuvchi **ichki (internal)** veb-platforma.
14 hudud, hozircha ~2400 obyekt, 70–80k gacha o'sishi rejalashtirilgan. Interfeys **o'zbek tilida**.

## Stack

Next.js 15 (App Router) · TypeScript strict · Prisma + PostgreSQL.
Navbat — **pg-boss**, ya'ni **Redis YO'Q** (`package.json` buni aytmaydi).
Qolgan bog'liqliklar `package.json` da.

**Ikki muhit — chalkashtirmang:**
- **Dev (Windows) — Docker YO'Q.** Postgres native (**5433-portda**), `.env`, `npm run dev`,
  worker alohida jarayon. Ish tartibi o'zgarmagan.
- **Production (Linux) — Docker.** 4 servis: `db` (postgres:15) · `migrate` (bir martalik) ·
  `web` · `worker`. Sozlamalar `.env.production` da, batafsil — `DEPLOY.md`.

## Buyruqlar

Ro'yxati `package.json` → `scripts` da. Undan chiqmaydigan ikki shart:

- **`npm run dev` — 3000-port MAJBURIY** (`NEXTAUTH_URL` unga bog'langan).
- **`npm run worker` — sinxronizatsiya ISHLASHI UCHUN SHART** (alohida jarayon).

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
status-check   API 3+4 (auksion zanjiri) + API 5 (ijara) + API 6 (ijara loti) → kategoriya
```

- `src/server/integrations/` — tashqi API mijozlari. `http.ts` markaziy: retry/backoff, rate-limit,
  Basic/Bearer auth, `shouldRetry` (body ichidagi vaqtinchalik xatolar uchun).
- `src/server/services/` — biznes mantiq. `classification.ts` kategoriyani aniqlaydi,
  `properties.ts` `buildWhere()` orqali rol/hudud doirasini **bir joyda** saqlaydi (ro'yxat + eksport ishlatadi).
- **Eski kadastr fallback:** har bir tekshiruv avval yangi, topilmasa eski kadastr bilan urinadi.
  Real ma'lumotda obyektlarning ~86% ida eski kadastr bor — bu asosiy yo'l, istisno emas.

### Sinxronizatsiya

Sync turlari, modullar, kunlik cron, osilib qolgan run himoyasi va ijara auksioni
hodisalari (online-ijara `auction_logs`, har daqiqada) — to'liq hujjat
**`sync` skill'ida** (`.claude/skills/sync/SKILL.md`). `src/server/queue/` ga tegsangiz oching.
⚠️ Real vaqt FAQAT IJARA uchun — online-ijara jadvallarida xususiylashtirish yo'q. Kat 3 —
ish kuni jadvali (`priv-refresh-*`, savdolar 10:00 da) + kunlik 03:00.
⚠️ Agentlik va Direksiya sohalari HECH QANDAY avtomatik yangilanishga kirmaydi — faqat qo'lda
(`MANUAL_ONLY_SOHAS`, `lib/sourceLabel.ts`).

### Rollar (7 ta)
- `SUPER_ADMIN` — hammasi.
- `ADMIN` — super admin bilan bir xil, lekin super adminni ko'rmaydi/boshqarmaydi.
- `RAHBARIYAT` — **cheklovsiz**; so'rovni **yakuniy tasdiqlaydi** (2-bosqich);
  qo'lda biriktirilgan kategoriyani "Bo'sh turgan"ga qaytara oladi (`removeManualCategory`).
- `MODERATOR` — **KO'RISHDA cheklanmaydi** (kuzatuvchi kabi hamma obyekt, so'rovlar tarixi va
  dashboard); biriktirilgan **tashkilot(lar)** (`UserSource` yoki `allSources`) so'rovlarini
  **qabul qiladi** (1-bosqich) yoki rad etadi. To'g'ridan-to'g'ri biriktira **olmaydi**.
  ⚠️ **Ko'rish va tasdiqlash doiralari AJRALGAN** (2026-07-31): tashkilot doirasi faqat
  `listPendingRequests()` + `assertSourceWriteAccess()` da qo'llanadi. Dashboardda esa u
  **standart tanlov** — sahifa parametrsiz ochilganda o'z tashkiloti ko'rinadi (tumanlar
  kesimida), "Manba" tugmalaridan boshqasini tanlasa cheklov bekor bo'ladi. Qaytish uchun
  moderatorga **"Mening tashkilotim"** tugmasi ko'rsatiladi (`SourceFilter` → `showOwn`).
  `IJROCHI` uchun esa doira **qat'iy** — u boshqa tashkilotni umuman ko'ra olmaydi.
- `IJROCHI` — aynan bitta **tashkilot** (`User.sourceId`); "Bo'sh turgan" obyektni Yaroqsiz/Chekka'ga
  biriktirish **so'rovini** yuboradi (darhol emas).
- `VIEWER` — faqat ko'rish.
- `IMTIYOZ` ("Imtiyoz operatori", 2026-09-23) — **FAQAT** `/dashboard/imtiyoz`. Tashkilot
  biriktirilmaydi, `userSourceScope()` → `[]`. Obyektlar/hisobot/so'rovlar bo'limlarining
  `allowRoles`i `STAFF_ROLES` (= `ALL_ROLES` − `IMTIYOZ`), ya'ni bazada `EVERYONE` bo'lsa ham
  unga ochilmaydi. Eksport va hujjat route'lari ham `canAccess()` bilan yopilgan.

⚠️ Enum `NAZORATCHI` → `IJROCHI` deb qayta nomlangan (migratsiya `20260725120000_rahbariyat_two_stage`).
Yorliqlar `src/lib/roles.ts` → `ROLE_LABEL` da; kodda rol satrini qo'lda yozmang.

### ⚠️ Foydalanuvchi doirasi — HUDUD emas, TASHKILOT (2026-07-30)
Migratsiya `20260730120000_user_source_scope`: `User.regionId`→`sourceId`,
`allRegions`→`allSources`, `UserRegion`→`UserSource`. `authz.ts` → **`userSourceScope()`** va
**`assertSourceWriteAccess(user, sourceId)`** (`Property.sourceId` majburiy bo'lgani uchun cheklash
bo'shliqsiz). Rol yorlig'i ham "Hudud ijrochisi"dan **"Ijrochi"**ga o'zgardi.

⚠️ **Hudud va tashkilot — bir-biriga bo'ysunmaydigan ikki o'lchov.** Respublika darajasidagi
tashkilot (`OrganizationSource.regionId = null` — Direksiya, Agentlik markaziy) obyektlari kadastr
prefiksi orqali BARCHA hududlarga tarqaladi. Ya'ni bunday tashkilotga biriktirilgan ijrochi bir
nechta hududdagi obyektni ko'radi — bu kutilgan xulq, xato emas. Shu sabab:
- rol nomida "hudud" yo'q;
- `buildWhere()`da hudud endi FAQAT foydalanuvchi tanlaydigan filtr (`f.regionId`), doira emas;
- obyektlar sahifasida hudud tanlagichi **hamma rolga** ko'rinadi (ilgari IJROCHI'dan yashirilgan edi).

⚠️ Migratsiya mavjud bog'lanishlarni **ko'chirmaydi** (foydalanuvchi qarori) — "hududdagi barcha
tashkilotlar" deb ko'chirish respublika tashkilotlari obyektlarini yo'qotardi, ularni qo'shish esa
doirani 14 hududga kengaytirardi. Ijrochi/moderator tashkilotsiz qoladi va **hech narsa ko'rmaydi** —
`/dashboard/users`da qo'lda biriktiriladi (UserRow'da "⚠ Tashkilot biriktirilmagan" belgisi chiqadi).

**Email YO'Q — `username` (login) + parol.** Ochiq ro'yxatdan o'tish yo'q; userlarni faqat
SUPER_ADMIN/ADMIN qo'shadi (ADMIN, ADMIN/SUPER_ADMIN yarata olmaydi). Sync/Manbalar/Userlar —
faqat SUPER_ADMIN+ADMIN. RAHBARIYAT `userSourceScope()`da `null` (cheklovsiz).

**Sessiya (2026-09-10):** JWT, **1 soat faolsizlik** (`SESSION_IDLE_SECONDS`, sirpanuvchi —
middleware har so'rovda qayta imzolaydi). Parol almashtirilsa `User.sessionVersion` +1 va
`getCurrentUser()` token versiyasini bazadagi bilan solishtiradi → barcha qurilmadagi
sessiyalar bekor. ⚠️ Sahifa qo'riqchisi `requireUserOrRedirect()` (`/session-expired` →
`signOut` → login); `requireUser()` esa XATO tashlaydi — uni redirect qiladigan qilmang,
server action'lar uni `try/catch` ichida chaqiradi va redirect yutilardi.

### Bo'limlar ko'rinishi — `SectionAccess`

Sahifa qaysi rolga ko'rinishi bazadan boshqariladi — to'liq hujjat **`sections` skill'ida**
(`.claude/skills/sections/SKILL.md`).

⚠️ **YANGI SAHIFA QO'SHSANGIZ IKKI QADAM MAJBURIY:** `lib/sections.ts` → `SECTIONS` ga qator
(+ `Sidebar.tsx` → `ICONS`) va sahifa boshida `await requireSection("<key>")`. Qator yo'q =
`SUPER_ONLY` (fail-closed), shuning uchun migratsiyada mavjud bo'limlar qatori yozilishi shart.
⚠️ **Bo'limni yashirish uning API route'ini yashirmaydi** — har bir `route.ts` va server
action ham `requireSection(key)` bilan boshlanadi.

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

Biriktirish formasi: **1 (Sotilgan), 9 (Yaroqsiz), 10 (Chekka)** — `ASSIGNABLE_CATEGORY_CODES`, raqamsiz.
⚠️ **Kat 1 formada "Sotilgan" deb ko'rinadi**, lekin saqlanganda kategoriya 1 —
"Sotilgan (Bo'lib to'lash sharti bilan)" bo'lib yoziladi (foydalanuvchi qarori, 2026-08-25:
qo'lda biriktiriladigan sotuv har doim bo'lib to'lash sharti bilan hisoblanadi, shuning
uchun kat 2 formaga qo'shilmadi). Yorliq `lib/categories.ts` → `ASSIGN_FORM_LABEL` /
`assignFormLabel()` da; kategoriyaning `nameUz` sini O'ZGARTIRMANG — u dashboard
ustunlarida, yorliqlarda va Excel eksportida ishlatiladi.
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
| **cad** | `GET {CADDATA_BASE_URL}?tin={STIR}&cad_number={CAD}` | Basic (`CADDATA_*`) |
| 2 | `GET {API2_BASE_URL}?num={CAD}&token={API2_TOKEN}` | token **query'da**, headerda emas |
| 3 | `POST {API3_BASE_URL}` body `{cad_number}` | Basic (`AUCTION_API_*`) |
| 4 | `GET {API4_BASE_URL}?order={order_id}` | Basic (bir xil juftlik) |
| 5 | `POST {API5_BASE_URL}` body `{cadastre_number}` | Basic (`API5_*`) |
| 6 | `POST {API6_BASE_URL}` body `{cad_number}` | Basic (`API6_*`) |
| suv | `GET {WATER_API_BASE_URL}?cad_number={CAD}` | Basic (`UTILITY_API_*`) |
| gaz | `GET {GAS_API_BASE_URL}?cad_number={CAD}` | Basic (bir xil juftlik) |
| elektr | `GET {ELECTRIC_API_BASE_URL}?cad_number={CAD}` | Basic (bir xil juftlik) |
| xodimlar | `GET {IMTIYOZ_COMP_WORKERS_URL}?tin&year&period&page&size` | Basic (`IMTIYOZ_API_*`) |
| YATT | `GET {IMTIYOZ_YATT_WORKERS_URL}?page&size` | Basic (bir xil juftlik) |
| TIEK | `GET {IMTIYOZ_TIEK_URL}?pinfl={PINFL}` | Basic (bir xil juftlik) |

⚠️ Oxirgi uchtasi — **ijara imtiyozi** (ПҚ-3782, pastdagi bo'limga qarang), obyektlarga aloqasi yo'q.
Ular ham `markaz` shlyuzida va odatda kommunal bilan bir xil Basic juftlikda, lekin **alohida
sozlanadi** (kelajakda ajralishi mumkin). ⚠️ `IMTIYOZ_YATT_WORKERS_URL` tadbirkor bo'yicha
FILTRLAMAYDI — butun respublikani qaytaradi, shuning uchun u faqat indeks qurish uchun.

**Parametr nomlari taxminga tayanmaydi** — har biri jonli sinovda aniqlangan va `.env` orqali
sozlanadi (`API3_PARAM`, `API4_PARAM`, `API5_PARAM`). API 1 da javobda `inn`, so'rovda esa `num` edi.

### Kommunal xizmatlar (suv/gaz/elektr) — `integrations/utilities.ts`

Uchta ALOHIDA vendor, javob tuzilmalari o'xshamaydi va "topilmadi" HTTP **200 +
body ichida** keladi (404 emas). Qamrov ~4%, 14 hududga tarqalgan. **Kategoriyaga
ta'sir qilmaydi.** To'liq hujjat — **`kommunal` skill'ida**
(`.claude/skills/kommunal/SKILL.md`).

### Kadastr ma'lumotlari va API tuzoqlari

`cad_data` (API 2 o'rnida, STIR majburiy), koordinata, maydon zanjiri (`lib/area.ts`) va
API 2/3/4 tuzoqlari — to'liq hujjat **`kadastr` skill'ida** (`.claude/skills/kadastr/SKILL.md`).
⚠️ Kadastr raqamida `/` bor — URL faqat `src/lib/cadastre.ts` orqali. Xom javoblar
(`ObjectStatusCheck.rawResponse`, `Property.rawApi2`) saqlanishda davom etsin. API 2 ni
sozlamadan olib tashlamang (zaxira va holder-lookup unga tayanadi).

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
⚠️ **`hasPrivatizationLot`ni `AuctionLot` YOZUVI saqlanadimi degan shartga ISHLATMANG** —
`checkPropertyStatus.ts`da bir marta shunday qilingan edi: natijada obyekt sotilgach uning
`AuctionLot` qatori har qayta sinxronlanganda o'chirilib, qayta yaratilmasdi (sabab: bayroq
`!isSold`ni talab qiladi). Ro'yxatda (`Property.lotNumber`, alohida materiallashtirilgan) lot
ko'rinar, obyekt sahifasida (`auctionLots` relation) esa "0" chiqardi. To'g'ri: yozuv saqlash
sharti — `auction.found && auction.lotNumber`, sotilgan-sotilmaganidan qat'i nazar (`auctionLotExists`
o'zgaruvchisi). Tuzatilgandan keyin ham eski obyektlar uchun tarixiy qayta tiklash kerak —
`/dashboard/sync` → "Holat yangilash" → faqat **Auksion** belgilab, hudud/soha bo'sh (=hammasi).

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

### Hisobot va dashboard statistikasi

Tuman/soha kesimi, `StatsScope` (rol doirasi), kategoriyadan tashqari ustunlar, `hududiy=1`,
`landSplit`, vizual panel, xarita va kunlik snapshot — to'liq hujjat **`hisobot` skill'ida**
(`.claude/skills/hisobot/SKILL.md`). Dashboard soni yoki havolasiga tegsangiz o'sha skill'ni oching.
⚠️ Asosiy qoida: jadvaldagi son va bosilganda ochiladigan ro'yxat BITTA mezondan (`buildWhere()`)
kelishi shart; raw SQL faqat `Prisma.sql` bilan parametrlangan.

### Kommunal jadvali va ro'yxat ko'rinishi

Dashboardning 3-jadvali (`computeUtilityStats`, faqat kat 11 bo'yicha, `landSplit`
sohalarda faqat bino) va `?utility=` ixcham ro'yxat ko'rinishi — to'liq hujjat
**`kommunal` skill'ida** (`.claude/skills/kommunal/SKILL.md`).

### Obyektlar filtri (`ObjectFilters.tsx`) — uchta qoida

Oddiy GET forma (client JS faqat qulaylik uchun). Tuzilishi: asosiy qator (Kadastr, Soha,
Tashkilot, Hudud) + "Qo'shimcha" ochiladigan bo'lim (Tuman, Kategoriya, Samaradorlik).
Barcha `select`lar o'zgarishi bilan darhol yuboriladi; matn maydoni Enter/tugma kutadi.

⚠️ **1. Kaskad filtrlarda ota o'zgarsa, BOLA tozalanishi shart** (`Dropdown` → `resetOnChange`).
Soha → tashkilot va hudud → tuman juftliklari `buildWhere()`da **AND** bilan birikadi, ya'ni
eski bola qiymati yangi ota bilan qolib ketsa natija jimgina **bo'sh** chiqadi va sababi
ekranda ko'rinmaydi.

⚠️ **2. "Qo'shimcha" bo'limi `hidden` bilan yashiriladi, shartli render EMAS.** Yopiq holatda
ham uning maydonlari DOM'da qolishi kerak — aks holda forma yuborilganda ulardagi qiymatlar
tushib qolardi.

⚠️ **3. Dashboard'dan kelgan filtrlar** (`onAnyAuction`, `hasRentContract`, `fullyRented`,
`status`) formada tanlagich sifatida YO'Q — ular **yorliq (chip)** bo'lib chiqadi va
**yashirin maydon** orqali saqlanadi. GET forma faqat o'z maydonlarini yuboradi, shuning
uchun yashirin maydonsiz boshqa filtrni o'zgartirgan zahoti bular yo'qolib ketardi.

⚠️ Yangi filtr qo'shsangiz `page.tsx` → `baseParams` ga ham qo'shing — u eksport va
sahifalash havolalarini quradi (`status` bir marta shu sabab eksportga yetib bormagan edi).

**Tashkilotning qisqa yorlig'i** (`Andijon` / `Respublika` / `Markaziy apparat`) —
`lib/sourceLabel.ts` → `sourceScopeLabel()`. Ilgari bu qoida 5 joyda takrorlangan edi;
yangi joyda kerak bo'lsa shu funksiyani chaqiring.

**Dashboard Excel eksporti** — ikki varaq: "Hududlar" va "Tumanlar". Ikkalasini ham
`services/dashboardExport.ts` → `writeSheet()` quradi (ustunlar bitta `exportCols` massividan),
shuning uchun yangi ustun ikkala varaqda avtomatik paydo bo'ladi.
⚠️ "Tumanlar" varag'idagi JAMI "Hududlar"nikidan **kichik bo'lishi normal** — tumani aniqlanmagan
obyektlar (API 2 da `district_id` yo'q, hozir 2 ta) u yerga kirmaydi.
⚠️ `buildDashboardWorkbook()` ma'lumotni o'zi olmaydi — chaqiruvchi beradi. Sabab: route keshlangan
`getDashboardStats()` ni ishlatadi, lekin `unstable_cache` Next so'rov konteksti tashqarisida
yiqiladi, ya'ni skript/sinovdan chaqirib bo'lmasdi.

### Kadastrni tekshirish (`/dashboard/cadastre-check`) — faqat admin
Kadastr raqami bo'yicha **API 2 ga jonli so'rov** yuborib, xom javobni JSON ko'rinishida
ko'rsatadi (jonli javobda ~66 maydon). Diagnostika vositasi — **bazaga hech narsa yozmaydi**;
obyektni yangilash uchun obyekt sahifasidagi "API orqali yangilash" yoki Sinxronizatsiya
ishlatiladi. `API2_BASE_URL` sozlanmagan bo'lsa ogohlantirish chiqadi.

### Balansga olinganlar — `/dashboard/balans`

To'liq hujjat **`balans` skill'ida** (`.claude/skills/balans/SKILL.md`): `balanceDate`,
obyekt sahifasidagi karta, jadval ustunlari va tashkilotlar orasida o'tkazish (`BalanceTransfer`).

## Ijara imtiyozi — ПҚ-3782 (`/dashboard/imtiyoz`) — 2026-09-02

⚠️ **Mustaqil quyi tizim** — obyektlar/kategoriyalar bilan aloqasi yo'q, `Property`
jadvaliga tegmaydi. To'liq hujjat **`imtiyoz` skill'ida**
(`.claude/skills/imtiyoz/SKILL.md`): ishonch invarianti (`assertNoFalseNegative`),
YATT indeksi, TIEK/natija keshlari, audit va ochiq `check-discount` endpoint'i.
Shu quyi tizimga tegsangiz o'sha skill'ni oching.

## Auksion buyurtmalari reyestri (`/dashboard/auksion`) — 2026-09-07

⚠️ **MUSTAQIL quyi tizim** — `Property`/`AuctionLot`/kategoriyalarga TEGMAYDI.
14 viloyat akkaunti bo'yicha auksion tizimidagi BARCHA buyurtmalar (~68 000).
⚠️ **SHAXSIY MA'LUMOT** saqlanadi (g'olibning passport, JSHSHIR, telefon), shuning
uchun bo'lim `allowRoles` da faqat adminlarga ochiq.
To'liq hujjat — **`auksion` skill'ida** (`.claude/skills/auksion/SKILL.md`):
API tuzoqlari, sinxronlash mexanikasi, o'lchangan tezlik raqamlari va filtr.
Shu quyi tizimga tegsangiz o'sha skill'ni oching.

## davijara.uz uchun API — `/api/davijara/privatization`

To'liq hujjat **`davijara-api` skill'ida** (`.claude/skills/davijara-api/SKILL.md`).
⚠️ **Javob ommaviy saytga chiqadi** — `select` da shaxsiy ma'lumot ham, STIR ham BO'LMASIN.
Yo'l middleware'dan istisno, himoya route ichida (token sozlanmagan bo'lsa 503).

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
6. **Push'dan oldin `next build` — faqat `tsc` YETARLI EMAS.** `next build` tipni boshqacha
   tekshiradi: `next-auth/jwt` augmentatsiyasi u yerda qo'llanmaydi va JWT maydonlari `unknown`
   bo'ladi — lokal `tsc` o'tgan kod Docker build'da yiqilgan (1.14.0, `auth.config.ts`).
   Docker bilan bir xil env'da tekshirish (dev serverni avval to'xtating, keyin `.next` ni o'chiring):
   `DATABASE_URL="postgresql://build:build@localhost:5432/build" NEXTAUTH_SECRET=x npm run build`.

## Konventsiyalar

### ⚠️ Sub-path: ilova production'da `davijara.uz/obyektlar` ostida (2026-09-01)

`next.config.mjs` → `basePath` va `src/lib/basePath.ts` → `BASE_PATH` — ikkalasi ham
`NODE_ENV === "production" ? "/obyektlar" : ""`. Ya'ni `next build` (Docker yoki `npm start`)
avtomatik sub-path'li quriladi; `npm run dev` esa ildizda, o'zgarmagan. Sinash uchun:
`npm run build && npm start` → `http://localhost:3000/obyektlar`.

Next.js O'ZI prefikslaydigan narsalarga **tegilmaydi**: `next/link`, `redirect()`,
`<Image>`, Server Action `<form action={fn}>`, `_next/`, route handlerlar, middleware
`matcher`. Prisma `revalidatePath()` ham basePath'siz (`objectHref()` shundayligicha).

**Qo'lda `withBase()` shart bo'lgan joylar** (`@/lib/basePath`):
- plain `<a href="/...">` (eksport/hujjat yuklab olish havolalari),
- plain `<img src="/...">` (`public/` rasmlari — `Sidebar.tsx` logotiplari),
- `signIn/signOut` ning `redirectTo` (Auth.js core uni mutlaq URL qiladi — `login/page.tsx`,
  `dashboard/actions.ts`).
- string `<form action="/...">` — buning o'rniga `action` **umuman berilmaydi** (GET forma
  joriy URL'ga yuboradi, basePath bilan). Filtr formalari shunday.

**Auth.js sub-path tuzoqlari:**
- Auth.js core `basePath` (`/api/auth`) — **TEGILMAYDI**. Next uni route handler (`req.url`)
  va middleware'dan avtomatik ajratadi; `createActionURL` ham `/api/auth/...` quradi.
  `\`${BASE_PATH}/api/auth\`` berish HAMMA auth so'rovini "UnknownAction" bilan yiqitadi.
- NextAuth'ning O'ZIDAGI signIn redirect'i basePath'ni **yo'qotadi** (`reqWithEnvURL`
  `nextUrl`ni qayta quradi). Shuning uchun `auth.config.ts`da `callbacks.authorized` YO'Q —
  himoya va login redirect `middleware.ts`da QO'LDA, tashqi domen `Host`/`X-Forwarded-*`
  dan olinadi (`nextUrl.origin` proxy ortida ichki `127.0.0.1:3000`).
- Cookie nomlari `obyektlar.*` (davijara ildizidagi Auth.js ilova bilan to'qnashmasin) —
  faqat `BASE_PATH` bo'lganda. `__Secure-`/`__Host-` prefiksisiz (edge bundle NEXTAUTH_URL'ni
  Docker build'da ko'rmaydi), lekin `Secure`/`HttpOnly` runtime'da baribir qo'yiladi.
- `NEXTAUTH_URL` — faqat domen (`https://davijara.uz`), pathsiz, HTTPS shart.

nginx: `location ^~ /obyektlar { proxy_pass http://127.0.0.1:3000; }` — `proxy_pass`da
**path yo'q** (prefiks saqlanadi). Batafsil — `deploy/nginx.example.conf`, `DEPLOY.md` §1.5.

- Izohlar va UI matni — **o'zbek tilida**.
- **Native `<select>` ISHLATILMAYDI** — `components/ui/Dropdown.tsx` (ochilgan ro'yxati ilova
  uslubida, 2026-10-21). Formada `name` (yashirin input), `required`, `submitOnChange`,
  kaskad uchun `resetOnChange`, guruhlar uchun `option.group`.
- Ma'lumot yo'qotadigan amallar (o'chirish) UI'da **bloklanadi**, sababi tugma yonida ko'rsatiladi
  (masalan: obyekti bor manbani o'chirib bo'lmaydi — "Faol" belgisini oling).
- Dashboard aggregatlari `unstable_cache` (tag `dashboard`, 60s TTL) — worker alohida jarayon
  bo'lgani uchun `revalidateTag` chaqira olmaydi, shuning uchun TTL kerak.
- Rasmiy hisobot jadvallarida **J A M I qatori birinchi** (oltin fon, qizil raqamlar),
  hududlar `Region.sortOrder` bo'yicha.
- **Versiya + CHANGELOG.** `package.json` → `version` Sidebar'da ko'rsatiladi (foydalanuvchi ko'radi).
  ⚠️ **Faqat git'ga PUSH qilinganda oshiriladi** — ish davomida har bir tugallangan funksiya/bug fix
  uchun EMAS (foydalanuvchi tuzatgan, 2026-07-29). Push paytida shu oxirgi versiyadan beri to'plangan
  BARCHA o'zgarishlar bitta yangi versiya raqami ostida `CHANGELOG.md`ga yoziladi (bir nechta kichik
  fix bitta punkt sifatida jamlanishi mumkin). `CHANGELOG.md` ilova UI'sida **ko'rsatilmaydi**, faqat
  repo ichida — kichik tuzatish/refaktoring alohida punkt bo'lishi shart emas, faqat foydalanuvchi
  sezadigan/muhim o'zgarishlar.
