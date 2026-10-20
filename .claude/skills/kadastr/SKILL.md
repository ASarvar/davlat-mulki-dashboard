---
name: kadastr
description: Kadastr asosiy ma'lumoti — cad_data (integrations/cadData.ts, fetchBase) va eski API 2 zaxirasi, STIR talabi va 2108 xatosi, javob shakllari va maydon mosligi, koordinata (geometry, EPSG:3857), maydon zanjiri (lib/area.ts), API 2/3/4 tuzoqlari. Kadastr ma'lumoti, maydon, koordinata yoki tashqi API javobini o'qishga tegadigan ish uchun oching.
---
# Kadastr ma'lumotlari (cad_data / API 2) va API tuzoqlari

CLAUDE.md dan ko'chirilgan (2026-10-12) — matn o'zgarishsiz.

### Kadastr ma'lumotlari: `cad_data` — API 2 ning O'RNINI bosdi (2026-09-06)

Asosiy ma'lumot endi `cad_data` dan olinadi (`integrations/cadData.ts`). Yagona kirish
nuqtasi — **`integrations/propertyBase.ts` → `fetchBase(cadNumber, tin)`**: `CADDATA_*`
sozlangan bo'lsa yangi API, aks holda eski API 2. Chaqiruvchilar ikkalasini qo'lda
tanlamaydi.

**Nima uchun ko'chirildi** (jonli o'lchov, 200 obyekt): koordinata qamrovi
**28% → 95%**, ustiga cheklov (hibs/xatlov) ma'lumoti qo'shildi. Maydon, tuman kodi,
eski kadastr va nom mosligi — **100%** (117 obyektda tekshirilgan).

⚠️ **STIR (`?tin=`) MAJBURIY va EGASIGA MOS kelishi shart.** Mos kelmasa
`[2108] "Ushbu obyekt ko'rsatilgan tashkilotga tegishli emas"`. Uchta oqibati bor:
1. Har bir chaqiruvchi obyektning tashkiloti STIRini bilishi kerak. `PropertyBaseJob`
   ga `stir` qo'shilgan (`syncSource.ts` fan-out'da beradi); `checkPropertyStatus`
   uni bazadan (`source.stir`) oladi.
