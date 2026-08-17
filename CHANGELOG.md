# Changelog

Faqat kod ichida — ilova UI'sida ko'rsatilmaydi. `package.json`dagi `version`
**git'ga push qilinganda** oshiriladi (Sidebar'dagi versiya belgisi bilan bir xil
raqam) — ishlash davomida emas. Shu paytgacha to'plangan o'zgarishlar pastdagi
"Chiqarilmagan" bo'limda yig'iladi, push paytida versiya raqami beriladi.

## Chiqarilmagan

## 1.4.0

- **Kommunal xizmatlar (suv / gaz / elektr)** — uchta yangi tashqi API orqali obyektning
  suv, gaz va elektr abonenti bor-yo'qligi tekshiriladi. Sinxronizatsiyaning **4-moduli**
  sifatida qo'shildi ("Faqat holat yangilash" bo'limida alohida belgi bilan yoqiladi va
  kunlik avtomatik sinxronizatsiyaga ham kiradi). Kategoriyaga ta'sir qilmaydi —
  mustaqil kuzatuv o'lchovi.
- **Boshqaruv panelida yangi jadval — "Bo'sh turgan obyektlarda kommunal xizmatlar"**.
  Barcha sonlar faqat "Bo'sh turgan" (11-kategoriya) obyektlar bo'yicha: soni va foydali
  maydoni, so'ng suv/gaz/elektr abonenti topilganlar, kamida bittasi, **yaqinda to'lov
  bo'lganlar** va tekshirilmaganlar. Hududlar tumanlar kesimida ochiladi, har bir son
  ro'yxatga havola, Excelga eksport qilinadi (Hududlar + Tumanlar varaqlari).
- **"Yaqinda to'lov" ko'rsatkichi** — gazning oxirgi to'lovi belgilangan oy ichida
  (standart 3 oy) bo'lgan obyektlar. "Abonenti bor" bayrog'i ancha oldin yopilgan
  hisobni ham ko'rsatardi; to'lov sanasi esa obyekt **hozir** foydalanilayotganini
  bildiradi.
- **Kommunal ro'yxat ko'rinishi** — jadvaldagi raqam bosilganda obyektlar ro'yxati
  ixcham ko'rinishga o'tadi (Kadastr · Suv · Gaz · Elektr). Xizmat katakchasi bosilganda
  o'sha xizmatning asosiy ma'lumotlari qator ostida ochiladi; obyekt sahifasiga faqat
  kadastr raqami orqali o'tiladi.
- **Obyekt sahifasida "Kommunal xizmatlar" bo'limi** — asosiy ma'lumotlardan keyin uchta
  karta (abonent, balans, oxirgi to'lov, sarf). "Bo'sh turgan" obyektda abonent topilsa
  sahifa tepasida ogohlantirish chiqadi.
- **So'rovlar oqimida kommunal ogohlantirish** — ijrochi obyektni Yaroqsiz/Chekka'ga
  o'tkazish so'rovini yuborganda, moderator va rahbariyat qaror qabul qilishdan oldin
  o'sha obyektda kommunal abonent borligini ko'radi (yaqinda to'lov bo'lsa qizil belgi).
  Ilgari bu ma'lumot faqat obyekt sahifasida bo'lgan.
- Obyektlar ro'yxatiga `?utility=` filtri qo'shildi (suv / gaz / elektr / kamida bittasi /
  yaqinda to'lov / hech biri / tekshirilmagan).

## 1.3.0

- **Balansdan chiqarilgan obyektlar** — sinxronizatsiyada obyekt manba (STIR) API 1
  ro'yxatidan tushib qolsa (odatda boshqa tashkilotga o'tkazilgan), o'chirilmaydi —
  "Balansdan chiqarilgan" deb belgilanadi va imkon bo'lsa yangi egasi (STIR/nomi)
  aniqlanadi. Bunday obyektlar asosiy dashboard hisoblariga **kirmaydi**, faqat
  Obyektlar sahifasida shu kategoriyani tanlab, **faqat admin** ko'ra oladi.
- **Yer/Bino ajratish** (Davlat aktivlari agentligi va Direksiya uchun) — obyekt
  11 ta kadastr maydoni bo'yicha yer yoki bino deb aniqlanadi; shu ikki soha uchun
  dashboard jadvalida tegishli ustunlar Yer/Bino kesimida ko'rsatiladi (jumladan
  "Ijaraga berilgan obyektlar" ustuni). Direksiyaning sinxronizatsiya doirasi
  Toshkent shahar bilan cheklandi.
- **Kadastr tekshirish** (`/dashboard/cadastre-check`, faqat admin) — kadastr
  raqami bo'yicha API 2 ga jonli so'rov yuborib, xom javobni ko'rsatuvchi
  diagnostika vositasi.
- **Moderator ko'rish doirasi kengaytirildi** — endi kuzatuvchi kabi barcha
  obyekt va so'rovlar tarixini ko'radi; tasdiqlash huquqi esa faqat o'z
  tashkiloti(lari) bilan cheklanadi ("Mening tashkilotim" tugmasi bilan qaytariladi).
- **Boshqaruv panelidagi ikkala jadval qayta dizayn qilindi** — zamonaviy,
  toza ko'rinish (sticky ustunlar, zebra qatorlar).
