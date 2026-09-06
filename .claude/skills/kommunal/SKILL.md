---
name: kommunal
description: Kommunal xizmatlar (suv/gaz/elektr) quyi tizimi — integrations/utilities.ts, dashboardning 3-jadvali (computeUtilityStats) va ?utility= ixcham ro'yxat ko'rinishi. Uchala API'ning javob shakllari, 'topilmadi' tuzoqlari, gasBilled/gasConsuming farqi, qamrov raqamlari, utilityCheckedAt va 'yaqinda to'lov' mezoni. Kommunal ma'lumot, jadval yoki filtrga tegadigan ish uchun oching.
---

### Kommunal xizmatlar (suv/gaz/elektr) — `integrations/utilities.ts`

Uchalasi ham API 3/4 bilan **bir xil serverda** (`/markaz/suvsoz_data`, `/markaz/hududgaz_data`,
`/markaz/het_data`) va bir xil Basic juftlikda, lekin **uchta boshqa vendor** — javob
tuzilmalari umuman o'xshamaydi:

| | Topilganda | Topilmaganda |
|---|---|---|
| suv | `{pid, fio, saldo, saldo_sst}` | `{err_code: -425, err_msg: "Item not found"}` |
| gaz | `{abonent: {customer_code, name, current_balance, interraction: [12 oy]}}` | `{abonent: null, result_code: 73}` |
| elektr | `{transactionId, abonent: {soato[], customerType[], customerCode[]}}` | **AYNAN o'sha tuzilma**, massivlar bo'sh |

