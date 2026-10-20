---
name: davijara-api
description: davijara.uz ommaviy sayti uchun xususiylashtirish API'si (/api/davijara/privatization) — x-davijara-token himoyasi, qaysi obyektlar qaytadi (isLotOpen, soha), bitta lot ikki kadastrda, davijara uni qanday chaqiradi. Shu route yoki uning javobiga tegadigan ish uchun oching.
---
# davijara.uz uchun API — /api/davijara/privatization

CLAUDE.md dan ko'chirilgan (2026-10-12) — matn o'zgarishsiz.

## davijara.uz uchun API — `/api/davijara/privatization` (2026-10-09)

davijara.uz (shu domen ildizidagi ommaviy sayt) xususiylashtirish savdosidagi obyektlarni
**shu yerdan** oladi — API 3/4 zanjirini qayta yurgizmaydi. Route:
`src/app/api/davijara/privatization/route.ts`.

- ⚠️ **Sessiyasiz, middleware'dan ISTISNO** (`matcher` → `api/davijara/`). Himoya — route
  ichida: `x-davijara-token` == `DAVIJARA_API_TOKEN` (`timingSafeEqual`). Token sozlanmagan
  bo'lsa **503** — yo'l hech qachon ochiq qolmaydi. Bo'sh satr ham "sozlanmagan" (`env.ts`).
- Qaysi obyektlar: `hasPrivatizationLot` + `removedFromBalance = false` + `auctionGroupName`
  **ijara EMAS** (null — kat 3 bilan bir xil, xususiylashtirish). Guruh sharti shart:
  `hasPrivatizationLot` guruhga qaramay yoziladi.
- Soha: standart **"Ijara markazi"** (davijara — Markaz sayti; foydalanuvchi talabi 09.10) —
  dashboard jadvalidagi "Savdoda xususiy." ustuni shu soha tanlanganda ko'rsatadigan to'plam.
  `?soha=<nom>` boshqa soha, `?soha=all` barchasi. Soha admin UI'da qayta nomlansa,
  route'dagi `DEFAULT_SOHA` ham o'zgartirilsin.
- `hasPrivatizationLot` 1.22.1 dan boshlab AYNAN davijara mezoni (`isLotOpen`: ariza qabul
  qilinmoqda + sana oldinda). `lotStatus`/`auctionDate` baribir beriladi.
- Bitta lot bir nechta kadastrda kelishi mumkin (API 3 da alohida aktiv yozuvlari bitta
  buyurtmaga bog'langan, masalan bino + "MULKIY MAJMUA") — davijara `lotNumber` bo'yicha
  birlashtiradi.
- ⚠️ **Javob ommaviy saytga chiqadi** — `select` da shaxsiy ma'lumot ham, STIR ham YO'Q.
  Maydon qo'shsangiz shu qoidani saqlang.
- davijara uni OMMAVIY manzildan chaqiradi: `https://davijara.uz/obyektlar/api/davijara/privatization`.
  ⚠️ `127.0.0.1:3000` EMAS: bu ilova chekka serverda (`markazsrv`), davijara esa `markaz` da —
  u yerdagi :3000 boshqa ilova (09.10.2026 deploy'dan keyin shu sabab 0 chiqqan);
  token davijara'ning `shared/.env` → `PRIVATIZATION_API_TOKEN` bilan bir xil.