2. **Balansdan chiqqan obyektning YANGI egasini aniqlash yangi API bilan MUMKIN EMAS** —
   biz u yerda aynan egani qidiramiz, ya'ni STIRni oldindan bilmaymiz. Shuning uchun
   `syncSource.ts` dagi holder-lookup ATAYLAB eski API 2 da qoldirilgan. **API 2 ni
   sozlamadan olib tashlamang** — u `fetchBase()` ning zaxira zanjirida ham
   ishlatiladi (`cad_data` topmasa: eski kadastr → API 2 → API 2 + eski kadastr;
   xato bo'lsa ASOSIY manbaning sababi qaytariladi).
3. `2108` amalda "balansdan chiqqan" signali, lekin unga qarab AVTOMATIK
   `removedFromBalance` qilinmaydi — bu qaror API 1 ning ro'yxati bo'yicha qabul
   qilinadi (yolg'on ijobiy natijaning oldini olish).

⚠️ **Javob shakli BUTUNLAY boshqacha** — ichma-ich (`data.object` / `data.land` /
`data.address`), API 2 esa yassi edi. `lib/area.ts` **IKKALA shaklni ham** tushunadi
(`asNewShape()` + `normalize()`) va bu VAQTINCHALIK emas: yangi API obyektlarning
~2–4% iga `404`/`2108` qaytaradi, ularning `rawApi2` si eski shaklda qoladi.

Maydon mosligi (jonli tasdiqlangan):

| API 2 (yassi) | `cad_data` (ichma-ich) |
|---|---|
| `cad_number_old` | `old_cad_number` |
| `object_area_p` | `object.object_pl_obfull` |
| `object_area` | `object.pl_obzd` |
| `object_area_u` | `object.object_pl_polezfull` → `outer[].outer_pl_polezfull` → `outer[].liters[].liter_pl_polezfull` |
| `land_area` | `land.area` |
| `object_rooms` | `object.rooms` |
| `district_id` | **`address.district.soato`** |
| `subjects[0]` | `hosts[0]` (`tin`/`fname`) |
| `address` (tayyor satr) | `address.{region,district,mahalla,street,house_number}` — qurish kerak |

⚠️ **`address.district.code` ("10:04") EMAS, `soato` ("1726290")** — aynan `soato`
API 2 ning `district_id` si bilan bir xil (117 obyektda 100%). `code` ni olsak
`District` jadvalining butun kaliti buzilardi.
⚠️ `land.area_z`/`area_b` MAPPING QILINMAYDI — ma'nosi hujjatlashtirilmagan
(eski shakldagi `_i`/`_b`/`_z` suffikslari bilan bir xil sabab).

⚠️ **`0` ham "qiymat yo'q"** — yangi shaklda ham. Birinchi o'lchovda `??`
ishlatilgani uchun 17 ta "farq" chiqqan edi; `positive()` bilan 100% mos keldi.

### Koordinata — `geometry` (kadastr poligoni)

`cad_data` javobida **`geometry`** bor: `Polygon`, **EPSG:3857** (Web Mercator, metrda).
`lib/geo.ts` → `pickCadastreCoords()` uni WGS84 ga o'giradi va poligonning markazini
(centroid) qaytaradi. Kutubxona kerak emas — formula qisqa (`mercatorToWgs84`).

⚠️ `crs.properties.name` TEKSHIRILADI: `EPSG:3857` bo'lmasa `null` qaytadi.
Boshqa proyeksiyani "taxmin qilib" o'girish xaritaga jimgina tasodifiy nuqta chizardi.
⚠️ **USTUVORLIK: kadastr poligoni > auksion nuqtasi** (`coordSource` ustuni:
`CADASTRE` / `AUCTION`). Kadastr koordinatasi obyektning O'Z chegarasidan olinadi va
qamrovi ancha keng; auksion nuqtasi esa faqat savdoga chiqqan obyektlarda bo'ladi.
⚠️ Ikkalasi ham `refreshAuction` blokidan TASHQARIDA va faqat YANGI qiymat
bo'lganda yoziladi — hech qachon `null` ga qaytarilmaydi (bino joyidan ko'chmaydi).
⚠️ Xarita ostidagi izoh `MapData.bySource` ga qarab o'zgaradi — qattiq
yozib qo'yilgan "faqat auksionga chiqqan obyektlarda" matni ko'chishdan keyin
YOLG'ON bo'lib qolgan bo'lardi.

Ko'chishdan oldin tekshirish: `prisma/probe-cad-data-2026-09-06.ts` (bazaga hech narsa
yozmaydi, namunada qamrov va maydon mosligini o'lchaydi).

### API tuzoqlari (real ma'lumotdan)
- **API 2:** `cad_number_old` yo'q bo'lsa `""` qaytadi, `null` emas — tozalanmasa fallback bo'sh
  kadastr bilan chaqiriladi.
- **API 2 throttling:** HTTP **200** + `{code: 90000, "Message throttled out"}`. 429 emas! Shuning uchun
  `httpJson`'da `shouldRetry` bor — yangi API qo'shsangiz, u rate-limitni body ichida bildiradimi tekshiring.
- **API 3:** `success:true` bo'lsa ham `lot_number`/`order_id` `null` bo'lishi mumkin (`"Муаммоли"`).
  Shuning uchun "savdoda" kategoriyasi haqiqiy `lotNumber` talab qiladi.
- **API 4:** parametr o'qilmasa `result` o'ramisiz `{result_msg:"Xatolik", result_code:0}` qaytadi —
  ya'ni `result_code === 0` muvaffaqiyat kafolati emas, `result.order` borligini ham tekshirish shart.
- **API 2 maydonlari:** `area` ← **binoning umumiy maydoni**, `buildingArea` ← `object_area_u`
  (**foydali maydon**). Ikkalasi ham `src/lib/area.ts` orqali o'qiladi — **yagona joy**:
  `totalBuildingArea()` / `usefulArea()`.
  ⚠️ **Umumiy maydon zanjiri:** `object_area_p` → `object_area` → `land_area` → `land_area_i`
  (foydalanuvchi qoidasi, 2026-07-31). **`0` ham "qiymat yo'q"** deb qaraladi — jonli API
  bo'sh maydonni `null` emas, `0` qilib qaytaradi, shuning uchun oddiy `??` YETARLI EMAS.
  Jonli o'lchov (5500 obyekt): 3026 `object_area_p`, 68 `object_area`, **2333 `land_area`**,
  70 `land_area_i`, faqat 3 tasida hammasi 0. Ya'ni obyektlarning ~44% shu zanjirga tayanadi.
  ⚠️ **Yorliq manbaga bog'liq:** qiymat `land_area`/`land_area_i` dan olinsa obyekt aslida
  bino emas, shuning uchun obyekt sahifasida **"Umumiy maydoni"** deb yoziladi (aks holda
  "Binoning umumiy maydoni"). Qoida `totalAreaLabel()` da; `totalBuildingAreaWithSource()`
  qiymat bilan birga manbani ham qaytaradi.
  ⚠️ **Foydali maydonga (`object_area_u`) YER zanjiri QO'LLANMAYDI** — atayin: `vacantArea`
  (= foydali − ijarada) shunga tayanadi, unga `land_area` qo'shilsa dashboarddagi
  "Bo'sh maydon" ustunlari ham o'zgarib ketadi. 2528 obyektda `object_area_u = 0`.
  ⚠️ **Lekin YANGI shaklda bino ichidagi zanjir bor** (`newUsefulArea`, 2026-09-06):
  `object.object_pl_polezfull` jamlanmasi `0` bo'lsa `outer[].outer_pl_polezfull` va
  `outer[].liters[].liter_pl_polezfull` yig'indisiga tushiladi — bu YER emas, o'sha
  foydali maydonning bino/liter darajasidagi nusxasi. Jonli o'lchov (2026-09-06):
  jamlanma `0` bo'lgan 2981 obyektning hech birida bino bloklarida ham qiymat yo'q,
  ya'ni bu real yer uchastkalari va `vacantArea = 0` to'g'ri (eski API 2 ~9% ida
  soxta qiymat berardi — migratsiyada "Bo'sh maydon" shu sabab ~6% kamaydi).
  ⚠️ **`isLandOnly` yangi shaklda** endi `object` bloki + `outer[]`/`liters[]` bo'sh
  bo'lishi VA `land.{area,area_u,area_z,area_b}` dan birortasi > 0 bo'lishini talab
  qiladi — binosi ham, yeri ham yo'q "bo'sh" obyekt yer uchastkasi deb belgilanmaydi.
  ⚠️ Shartnoma maydoni foydali maydondan katta bo'lsa (obyekt aslida yer uchastkasi) — ikkala ustun
  ham `land_area` dan olinadi. Real ma'lumotda 84 holatdan 81 tasi shu bilan tuzaldi, 13 tasida
  `land_area` ham yetarli emas. `Property.vacantArea` = `GREATEST(foydali − ijarada, 0)` ustun sifatida
  saqlanadi (Prisma ikki ustunni solishtira olmaydi, filtr uchun kerak).
  ⚠️ Obyekt sahifasida (`/dashboard/objects/[...cad]`) "Binoning umumiy maydoni"/"Foydali maydon"
  `Property.area`/`buildingArea` emas, `rawApi2`dan — lekin **AYNAN o'sha `lib/area.ts`
  funksiyalari** bilan (DB ustuni faqat zaxira). Ilgari sahifa o'z mantiqini yozgan va `??`
  ishlatgani uchun `0` ni "bor" deb qabul qilardi — ro'yxatda 294 m², sahifada 0 m² chiqishi
  mumkin edi. Endi ikkalasi bitta manbadan. Karta ostidagi "Barcha kadastr ma'lumotlari"
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
