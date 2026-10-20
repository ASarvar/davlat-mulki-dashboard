---
name: balans
description: Balansga olinganlar hisoboti (/dashboard/balans) — Property.balanceDate (kadastrdagi huquq sanasi, lib/balance.ts), eski API 2 shakli, Balansga olinganlik kartasi, jadval ustunlari (yil boshidan/oy/o'tgan oy/kun), DatePicker, tashkilotlar orasida o'tkazish (isTransferredHere, BalanceTransfer). Balans sanasi, KPI yoki o'tkazishga tegadigan ish uchun oching.
---
# Balansga olinganlar — /dashboard/balans

CLAUDE.md dan ko'chirilgan (2026-10-12) — matn o'zgarishsiz.

### Balansga olinganlar — `/dashboard/balans` (2026-09-28, KPI)

Oy bo'yicha balansga olingan obyektlar, hududlar × soha. Sana — **`Property.balanceDate`**:
kadastrdagi huquq ro'yxatdan o'tgan ENG OXIRGI sana (`land.legal[].date` /
`outer[].legal[].date`), `lib/balance.ts` → `balanceRegDate()`.
⚠️ **`createdAt` EMAS** — u tizim obyektni ko'rgan kun: jonli o'lchovda sentyabrda
"yaratilgan" 241 obyektdan 185 tasining huquqi ancha oldin ro'yxatdan o'tgan edi.
⚠️ Migratsiyadagi SQL to'ldirish JS funksiyasi bilan AYNAN bir xil (6093 obyektda 0 farq);
mavjud bo'lmagan sana ikkalasida ham tashlanadi. **Eski API 2 shaklida** (`cad_data` topmagan
obyektlar) — `registration_date` (+ `registration_number`, `documents[]` DD.MM.YYYY, `owner`),
faqat huquq yozuvlari UMUMAN bo'lmasa (migratsiya `20260929120000_balance_transfer`; lokal:
sanasizlar 101 → 45). Yozuvchilar `undefined` bo'lsa ustunga TEGMAYDI.
Obyekt sahifasida alohida **"Balansga olinganlik"** kartasi (`balanceRegRecord()`): sana
(DB ustuni), huquq turi yoki ro'yxat raqami, oldingi egasi, asos hujjatlar — sana bo'lmasa
ham qolgan ma'lumot ko'rsatiladi.
- Hudud — obyekt JOYLASHGAN hudud (`regionId`), respublika tashkilotlari ham kiradi, shuning
  uchun havolalarda `hududiy=1` YO'Q (rasmiy hisobot jadvalidan farqli — ataylab).
- Sonlar `buildWhere()` bilan (`services/balance.ts`), ro'yxat filtri `balansFrom`/`balansTo`
  (ikkala chegara kiradi) — son va ro'yxat ajralmaydi. Eksportda "Balansga olingan sana" ustuni.
- Tashkilotlar orasida o'tkazish huquqni qayta ro'yxatdan o'tkazadi — qabul qiluvchida yangi sana
  (foydalanuvchi qarori: ichki o'tkazish ham "balansga olingan" sanaladi).
- Jadval: hududlar × to'rt ustun — yil boshidan tanlangan kungacha, tanlangan kunning oyi
  (to'liq oy), o'tgan oy, tanlangan kun
  (`?kun=YYYY-MM-DD`, standart bugun, Toshkent; eski `?oy=` ham qabul qilinadi).
  Tanlagich `balans/DatePicker.tsx` — o'zbekcha, brauzer `input type=date` emas.
- Standart manba — "Ijara markazi" (hisobot kabi), "Hammasi" — `?soha=__all__`.
  "Sanasi aniqlanmagan" kartasi → ro'yxat `balansNone=1` (`balanceUnknown`, bir xil `buildWhere`).

⚠️ **O'tkazilgan obyekt yangi egasiga KO'CHIRILADI** (`syncPropertyBase.ts` →
`isTransferredHere()`, 2026-09-28). Ilgari `upsert`ning `update` qismi `sourceId`ni
o'zgartirmasdi: eski ega obyektni "balansdan chiqarilgan" deb belgilar, yangi egada u hech
qachon paydo bo'lmasdi — barcha statistikadan yo'qolardi (jonli: `10:11:40:01:01:0127/0005`,
Ijara markazi → Direksiya). Shart: eski egada `removedFromBalance` YOKI kadastrdagi
`hosts[0].tin` = yangi tashkilot STIRi. Shartsiz ko'chirilmaydi — ulushli egalikda obyekt
ikki tashkilot orasida har kuni o'tib-qaytib yurardi. Qolib ketganlar keyingi to'liq
sinxronizatsiyada o'zi tuzaladi.
⚠️ **Ko'chirish bilan BITTA tranzaksiyada `BalanceTransfer` yoziladi** (2026-09-29) — obyekt
eski egasining "Balansdan chiqarilgan" ro'yxatida QOLADI (foydalanuvchi talabi).
`buildWhere()` → `wantsRemoved`: `removedFromBalance` YOKI `transfers.some`; bu rejimda
soha/tashkilot filtri o'tkazilganlar uchun ESKI egaga (`fromSource`) qo'llanadi, umumiy
`soha`/`sourceId` sharti qo'shilmaydi. Ro'yxat/eksportda `removedView()` sana va yangi egani
o'tkazish yozuvidan oladi. 1.17.1 dan keyin (tarix jadvalisiz) o'tkazilganlar tiklanmaydi.