⚠️ **Hech biri 404 qaytarmaydi** — "topilmadi" HTTP **200 + body ichida** keladi (API 2 ning
`code: 90000` tuzog'i kabi). `NotFoundError` yo'liga tayanib bo'lmaydi, har biriga alohida
`found` prediktati yozilgan.

⚠️ **Faqat gaz sarf haqida ma'lumot beradi**, va u yerda uch daraja saqlanadi:
- `hasGas` — abonent hisobi mavjud
- `gasBilled` — oxirgi oylarda `accrual > 0`: hisob **faol**, to'lov hisoblanmoqda
- `gasConsuming` — oxirgi oylarda `gas_consume > 0`: **hisoblagich** haqiqiy sarfni ko'rsatgan

Ba'zi abonentda hisoblagich yo'q (`meter_number`/`reading_value` NULL) — u holda `gas_consume`
12 oy davomida **0** bo'ladi, lekin `accrual` har oyda 19 800–22 000 so'm (gaz norma bo'yicha
hisoblanadi). Ya'ni bunday obyektda `gas_consume = 0` "sarf yo'q" emas, "hisoblagich yo'q" degani.

⚠️ **Lekin to'liq ma'lumotda bu holat KAM UCHRAYDI**: 2423 obyektlik to'liq sinxronizatsiyada
21 ta gaz abonentidan **19 tasida `gasBilled` va `gasConsuming` bir xil** (ikkalasi ham true),
2 tasida esa ikkalasi ham false. Ya'ni amalda uchala ustun deyarli ustma-ust tushadi.
(Dastlab 3 obyektlik namunada hammasi hisoblagichsiz chiqqani uchun `gasBilled` "ancha kengroq"
deb baholangan edi — **to'liq ma'lumot buni tasdiqlamadi**.) Ustunlar baribir alohida saqlanadi:
farq mavjud va hisoblagichsiz obyektlar kelajakda ko'payishi mumkin.

Suv faqat balansni, elektr esa **faqat abonent kodini** beradi (nom ham yo'q).

⚠️ **Qamrov juda past, lekin hududlar bo'ylab TARQALGAN.** To'liq sinxronizatsiya
(2423 obyekt, 14 hudud, 2026-08-17):

| | topildi | % |
|---|---|---|
| elektr | 73 | 3.0% |
| gaz | 21 | 0.9% |
| suv | 15 | 0.6% |
| **kamida bittasi** | **101** | **4.2%** |

⚠️ **Qamrov Toshkent bilan CHEKLANMAGAN** — aksincha, Toshkent shahri eng past ko'rsatkichga
ega (204 obyektdan **1 ta**). Eng ko'p: Toshkent v. 15, Qoraqalpog'iston 14, Jizzax 13,
Qashqadaryo 13. Suv topilmalari 8 ta hududga tarqalgan va Toshkent shahrida **umuman yo'q**.
(Dastlabki 84 obyektlik namuna "hamma topilma Toshkentda" degan xulosa bergan edi — u
**noto'g'ri** bo'lib chiqdi, kichik sonlar tasodifiy tanlovda ko'rinmay qolgan. Bu API'lar
haqida xulosa chiqarishda kichik namunaga tayanmaslik kerakligining aniq misoli.)

Abonent nomi ko'pincha jismoniy shaxs (`"КАМАЛОВА ГУЛБАХОР"`) yoki begona tashkilot bo'lib
chiqadi, manzil esa kvartirani ko'rsatadi — API'lar turar-joy abonentlari bazasiga ulangan.
Shuning uchun "abonent bor" ≠ "davlat obyekti ishlatilmoqda".

⚠️ **Shundan kelib chiqadigan ASOSIY qoida:** API "bu kadastrda abonent yo'q" va "bu hudud
umuman qamralmagan" holatini **farqlay olmaydi**. Shuning uchun `Property.utilityCheckedAt`
(NULL = **tekshirilmagan**) alohida saqlanadi va dashboardda "Hech biri" va "Tekshirilmagan"
**alohida ustunlar**. `utility=none` va `utility=unchecked` filtrlari ham alohida.
"Abonent topilmadi" ni "obyekt bo'sh turibdi" deb talqin qilish — xato xulosa.

⚠️ Eski kadastr fallback bu yerda ham ishlaydi va **kerak**: jonli o'lchovda Buxorodagi
gaz abonenti faqat eski kadastr orqali topilgan.

Kommunal modul **kategoriyaga umuman ta'sir qilmaydi** — u mustaqil kuzatuv o'lchovi,
`integrationCategoryCode` hisobiga kirmaydi. Shu sababli `AUCTION_RANGE`/`RENT_RANGE` kabi
"yangilanmagan modul hissasini tiklash" mantig'i kerak emas: modul o'chirilgan bo'lsa,
tegishli ustunlar `update`ga qo'shilmaydi va bazadagi qiymat o'z holicha qoladi.


### Kommunal jadvali (dashboardning 3-jadvali)

`stats.ts` → `computeUtilityStats()` / `computeDistrictUtilityStats()` — kategoriyalar va
ijara jadvallariga **tegmaydi**, alohida so'rov (`utilityRows()`). Ular bilan bir xil
naqshlar saqlangan: `StatsScope` doirasi, `Prisma.sql` parametrlash, doira sharti **JOIN
ichida** (`LEFT JOIN ... AND ${srcCond}`), respublika tashkilotlari alohida qatorda, va
bir xil `?tuman=` parametri (bitta hududni ochsangiz **uchala jadval** ham ochiladi).

⚠️ **Jadvaldagi BARCHA sonlar faqat "Bo'sh turgan" (kat 11) obyektlar bo'yicha.** Jadval
bitta savolga javob beradi: *bo'sh deb hisoblanayotgan obyekt aslida foydalanilayaptimi?*
Ilgari u barcha obyektlarni ham, bo'sh turganlarni ham bitta jadvalga sig'dirgan (13 ustun)
va o'qib bo'lmas edi — foydalanuvchi soddalashtirishni so'radi (2026-08-17).

Ustunlar: *Bo'sh turgan obyektlar* (soni · foydali maydoni, ming m²) · *Shundan kommunal
abonenti bor* (suv · gaz · elektr) · *Jamlanma* (kamida bittasi · **yaqinda to'lov** ·
tekshirilmagan).

⚠️ **"Yaqinda to'lov" — eng kuchli signal.** `Property.gasLastPaymentAt` (gaz API'sining
`abonent.last_payment_date`, `"DD.MM.YYYY"` formatida — ISO EMAS, `parseDotDate()` bilan
o'qiladi) oxirgi `UTILITY_RECENT_PAYMENT_MONTHS` (standart 3) oy ichida bo'lsa.
Sabab: "abonent bor" bayrog'i 2 yil oldin yopilgan hisobni ham, hozir faol hisobni ham
bir xil ko'rsatardi — jonli ma'lumotda to'lov sanalari 2024-yildan 2026-yilgacha
tarqalgan. `gasBilled` (hisob-kitob) ham yetarli emas: u abonent to'lamasa ham davom
etadi va qarz to'planadi; TO'LOV esa kimdir obyektdan foydalanayotganini bildiradi.
Faqat gazda mavjud (suv sana bermaydi, elektr umuman hech narsa bermaydi).
⚠️ Chegara `stats.ts` → **`recentPaymentCutoff()`** dan — SQL, `buildWhere()` va so'rovlar
sahifasi UCHALASI shu bitta funksiyani chaqiradi.

⚠️ "Bo'sh turgan" sharti **har bir `FILTER (...)` ichida**, JOIN'da EMAS — JOIN'ga
qo'yilsa kat 11 obyekti yo'q hudud qatori jadvaldan butunlay yo'qolardi (LEFT JOIN'ning
maqsadi 0 li qatorlarni saqlash).

⚠️ **`landSplit` sohalarda (Davlat aktivlari agentligi / Direksiya) FAQAT BINO sanaladi**
(`AND NOT p."isLand"`) — kategoriyalar jadvalidagi 11-ustun va "Bo'sh turgan" kartasi
bilan aynan bir xil mezon (`rentBreakdown.vacant.buildingCount`). Busiz kartada 606,
kommunal jadvalda 2994 chiqqan edi (foydalanuvchi topdi, 2026-08-17). Drill-down
havolalariga ham `&isLand=0` qo'shiladi — aks holda ro'yxatdagi son jadvaldagidan
katta chiqardi.

⚠️ **MAYDON YIG'INDISI BU XATONI YASHIRADI.** Yer uchastkasida `buildingArea = 0`,
shuning uchun `SUM(buildingArea)` yer qo'shilgan-qo'shilmaganidan qat'i nazar BIR XIL
chiqadi — faqat SONI farq qiladi. Ya'ni "maydon mos kelyapti" hech qachon to'g'rilikning
dalili emas; yangi agregat qo'shganda **sonini alohida** solishtiring.

⚠️ Gaz ustuni — `hasGas`, ya'ni **hisoblagichi yo'q (norma bo'yicha to'laydigan) abonent
ham SHU songa kiradi**. "Gaz hisobi faol" alohida ustuni bo'lgan, foydalanuvchi olib
tashlashni so'radi (2026-08-17): to'liq ma'lumotda u `gasConsuming` bilan deyarli aynan
bir xil chiqdi. `gasBilled`/`gasConsuming` bayroqlari bazada va `?utility=` filtrida qoladi.

**Havolalar:** hudud/tuman nomi, har bir son VA **J A M I qatoridagi sonlar** — hammasi
ro'yxatga havola. ⚠️ Har birida **`category=11` MAJBURIY** (hudud nomida ham!) — usiz
umumiy ro'yxat ochilib, jadvaldagi son bilan mos kelmasdi. JAMI qatori hududsiz havola
beradi (butun doira bo'yicha). Va **`buildWhere()`dagi shartlar `utilityRows()`dagi
`FILTER (...)` ifodalari bilan bir xil bo'lishi shart** (kategoriya jadvalidagi qoida).

Excel eksporti: `/api/export/dashboard-utility` — ikki varaq (Hududlar · Tumanlar),
ustunlar bitta `COLS` massividan (yangi ustun ikkala varaqda avtomatik paydo bo'ladi).

Kommunal tekshiruv umuman o'tkazilmagan bo'lsa (bo'sh turganlarning hammasi
"tekshirilmagan") jadval o'rniga tushuntirish ko'rsatiladi — 14 qator nol foydalanuvchini
chalg'itardi.

### Kommunal ro'yxat ko'rinishi va obyekt sahifasi

**`/dashboard/objects?utility=...`** — `utility` parametri BO'LSA ro'yxat ixcham
ko'rinishga o'tadi (`UtilityObjectsTable.tsx`, client komponent): faqat **Kadastr · Suv ·
Gaz · Elektr**. Xizmat katakchasi bosilganda o'sha xizmatning asosiy ma'lumotlari qator
ostida ochiladi (akkordeon, bir vaqtda bir nechtasi ochiq bo'lishi mumkin).
⚠️ **Obyekt sahifasiga FAQAT kadastr raqami orqali o'tiladi** — shu sababli xizmat
katakchasi `<button>`, kadastr esa `<Link>` (ichma-ich havola bo'lmasligi uchun).

⚠️ Katakcha mazmuni SERVER tomonda tayyorlanadi (`properties.ts` → `listUtilityCells()`
→ `UtilityCell`) va client'ga faqat oddiy tiplar boradi: `integrations/utilities.ts`
→ `@/lib/env` ni import qiladi (server-only, zod validatsiyasi), uni client bundle'ga
tortib kiritib bo'lmaydi.

⚠️ `rawResponse` og'ir JSON — `listUtilityCells()` FAQAT ixcham ko'rinishda chaqiriladi,
odatdagi ro'yxatda umuman so'ralmaydi.

**Obyekt sahifasida** asosiy ma'lumotlardan darhol keyin "Kommunal xizmatlar" bo'limi
(uchta karta). Kategoriyasi 11 bo'lgan obyektda abonent topilsa — sahifa tepasida sariq
**ogohlantirish** chiqadi. Ogohlantirish matni ATAYIN yumshoq: abonent ijarachi yoki
qo'shni bo'lishi mumkin, ya'ni bu dalil emas, tekshirish uchun signal.

**So'rovlar oqimida** (`/dashboard/requests` — kutilayotganlar VA tarix) obyekt kadastri
ostida kommunal ogohlantirish yorlig'i chiqadi (`RequestRow.tsx` → `UtilityWarning`):
moderator/rahbariyat "Bo'sh turgan" obyektni Yaroqsiz/Chekka'ga o'tkazishni tasdiqlashdan
OLDIN abonent borligini ko'radi. Yaqinda to'lov bo'lsa yorliq qizil, aks holda sariq.
⚠️ Abonent topilmasa yorliq UMUMAN ko'rsatilmaydi — obyektlarning ~4% ida abonent bor,
"topilmadi" yozuvi qolgan 96% da shovqin bo'lardi.

⚠️ Ro'yxat ham, obyekt sahifasi ham `parseUtilityRaw()` ni ishlatadi — **yagona parser**,
shuning uchun ikki joyda ko'rsatilgan qiymat hech qachon ajralmaydi (`lib/area.ts` bilan
bir xil printsip). "Integratsiya tekshiruvlari" jadvalida manba nomi `UTILITY_LABEL`
orqali o'zbekchalashtiriladi (`WATER`→Suv), kodda esa API bilan mos nom qoladi.

