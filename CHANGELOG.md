# Changelog

Faqat kod ichida — ilova UI'sida ko'rsatilmaydi. `package.json`dagi `version`
**git'ga push qilinganda** oshiriladi (Sidebar'dagi versiya belgisi bilan bir xil
raqam) — ishlash davomida emas. Shu paytgacha to'plangan o'zgarishlar pastdagi
"Chiqarilmagan" bo'limda yig'iladi, push paytida versiya raqami beriladi.

## Chiqarilmagan

## 1.8.0

- **Yangi bo'lim: "Ijara imtiyozi" (ПҚ-3782)** — sidebarda alohida menyu, hamma rolga ochiq.
  Ijarachining STIR yoki JSHSHIR raqami bo'yicha 50% lik ijara imtiyozini tekshiradi:
  xodimlarning kamida 30% ini nogironligi bo'lgan shaxslar tashkil etsa, imtiyoz beriladi.
  Xodimlar ro'yxati Soliq bazasidan, nogironlik holati TIEK reyestridan olinadi.
  Ilgari bu alohida ilova edi (o'z serveri, o'z logini, o'z bazasi) — endi dashboard ichida,
  bitta login bilan. **Obyektlar va kategoriyalarga hech qanday aloqasi yo'q.**
- **Uzilish hech qachon rad javobiga aylanmaydi.** Tashqi baza javob bermasa yoki xodimlar
  ro'yxati to'liq yuklanmasa, natija "Imtiyoz qo'llanilmaydi" emas, **"Hozircha aniqlanmadi"**
  bo'ladi — nima aniq noto'g'ri ketgani ro'yxat qilib ko'rsatiladi va "Qayta tekshirish"
  tugmasi chiqadi. Rad javobida bu tugma **umuman yo'q**: operator rad javobini vaqtinchalik
  nosozlik deb tushunib qolmasin.
- **Qayta tekshirish faqat tekshirilmagan xodimlarni qayta so'raydi** — muvaffaqiyatli
  javoblar keshda qoladi. Jonli o'lchov: 5 xodimli tekshiruvda qayta urinishda reyestrga
  5 ta emas, **1 ta** so'rov ketdi.
- **Tekshiruvlar tarixi** — kim, qachon, qaysi raqamni tekshirgan va qanday javob berilgan.
  Har bir yozuvni ochib, o'sha paytdagi natijaning **o'zgarmagan nusxasini** ko'rish mumkin
  (chop etish bilan). Filtrlar: STIR/JSHSHIR, natija turi, sana oralig'i. CSV eksport bor.
  Jurnal **faqat to'ldiriladi** — yozuvni o'zgartirish yoki o'chirish yo'li yo'q.
- **Shartnoma formasi uchun ochiq manzil o'zgardi** — eski alohida serverdagi
  `:3008/api/v1/check-discount/:tin` o'rniga endi
  `davijara.uz/obyektlar/api/imtiyoz/check-discount/:tin`. Javob shakli o'zgarmagan.
  ⚠️ Formani yangi manzilga o'tkazmasdan eski serverni to'xtatmang — `DEPLOY.md` §2 ga qarang.
- ⚠️ **Deploy:** `.env.production` ga beshta yangi o'zgaruvchi qo'shilishi kerak
  (`IMTIYOZ_*`), tafsilotlar `DEPLOY.md` da. Worker birinchi ishga tushganda YATT indeksini
  quradi (bir necha daqiqa) — shu tugamaguncha 14 xonali JSHSHIR tekshiruvlari
  "aniqlanmadi" beradi, 9 xonali STIR esa darhol ishlaydi.

## 1.7.1

- **Bug fix: "Sotilgan" biriktirilgan obyektni qaytarib bo'lmasdi** — "Kategoriyani
  bekor qilish" bloki chiqmasdi. Sabab: shart EFFEKTIV kategoriya bo'yicha edi
  (`9` yoki `10`), bu esa "9/10 hech qachon integratsiyadan kelmaydi" degan taxminga
  tayanardi. Kat 1 qo'shilgach taxmin buzildi. Endi shart qo'lda biriktirilgan
  kategoriya (`manualCategoryCode`) bo'yicha — server tekshiruvi bilan bir xil.
- **Biriktirishlar tarixida endi sana bilan birga VAQT ham** ko'rsatiladi.

## 1.7.0

- **Qo'lda biriktirishga "Sotilgan" qo'shildi** — ilgari faqat "Yaroqsiz holat" va
  "Chekka hudud" bor edi. ⚠️ Ro'yxatda oddiy **"Sotilgan"** deb ko'rinadi, lekin
  saqlanganda kategoriya **"Sotilgan (Bo'lib to'lash sharti bilan)"** bo'lib yoziladi:
  qo'lda biriktiriladigan sotuv har doim bo'lib to'lash sharti bilan hisoblanadi.
  Avvalgidek — faqat "Bo'sh turgan" obyektga, asoslovchi PDF bilan; ijrochi uchun
  tasdiqlash zanjiri (Moderator → Rahbariyat) o'zgarmadi.

## 1.6.1

- **Bug fix: rasm biriktirish formasi yuborilgandan keyin noto'g'ri holatda qolishi** —
  hisoblagich "4/4" deb turar, lekin fayllar tanlanmagan bo'lardi va "+" tugmasi
  chiqmasdi. Sabab: server action tugagach React formani o'zi tozalaydi, komponent
  holati esa eski qiymatda qolib ketardi.
- **Fayl saqlashdagi ruxsat xatosi endi tushunarli** — ilgari xom
  `EACCES: permission denied, mkdir 'app'` matni foydalanuvchiga shundayligicha
  ko'rinardi. Endi xabar qaysi katalog va qaysi sozlama (`UPLOAD_DIR`) sabab
  bo'lganini aytadi.

## 1.6.0

- **Kommunal (suv/gaz/elektr) umumiy sinxronizatsiyadan uzildi** — endi u
  `FULL_ALL`/`REGION`/`SINGLE` va kunlik avtomatik sinxronizatsiyaga **kirmaydi**,
  faqat "Faqat holat yangilash"da "Kommunal" belgisi qo'lda tanlanganda ishlaydi
  (belgi ham standart holatda yoqilmagan). Sabab: bu API'lar barqaror emas va ular
  boshqa modullar bilan bitta so'rovlar to'plamiga kirgani uchun bitta HTTP 500
  BUTUN obyekt tekshiruvini yiqitardi — obyektning auksion/ijara ma'lumoti ham
  yangilanmay qolardi (jonli o'lchov: bir run'da 35 xatodan 34 tasi shundan).
- **Sinxronizatsiya xatolari endi tushunarli** — ilgari faqat "HTTP 500" yoki
  "fetch failed" ko'rinardi, ya'ni qaysi tashqi API yiqilgani ham, nima bo'lgani ham
  noma'lum edi. Endi xato uch qismdan iborat: qaysi API (o'zbekcha nomi bilan),
  nima bo'lgani (server ichki xatosi / ulanmadi / vaqt tugadi / login-parol /
  rate-limit / kadastr topilmadi) va muammo kim tomonida. Sinxronizatsiya tarixida
  va obyekt sahifasida ko'rsatiladi (faqat adminlarga).
