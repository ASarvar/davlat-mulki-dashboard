---
name: sections
description: Bo'limlar ko'rinishi — lib/sections.ts registri, SectionAccess jadvali, canAccess/requireSection, allowRoles qattiq chegarasi, hiddenForSohas, core va panel bo'limi, notFound qoidasi. Yangi sahifa/bo'lim qo'shish yoki rol ko'rinishini o'zgartirish uchun oching.
---
# Bo'limlar ko'rinishi — SectionAccess

CLAUDE.md dan ko'chirilgan (2026-10-12) — matn o'zgarishsiz.

### Bo'limlar ko'rinishi — `SectionAccess` (2026-09-05)

Qaysi sahifa qaysi rolga ko'rinishi **bazadan** boshqariladi, deploysiz. Maqsad:
yangi bo'lim serverga chiqarilgach avval FAQAT super admin ko'radi, tekshirilgandan
keyin super admin uni boshqa rollarga ochadi.

```
src/lib/sections.ts               REGISTR (kod): key, href, label, exact, allowRoles, core
SectionAccess (Postgres)          RUXSAT (super admin o'zgartiradi): visibility + roles[]
services/sectionAccess.ts         canAccess / allowedSectionKeys / requireSection
/dashboard/sections               boshqaruv UI (faqat SUPER_ADMIN)
```

⚠️ **YANGI SAHIFA QO'SHSANGIZ IKKI QADAM MAJBURIY:**
1. `lib/sections.ts` → `SECTIONS` ga qator (+ `Sidebar.tsx` → `ICONS` ga ikonka);
2. sahifa boshida `await requireSection("<key>")`.

Registrsiz sahifa menyuda umuman ko'rinmaydi; `requireSection`siz esa menyudan
yashiringan bo'lsa ham URL orqali ochilaveradi.

⚠️ **Menyu va qorovul — endi BITTA manba.** Ilgari ikkita edi (`Sidebar.tsx` →
`NAV.roles` va sahifadagi `requireRole`) va ular allaqachon ajralib ketgan edi:
`/dashboard/notifications` menyuda ikki rolga ko'rinardi, lekin manzilni qo'lda
yozgan **istalgan rol** sahifani ochardi. `Sidebar` endi rol mantiqini umuman
bilmaydi — `layout.tsx` `allowedSectionKeys(user)` ni hisoblab prop qilib beradi.

⚠️ **Qator yo'q = `SUPER_ONLY`** (fail-closed). Shuning uchun yangi bo'lim hech
narsa sozlanmasa ham avtomatik yashirin. Buning teskari tomoni: **migratsiyada
mavjud bo'limlarning qatorlarini yozish MAJBURIY**, aks holda ertasiga super
admindan boshqa hech kim hech narsani ko'rmaydi.

⚠️ **`SectionDef.allowRoles` — koddagi QATTIQ CHEGARA**, bazadagi sozlama uni
kengaytira olmaydi (`setSectionAccess` yozishda, `canAccessWith` o'qishda filtrlaydi).
Super admin `/dashboard/users` ni kuzatuvchiga ocholmaydi. Bu "eng past rol"
(ierarxiya) EMAS, aynan TO'PLAM — loyihadagi 6 rol chiziqli tartibda emas.
⚠️ Migratsiyada admin bo'limlari `EVERYONE` emas, aniq `ROLES` ro'yxati bilan
yozilgan: `EVERYONE` "allowRoles doirasidagi hamma" degani, ya'ni kelajakda kimdir
`allowRoles`ni kengaytirsa bo'lim jimgina ko'proq odamga ochilib ketardi.

⚠️ **SUPER_ADMIN har doim hamma bo'limni ko'radi** — rejimdan qat'i nazar. Busiz u
`/dashboard/sections` ni o'zidan yopib, boshqaruv panelini butunlay yo'qotishi mumkin
bo'lardi. Yon ta'siri: super admin menyusida "Bildirishnomalar" ham paydo bo'ldi
(ilgari u faqat IJROCHI/MODERATOR ga ko'rinardi) — bu ataylab, chunki ish tartibi
super admin ochilmagan bo'limni OLDIN ko'rishini talab qiladi.

⚠️ **`/dashboard` — `core: true` + `hidden: true`**: u faqat KIRISH MARSHRUTI,
menyu bandi EMAS. `app/page.tsx` tizimga kirgan foydalanuvchini o'sha yerga
yo'naltiradi, shuning uchun u hech qachon yopilmasligi kerak — aks holda odam
kirgan zahoti "sahifa topilmadi"ga tushardi. Lekin marshrutning O'ZI hech narsa
ko'rsatmaydi: ruxsatga qarab `panel` (vizual panel) yoki `firstOpenSectionHref()`
(odatda `hisobot`) ga uzatadi.

⚠️ **Vizual panel — alohida `panel` bo'limi, `core` EMAS.** 1.10.0 da u
to'g'ridan-to'g'ri `core` marshrutda edi va shu sabab serverga chiqarilgan zahoti
HAMMA rolga ochilib ketgan edi (foydalanuvchi topdi, 2026-09-05) — aynan
`SectionAccess` oldini olishi kerak bo'lgan holat. Saboq: **`core` — "hamma
ko'radi" degani EMAS, "marshrut yopilmaydi" degani.** Ko'rinishi boshqariladigan
har qanday MAZMUN `core` marshrutda emas, o'z bo'limida yashashi kerak.

⚠️ **Ruxsat yo'qda `notFound()`, `throw` EMAS.** Next.js production'da xato
XABARINI o'chiradi (faqat `digest` qoladi), ya'ni `error.tsx` da "Ruxsat yo'q"ni
matn bo'yicha ajratib bo'lmasdi — dev'da ishlab, serverda ishlamasdi. Ko'rinish
`app/dashboard/not-found.tsx` da; matn ataylab bo'limning borligini oshkor qilmaydi.

⚠️ **Kesh — `cache()` (so'rov ichida), `unstable_cache` EMAS.** Ruxsat o'zgarishi
60 soniyalik TTL kutmasligi kerak. Saqlashdan keyin `revalidatePath("/dashboard",
"layout")` — Sidebar layoutda quriladi.

⚠️ **`SectionDef.hiddenForSohas`** — soha bo'yicha qattiq chegara (2026-09-23): imtiyoz
Direksiya va Davlat aktivlari agentligi xodimlariga ko'rinmaydi. Faqat tashkilotga bog'langan
rollarga (Ijrochi, Moderator) va faqat BARCHA tashkilotlari shu sohalarda bo'lsa qo'llanadi.

⚠️ **Bo'limni yashirish uning API route'ini yashirmaydi.** Yangi bo'limning har bir
`route.ts` va server action'i ham `requireSection(key)` bilan boshlanishi kerak.
Middleware buni bajara olmaydi (edge, Prisma yo'q) — himoya sahifa/route darajasida.
