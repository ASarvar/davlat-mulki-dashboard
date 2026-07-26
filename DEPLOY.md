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

### 1.5 nginx

`deploy/nginx.example.conf` ni namuna qilib oling. Undagi `client_max_body_size 20m`
va `X-Forwarded-*` sarlavhalari **shart** — birinchisisiz PDF yuklanmaydi, ikkinchisisiz
login redirect buziladi.

### 1.6 Tekshirish

```bash
docker compose ps                      # hammasi Up, migrate — Exited (0)
docker compose logs -f web worker
curl -I http://127.0.0.1:3000/login    # 200
```

So'ng brauzerda: kirish → **Sinxronizatsiya** sahifasidan hududni sync qilib ko'ring
(worker ishlayotganini shu tasdiqlaydi).

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