- **Xato sababi endi sinxronizatsiya yozuvining o'zida saqlanadi**
  (`SyncRun.failureSummary`). Ilgari u obyektning oxirgi holatidan hisoblanardi va
  keyingi sinxronizatsiya obyektni yangilashi bilan yo'qolardi — natijada tarixdagi
  "xato: 33" soni bilan aniqlangan sabablar soni (8) mos kelmasdi.
- **Rasm biriktirishda "+" tugmasi** — rasmlar endi birma-bir qo'shiladi (4 tagacha),
  har birida olib tashlash tugmasi va `2/4` hisoblagichi bilan. Ilgari bitta umumiy
  maydon edi va ikkinchi marta tanlash birinchi tanlovni butunlay almashtirib yuborardi.
- **Foydalanuvchilar ro'yxatida filtr tashkilot emas, SOHA bo'yicha** (bitta sohaga
  14 hududning tashkilotlari kiradi, shuning uchun soha kesimi amaliyroq).
- **Obyekt sahifasida "Sinxron" o'rniga oxirgi sinxronizatsiya vaqti** ko'rsatiladi;
  "API orqali yangilash" tugmasi bosilganda holat ko'rinadi ("Yuborilmoqda...",
  "Navbatga qo'yildi") va 5 soniya qayta bosilmaydi — ilgari hech qanday reaksiya
  bermasdi, chunki ish fon jarayoniga (worker) o'tib ketardi.

## 1.5.0

- **Elektr — 2-bosqichli tafsilot (`het_data_detail`)** — 1-bosqich faqat abonent
  kodini berardi (nom, sarf, to'lov yo'q). Endi API 3→4 auksion zanjiri naqshida
  har bir abonent kodi uchun alohida so'rov yuboriladi va abonent ismi, manzili,
  balans, oylik sarf (kVt·soat), oxirgi to'lov sanasi, hisoblagich va tarif olinadi.
- **Elektr abonentining kadastr mosligi tekshiriladi** — tashqi API kadastrni
  taxminan moslashtiradi, ya'ni topilgan abonent ko'pincha BOSHQA obyektning uy
  xo'jaligi bo'lib chiqadi. Yangi `electricCadastreMatch` bayrog'i haqiqiy moslikni
  soxtasidan ajratadi; obyekt sahifasida va ro'yxatda alohida ko'rsatiladi.
- **"Yaqinda to'lov bo'lgan" mezoni endi gaz YOKI elektr** — ilgari faqat gaz edi.
  Ikkita yangi filtr ham qo'shildi: "Elektr sarfi bor", "Elektr abonenti kadastri mos".
- Shaxsiy ma'lumotlar (passport, PINFL, telefon) saqlashdan oldin olib tashlanadi —
  bu maydonlar hisob-kitobga kirmaydi.
- **Bug fix: gaz/elektr to'lov sanasi ro'yxatda ikki xil formatda chiqishi** —
  vendorlar sanani boshqa-boshqa formatda beradi (`DD.MM.YYYY` / `YYYY-MM-DD`),
  endi ikkalasi ham bir xil ko'rinishda.

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