- **Bug fix: "Savdoda ijara" Maydon ustuni** — kichik ijara lotlari
  "ming m²"da 0,0 ga yaxlitlanib ko'rinardi, endi to'g'ri birlikda chiqadi.
- **Bug fix: sinxronizatsiya xatosi matni** (masalan "fetch failed") endi
  faqat adminlarga ko'rinadi — boshqa rollar uchun tushunarsiz va foydasiz edi.

## 1.2.0

- **Foydalanuvchi doirasi — hudud emas, tashkilot** — userlar endi hududga emas,
  bitta yoki bir nechta tashkilotga (`OrganizationSource`) biriktiriladi;
  respublika darajasidagi tashkilotlar (Agentlik, Direksiya) shu bilan bir
  nechta hududdagi obyektni to'g'ri ko'rsatadi.
- **Hududiy tashkilotga biriktirilgan foydalanuvchi uchun dashboard statistikasi**
  yangilandi — o'z tashkiloti doirasida to'g'ri hisoblanadi.
- **Docker** — pgAdmin uchun port qo'shildi (lokal DB ko'rish qulayligi uchun).
- Bir martalik tuzatish: eski manba nomlari soha nomiga moslashtirildi.

## 1.1.0

- **Tuman kesimi** — API 2 dagi `district_id` asosida `District` jadvali (205 tuman,
  mavjud 5441 obyekt backfill qilindi). Dashboard'da hudud qatorini ochib tumanlar
  statistikasini ko'rish, obyektlar ro'yxatida tuman filtri va ustuni, obyekt
  sahifasida tuman maydoni, Excel eksportida tuman ustuni.
- **Dashboard Excel eksporti — "Tumanlar" varag'i** — barcha 205 tuman hudud bo'yicha
  guruhlangan holda, "Hududlar" varag'i bilan bir xil ustunlarda.
- **"Hududlar kesimi — ijara shartnomalari" jadvalida ham tumanlar** — hudud qatorini
  ochish ikkala jadvalda ham bir vaqtda ishlaydi (bitta `?tuman=` parametri).
- **Sidebar'da versiya belgisi** — `package.json` → `version`dan avtomatik o'qiladi.
- **Tasdiqlash so'rovlari sahifasida filtr** — kategoriya, holat (faqat tarixda),
  hudud va so'rovchi (ism/login) bo'yicha. Ikkala jadval (kutilayotgan + tarix)
  bitta forma orqali boshqariladi.
- **Bug fix: dashboard manba tugmalari joyidan siljib ketishi** — sarlavha
  ostidagi matn uzunligi o'zgarganda tugmalar guruhi endi o'ng chetga qat'iy
  tekislangan, `justify-between` orqali siljimaydi.
- Dashboard manba tugmalari tartibi: **Ijara markazi** har doim birinchi,
  **Hammasi** oxirida.

- **Rollar va tasdiqlash workflow** — `RAHBARIYAT` roli qo'shildi, ikki bosqichli
  zanjir (Ijrochi → Moderator qabul qiladi → Rahbariyat tasdiqlaydi/rad etadi).
  Rad etishda sabab majburiy, kategoriya qaytarilganda ham izoh saqlanadi
  (Biriktirishlar tarixida ko'rinadi). Har bir rol uchun so'rovlar tarixi
  (`/dashboard/requests`).
- **Fayl yuklashda rasm** — asoslovchi PDF'dan tashqari 4tagacha ixtiyoriy rasm
  (JPG/PNG/WEBP), PDF hujjatning bolasi sifatida saqlanadi.
- **Docker** — production (Linux) uchun to'liq konteynerlashtirish (`web`,
  `worker`, `migrate`, `db`), Windows'dagi dev muhitiga tegmaydi. `DEPLOY.md`.
- **Manba (soha) kesimi** — dashboard endi manba bo'yicha filtrlanadi
  (Ijara markazi / Davlat aktivlari agentligi / Direksiya / Hammasi),
  drill-down havolalar va Excel eksporti ham shu kesimda.
- **Bug fix: "Bo'sh turgan" statistikasi** — karta va jadval soni orasidagi
  poyga holati (race condition) bartaraf etildi; maydon kartasi endi to'g'ri
  ustunga (kat 11, kat 12 emas) ulanadi.
- **Bug fix: sotilgan obyektlarda auksion lot ma'lumoti** — `AuctionLot`
  yozuvi endi obyekt sotilgandan keyin ham saqlanadi (ilgari qayta
  sinxronlanganda o'chib ketardi).
- **Bug fix: rol o'zgarishi** — sessiya endi rol/hududni har so'rovda DB'dan
  o'qiydi (JWT'dan emas) — eski token bilan noto'g'ri huquqda qolish bug'i
  tuzatildi.
- Manbalar sahifasida soha nomi mavjudlaridan tanlash yoki yangisini yozish
  (datalist), tashkilot to'liq nomi alohida maydon.

## 0.1.0

- Boshlang'ich versiya: 3 bosqichli sinxronizatsiya pipeline (API 1-6),
  12 kategoriya, hudud/kategoriya kesimidagi boshqaruv paneli, auksion lotlari,
  ijara shartnomalari, Excel eksporti, SUPER_ADMIN/REGION_USER/VIEWER rollari.
