# O'rnatish va yangilash

Production — **Linux + Docker**. Dev — **Windows, Docker'siz** (avvalgidek `npm run dev`).

---

## 1. Serverda birinchi o'rnatish

### 1.1 Talablar

```bash
docker --version          # 20.10+
docker compose version    # v2 kerak. Yo'q bo'lsa: sudo apt install docker-compose-plugin
```

Port **3000** bo'shligini tekshiring (`e-imzo` 8080/8081, redis 6380 da — to'qnashuv yo'q):

```bash
sudo ss -tlnp | grep 3000
```

### 1.2 Kodni olish va sozlash

```bash
git clone <repo-url> davlat-mulki && cd davlat-mulki
cp .env.production.example .env.production
```

`.env.production` ni to'ldiring. **Majburiy e'tibor beriladigan uchtasi:**

| O'zgaruvchi | Izoh |
|---|---|
| `POSTGRES_PASSWORD` | `DATABASE_URL` ichidagi parol bilan **bir xil** bo'lsin |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Foydalanuvchi brauzerga yozadigan **aniq** manzil (`https://domen`) |

### 1.3 Ishga tushirish

```bash
docker compose up -d --build
```

Bu ketma-ketlikda bo'ladi: `db` ko'tariladi → sog'lig'i tekshiriladi → `migrate` barcha
migratsiya va pg_trgm indekslarini qo'llaydi → `web` va `worker` ishga tushadi.

### 1.4 Boshlang'ich ma'lumot (faqat BIR MARTA)

Kategoriyalar, 14 hudud va super-admin:

```bash
docker compose --profile setup run --rm seed
```

> ⚠️ Buni jonli bazada takror ishlatmang — `CLAUDE.md` dagi seed ogohlantirishiga qarang.

Keyin `SEED_ADMIN_LOGIN` bilan kiring va **parolni darhol almashtiring**.

### 1.5 nginx va sub-path (`/obyektlar`)

Ilova `davijara.uz/obyektlar` ostida ishlaydi — Next.js `basePath: "/obyektlar"` bilan.
Bu **production build'da avtomatik** yoqiladi (`src/lib/basePath.ts` — `NODE_ENV=production`
bo'lsa `/obyektlar`, dev'da bo'sh). Ya'ni Docker image o'zi to'g'ri quriladi, qo'shimcha
sozlash SHART EMAS. Boshqa prefiks kerak bo'lsa — `src/lib/basePath.ts` va `next.config.mjs`
dagi qiymatni birga o'zgartiring.

`deploy/nginx.example.conf` ni namuna qilib oling. Muhim nuqtalar:

- **`location ^~ /obyektlar` bloki**, `proxy_pass http://127.0.0.1:3000;` — oxirida **path
  yo'q**, shunda nginx `/obyektlar` prefiksini kesmasdan uzatadi (Next.js basePath'ni
  shundan topadi).
- **`X-Forwarded-Proto` / `X-Forwarded-Host` / `Host`** sarlavhalari — busiz login
  redirect ichki `127.0.0.1:3000` manziliga ketadi (middleware tashqi domenni shu
  sarlavhalardan oladi).
- **`client_max_body_size 20m`** — busiz PDF yuklanmaydi (413).
- **`NEXTAUTH_URL`** — `.env.production` da FAQAT domen (`https://davijara.uz`), path
  qo'shilmaydi. HTTPS bo'lishi shart (aks holda sessiya cookie'lari `Secure` bo'lmaydi).

⚠️ Sub-path deploy'da sessiya cookie nomlari `obyektlar.session-token` ga o'zgaradi
(davijara ildizidagi ilova bilan to'qnashmasligi uchun) — yangilanishdan keyin barcha
foydalanuvchilar bir marta qayta kirishi kerak.

### 1.6 Tekshirish

```bash
docker compose ps                      # hammasi Up, migrate — Exited (0)
docker compose logs -f web worker
curl -I http://127.0.0.1:3000/login    # 200
```

So'ng brauzerda: kirish → **Sinxronizatsiya** sahifasidan hududni sync qilib ko'ring
(worker ishlayotganini shu tasdiqlaydi).

**Ijara imtiyozi** sozlangan bo'lsa (§2 dagi bo'limga qarang) — **Ijara imtiyozi** sahifasida
9 xonali STIR bilan tekshirib ko'ring va pastdagi "Tizim holati" panelini oching: Soliq, TIEK
va YATT indeksining holati ko'rinadi.

