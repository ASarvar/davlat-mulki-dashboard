---
name: imtiyoz
description: Ijara imtiyozi (ПҚ-3782) quyi tizimi — /dashboard/imtiyoz. Nogironligi bo'lgan xodimlar ulushi bo'yicha 50% ijara imtiyozini tekshirish. Soliq comp_workers, YATT indeksi, TIEK reyestri, ishonch invarianti (assertNoFalseNegative), keshlar, audit va ochiq check-discount endpoint'i. Shu quyi tizimga tegadigan har qanday ish uchun oching — obyektlar/kategoriyalar bilan aloqasi yo'q.
---

## Ijara imtiyozi — ПҚ-3782 (`/dashboard/imtiyoz`) — 2026-09-02

Alohida ilova edi (`github.com/ASarvar/Imtiyoz-API`, Express + SQLite + o'z auth'i), dashboardga
**to'liq ko'chirildi**; mustaqil xizmat endi kerak emas. **Obyektlar/kategoriyalar bilan hech qanday
aloqasi yo'q** — mustaqil quyi tizim, `Property` jadvaliga tegmaydi.

**Qoida:** mehnat shartnomasi asosida ishlayotgan xodimlarning kamida **30%** ini nogironligi
bo'lgan shaxslar tashkil etsa, ijara to'lovi auksion summasining **50%** i etib belgilanadi.

```
9 xonali (STIR)    → Soliq comp_workers ga JONLI so'rov (sahifalab)
14 xonali (JSHSHIR)→ oldindan tayyorlangan YATT indeksidan o'qish
har bir xodim      → TIEK minzdrav_pas (nogironlik reyestri), 15 parallel
```

### ⚠️ ISHONCH INVARIANTI — butun quyi tizimning maqsadi

**Hech qanday tashqi tizim uzilishi ANIQ RAD JAVOBIGA aylanmaydi.** `isEligible: false` bo'lsa-yu,
ayni vaqtda `soliqError` / `failedChecks` / `yattIndexIncomplete` / `!yattIndexReady` bo'lsa —
`assertNoFalseNegative()` (`services/imtiyoz/evaluate.ts`) **xato tashlaydi**. Noto'g'ri rad
javobidan ko'ra 500 qaytargan afzal: u logda darhol ko'rinadi. Yagona istisno — `NO_WORKERS`.
Jonli sinovda tasdiqlangan: 5 xodimdan 0 tasi nogiron (0.0%) bo'lsa ham, 1 xodim tekshirilmagan
bo'lsa natija `NOT_ELIGIBLE` emas, `INCONCLUSIVE_TIEK` bo'ladi.

`resultCode` — javobning **yagona ishonchli maydoni**. UI (`lib/imtiyoz.ts` → `VERDICT`) faqat shunga
tayanadi, xabar MATNI hech qachon solishtirilmaydi.

| `resultCode` | `isEligible` | Ma'nosi |
|---|---|---|
| `ELIGIBLE` / `NOT_ELIGIBLE` | true / false | ma'lumot TO'LIQ, aniq xulosa |
| `NO_WORKERS` | false | baza javob berdi, shartnoma yo'q — **haqiqiy fakt** |
| `INCONCLUSIVE_SOLIQ` / `_TIEK` / `_YATT_INDEX` | **null** | aniqlab bo'lmadi |

### YATT indeksi — ⚠️ asl ilovadan ENG KATTA farq

`yatt_workers` endpoint tadbirkor bo'yicha **FILTRLAMAYDI**: har bir so'rov butun respublika
shartnomalarini (~76 000+) qaytaradi. Ya'ni har bir tekshiruvda jonli filtrlash imkonsiz.

Asl ilova indeksni **xotirada** (`Map`) saqlardi. Bu yerda **`ImtiyozYattWorker` jadvali** —
sabab: web va worker **ikki alohida process**, xotiradagi Map worker'da qurilib web'da ko'rinmasdi.
Yon foydasi: restartdan omon qoladi (asl ilovada har restart = 76k yozuvni qaytadan yuklash).

- Sinxronlash — **faqat worker'da**, `QUEUE.IMTIYOZ_YATT_SYNC`, cron `0 */6 * * *`.
  ⚠️ Jadval har 6 soatda ishga tushadi, lekin `isYattIndexFresh()` true bo'lsa ishlov beruvchi
  **o'tkazib yuboradi** — bu asl ilovadagi adaptiv rejalashtirishning cron'dagi ko'rinishi
  (to'liq sinxronlashdan keyin ~22 soat tinch; to'liqsiz bo'lsa keyingi urinishda darhol qayta).
- ⚠️ `boss.ts` da bu queue'ga **alohida `expireInSeconds: 3600`** beriladi — umumiy 120s job'ni
  yarmida uzib, indeks hech qachon yakunlanmasdi.
- ⚠️ Jadval `deleteMany + createMany` bilan **butunlay almashtiriladi**, INTERAKTIV tranzaksiyada
  (`timeout: 300_000`). Massiv shakli `timeout` qabul qilmaydi, standart 5s esa yetmaydi.
  Tranzaksiyasiz almashtirish oralig'ida kelgan tekshiruv bo'sh jadvalni ko'rib "xodim yo'q"
  degan yolg'on javob berardi.
- ⚠️ To'liqsiz yuklash (`failedPages > 0`) oldingi to'liq indeksni ham yo'qotadi — **ataylab**:
  eskirgan, lekin to'liq ko'rinadigan indeks yolg'on "xodim yo'q" berardi. Jonli sinovda
  tasdiqlangan: 4 sahifadan 1 tasi yuklanmasa, ilgari `NO_WORKERS` bergan JSHSHIR ham,
  `ELIGIBLE` bergan JSHSHIR ham `INCONCLUSIVE_YATT_INDEX` bo'ladi.
- Web indeks tayyor bo'lmasa **kutmaydi** (asl ilova kutardi — bu yerda sinxronlash boshqa
  processda): `enqueueYattIndexSync()` bilan qurishni so'raydi va "hozircha aniqlanmadi" javobini
  beradi. `singletonKey` shart — usiz har bir tekshiruv yangi job qo'shib, shlyuzni ko'mib tashlardi.