---

## 2. Yangi versiyani chiqarish

```bash
git pull
docker compose up -d --build
```

Shu ikki buyruq yetarli:

- `migrate` servisi **avtomatik** ishlaydi va faqat qo'llanmagan migratsiyalarni qo'llaydi
- `web` va `worker` yangi image bilan qayta yaratiladi — ya'ni "kod o'zgargach worker'ni
  qayta ishga tushiring" muammosi Docker'da o'z-o'zidan hal bo'ladi
- **Baza va yuklangan hujjatlar tegilmaydi** (ular volume'da)

Downtime ~5–15 soniya.

### ⚠️ "Migrate avtomatik" — faqat SXEMA uchun, MA'LUMOT uchun emas

`docker compose up -d --build` faqat `prisma/migrations/`ni qo'llaydi (jadval/ustun
o'zgarishlari). Quyidagilar **avtomatik EMAS** — pull qilingan commit'da shulardan biri
bo'lsa, alohida eslab qo'lda ishga tushiring:

- **`prisma/seed.ts`ga yangi manba/hudud/kategoriya qo'shilgan bo'lsa** — production'da
  ular hosil bo'lmaydi, chunki `seed` xizmati `--profile setup` ortida (atayin, tasodifiy
  qayta seed'lashdan himoya uchun). Qo'lda ishga tushiring:
  ```bash
  docker compose --profile setup run --rm seed
  ```
  Xavfsiz — STIR/kod bo'yicha upsert, mavjud yozuvni qayta yozmaydi, faqat yangisini qo'shadi.
- **Bir martalik tuzatish skripti** (`prisma/fix-*.ts` kabi) — bunday fayllar reponing
  o'zida qoladi, lekin hech qachon avtomatik ishga tushmaydi. `migrate` xizmatining
  image'idan foydalanib qo'lda chaqiring:
  ```bash
  docker compose run --rm migrate npx tsx prisma/<fayl-nomi>.ts
  ```
- **Yangi env o'zgaruvchisi qo'shilgan bo'lsa** — `.env.production` **git'da yo'q**, ya'ni
  `git pull` unga hech narsa qo'shmaydi. Konteyner esa `@/lib/env` dagi zod validatsiyasi
  bilan ishga tushadi: majburiy o'zgaruvchi yetishmasa **web ham, worker ham ko'tarilmaydi**.
  Pull qilgandan keyin `.env.production.example` bilan solishtiring:
  ```bash
  diff <(grep -oP '^[A-Z0-9_]+(?==)' .env.production.example | sort) \
       <(grep -oP '^[A-Z0-9_]+(?==)' .env.production | sort)
  ```
- **Umumiy qoida:** migratsiya papkasidan tashqarida `.ts` fayl orqali ma'lumot
  o'zgartirilsa (seed yoki bir martalik skript), uni push qilgan sessiyada shu haqda
  ANIQ eslatib o'tish kerak — "faqat kodni pull qiling" degan xulosa yetarli emas.

### Ijara imtiyozi (ПҚ-3782) — 1.8.0 dan boshlab

Ilgari alohida server edi (pm2 `imtiyoz-3782`, 3008-port). Endi dashboard ichida.

**1. `.env.production` ga besh o'zgaruvchi qo'shilishi SHART** (usiz konteyner ishga tushadi,
lekin imtiyoz sahifasi "sozlanmagan" ogohlantirishini beradi):

```bash
IMTIYOZ_COMP_WORKERS_URL="http://10.190.5.2:8675/markaz/comp_workers"
IMTIYOZ_YATT_WORKERS_URL="http://10.190.5.2:8675/markaz/yatt_workers"
IMTIYOZ_TIEK_URL="http://10.190.5.2:8675/markaz/minzdrav_pas"
IMTIYOZ_API_USER="rent"
IMTIYOZ_API_PASSWORD="<eski Imtiyoz-API .env dagi GATEWAY_PASSWORD>"
```

**2. Shartnoma formasining manzili o'zgartirilishi kerak** — eski ochiq endpoint
`http://<host>:3008/api/v1/check-discount/:tin` o'rniga:

```
https://davijara.uz/obyektlar/api/imtiyoz/check-discount/:tin
```

Javob shakli o'zgarmagan (`{ success, data }`, ichida `reason` va `tin`), auth talab
qilinmaydi, CORS ochiq. nginx'ga o'zgartirish **kerak emas** — bu yo'l allaqachon
`location ^~ /obyektlar` ostiga tushadi.

⚠️ **Eski `imtiyoz-3782` xizmatini FAQAT forma yangi manzilga o'tkazilgandan keyin to'xtating.**
Uning `data/` papkasidagi audit jurnali dashboard bazasiga ko'chirilmagan — o'chirmang, saqlab
qo'ying.

**3. Birinchi ishga tushishda worker YATT indeksini quradi** (butun respublika bo'yicha
~76 000 shartnoma yozuvi, bir necha daqiqa). Shu tugamaguncha **JSHSHIR** (14 xonali)
tekshiruvlari "hozircha aniqlanmadi" beradi — bu kutilgan xulq, xato emas. STIR (9 xonali)
tekshiruvlari indeksga bog'liq emas va darhol ishlaydi. Kuzatish:

```bash
docker compose logs -f worker | grep imtiyoz-yatt
# ✅ [imtiyoz-yatt] indeks tayyor: N tadbirkor, M bog'lanish, X/X sahifa
```

### ⚠️ Hech qachon

```bash
docker compose down -v      # -v BAZANI VA HUJJATLARNI O'CHIRADI
```

Konteynerlarni to'xtatish kerak bo'lsa: `docker compose down` (`-v` siz) yoki `stop`.

---

## 3. Zaxira nusxa (backup)

Ikkalasi ham kerak — bazasiz hujjatlar, hujjatsiz baza ma'nosiz.

```bash
# Baza
docker compose exec -T db pg_dump -U davlat davlat_mulki | gzip > db-$(date +%F).sql.gz

# Yuklangan PDF/rasmlar
docker run --rm -v davlat-mulki_uploads:/data -v "$PWD":/backup alpine \
  tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

Tiklash uchun teskarisi: `gunzip -c ... | docker compose exec -T db psql -U davlat davlat_mulki`.

---

## 4. Kundalik buyruqlar

| Maqsad | Buyruq |
|---|---|
| Loglar | `docker compose logs -f web worker` |
| Qayta ishga tushirish | `docker compose restart worker` |
| Bazaga kirish | `docker compose exec db psql -U davlat davlat_mulki` |
| Migratsiya holati | `docker compose run --rm migrate npx prisma migrate status` |
| Konteynerlar holati | `docker compose ps` |

---

## 5. Windows'dagi dev — nima o'zgardi

**Ish tartibi o'zgarmadi.** Lokal PostgreSQL (5433), `.env`, `npm run dev`, `npm run worker` —
hammasi avvalgidek.

Ikkita texnik o'zgarish bor, ikkalasi ham dev'ga ta'sir qilmaydi:

1. **`prisma/schema.prisma` → `binaryTargets`** — ro'yxatda `"native"` turgani uchun Windows
   ishlashda davom etadi, yoniga Linux engine ham yig'iladi. Bir marta `npm run prisma:generate`
   qilib qo'ying (dev server to'xtagan holda — aks holda Windows'da EPERM beradi).
2. **`next.config.mjs` → `output: "standalone"`** — `next dev` ga umuman ta'sir qilmaydi.
   `npm run build` qo'shimcha ravishda `.next/standalone` yaratadi, `npm start` avvalgidek ishlaydi.

Xohlasangiz, serverga jo'natishdan oldin aynan o'sha image'ni Windows'da sinab ko'rsa bo'ladi
(Docker Desktop kerak):

```bash
docker compose build
```

> ⚠️ Docker orqali to'liq ko'tarmoqchi bo'lsangiz, `.env.production` faylini Windows'da ham
> yarating — aks holda `env_file` topilmay xato beradi. Lokal sinov uchun `NEXTAUTH_URL`
> ni `http://localhost:3000` qilib qo'ying.

### Linux'ga o'tishdagi ikki tuzoq

- **Harf registri** — Linux registrga sezgir. Noto'g'ri registrdagi import Windows'da ishlaydi,
  Docker build'da yiqiladi. Build paytida darrov ko'rinadi.
- **CRLF** — `.gitattributes` qo'shildi, `.sh`/`Dockerfile`/`.yml` LF bilan saqlanadi.
  Windows'da ilgari klon qilingan repo'da bir marta: `git add --renormalize .`