### Keshlar — ikkalasi ham Postgres'da

- **`ImtiyozTiekCache`** (24 soat) — nogironlik holati kunlar davomida o'zgarmaydi.
  ⚠️ **FAQAT aniq javob keshlanadi** (topildi / `result_code 1001`); TIZIM XATOSI keshlanmaydi —
  aks holda vaqtinchalik uzilish 24 soatga "nogironligi yo'q" bo'lib muzlab qolardi. Aynan shu
  sabab "Qayta tekshirish" **faqat muvaffaqiyatsiz PINFL'lar** uchun so'rov yuboradi (jonli
  o'lchov: 5 xodimli tekshiruvda qayta urinishda TIEK'ga **1 ta** so'rov ketdi).
  ⚠️ Kesh PINFL boshiga emas, bitta `findMany({ pinfl: { in: [...] } })` bilan o'qiladi —
  400 xodimli korxonada 400 ta so'rov o'rniga 1 ta.
- **`ImtiyozResultCache`** (60 daqiqa) — kalit `{subjectId}_{year}_{period}`.
  ⚠️ `NO_WORKERS` va "aniqlanmadi" holatlari **KESHLANMAYDI** (xodim qo'shilishi mumkin;
  uzilish o'tib ketishi mumkin).

### Audit — `ImtiyozCheck` + `ImtiyozCheckWorker`

⚠️ **FAQAT QO'SHILADI** — `services/imtiyoz/audit.ts` da UPDATE/DELETE yo'li ATAYLAB yo'q
(yozuv pul qaroriga asos bo'ladi). Yangi funksiya qo'shsangiz shu qoidani buzmang.

- Har bir **BERISH** alohida yozuv — **keshdan berilganda ham**. Audit "kimga qachon nima
  aytilgan"ga javob beradi, "qachon hisoblangan"ga emas. Keshdan berilganda YANGI `requestId`
  beriladi, asl hisoblash `sourceRequestId` orqali kuzatiladi.
- `username` denormalizatsiya qilingan — hisob o'chirilsa ham "kim tekshirgan" javobi qoladi.
- ⚠️ Audit yozuvining muvaffaqiyatsizligi foydalanuvchi javobini **TO'SMAYDI** (loglanadi, xolos).
- Xodimlar jadvali **PII** saqlaydi: PINFL, F.I.Sh., nogironlik guruhi, ICD-10 kodi.

### Ochiq endpoint — ⚠️ TEGMANG

`GET /api/imtiyoz/check-discount/:tin` — **auth YO'Q, CORS ochiq**. Shartnoma formasidagi
"Текшириш (3782)" tugmasi shu yerga murojaat qiladi.
- `middleware.ts` matcher'ida **istisno qilingan** — usiz forma JSON o'rniga login HTML'ini olardi.
- Javob shakli (`{ success, data }`) va `data.reason` / `data.tin` maydonlari deploy qilingan
  forma kodiga bog'langan — **o'zgartirmang** (`lib/imtiyoz.ts` da izoh bilan belgilangan).
- Bu yo'l bilan kelgan tekshiruvlar auditga **`forma`** nomi bilan yoziladi (`userId = null`).
- Production URL: `https://davijara.uz/obyektlar/api/imtiyoz/check-discount/:tin`.

### UI

`ResultView.tsx` — natijani chizadigan **YAGONA komponent**: tekshirish sahifasi ham, tarixdagi
arxiv nusxasi ham shuni ishlatadi, shuning uchun ular hech qachon ajralib qolmaydi. Ikkinchi
"faqat tarix uchun" ko'rinish yozmang.
⚠️ "Qayta tekshirish" tugmasi FAQAT `inconclusive` holatida chiqadi — rad javobida bo'lmasligi
kerak, aks holda operator rad javobini "vaqtinchalik nosozlik" deb tushunishi mumkin.
Menyu **hamma rolga** ochiq (tekshiruv hech narsani o'zgartirmaydi, faqat o'qiydi).

### Sinov — mock shlyuz

Haqiqiy shlyuz (`10.190.5.2:8675`) faqat serverdan yetadi. Uzilish yo'llarini sinash uchun
`Imtiyoz-API` repozitoriyasidagi `mock-server.js` (5000-port) ishlatiladi: `IMTIYOZ_*_URL` ni
`http://localhost:5000/markaz/...` ga o'zgartiring, so'ng `POST localhost:5000/__control` bilan
uzilish rejimlarini boshqaring (`{"tiek":{"failPinfls":[...]}}`, `{"yatt":{"failPages":[2]}}`).

