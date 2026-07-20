# Davlat mulki monitoring platformasi

Davlat mulki obyektlaridan samarali foydalanishni tahlil qiluvchi yopiq (internal) platforma.
**Dockersiz** — yagona tashqi bog'liqlik: PostgreSQL.

## Stek
- **Next.js 15** (App Router, RSC, Server Actions) + TypeScript
- **PostgreSQL 15** + **Prisma** (+ `pg_trgm` tezkor qidiruv uchun)
- **pg-boss** — fon rejim (sync) queue, **Postgres-native** (Redis kerak emas)
- **Auth.js (NextAuth v5)** — Credentials, rol asosida (SUPER_ADMIN / REGION_USER / VIEWER)
- **Tailwind CSS** + palitra (`--navy`, `--gold`, ...)

## Talablar
- Node.js 20.19+ yoki 22.13+
- PostgreSQL 15+ (lokal yoki tarmoqdagi server) — Docker SHART EMAS

### PostgreSQL o'rnatish (Docker'siz)
- **Windows:** [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) (EDB installer)
  yoki `winget install PostgreSQL.PostgreSQL.16`.
- **Linux:** `sudo apt install postgresql` (yoki tegishli paket).

Baza va foydalanuvchi yaratish (misol):
```sql
CREATE USER davlat WITH PASSWORD 'davlat';
CREATE DATABASE davlat_mulki OWNER davlat;
```
> `pg_trgm` va `pgboss` sxemalari avtomatik yaratiladi (indeks skripti / pg-boss tomonidan).

## Ishga tushirish

```bash
cp .env.example .env          # DATABASE_URL, NEXTAUTH_SECRET, API URL'larni to'ldiring

npm install
npm run prisma:generate
npm run prisma:migrate        # schema migratsiyasi
npm run db:indexes            # pg_trgm GIN indekslari
npm run db:seed               # 10 kategoriya, 14 hudud, super-admin

# 2 ta terminal:
npm run dev                   # http://localhost:3000
npm run worker                # pg-boss ishlovchisi (fon sync)
```

Super-admin: `.env`dagi `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

`NEXTAUTH_SECRET` yaratish (PowerShell):
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

## Production (Docker'siz)
Server'da: PostgreSQL o'rnatilgan, keyin:
```bash
npm ci
npm run build
npm run prisma:deploy && npm run db:indexes && npm run db:seed   # birinchi marta
# process manager (masalan pm2/systemd) bilan 2 ta process:
npm run start                 # web (Next.js)
npm run worker                # pg-boss worker
```
> `web` va `worker` alohida process, lekin bitta kod bazasi va bitta PostgreSQL'dan foydalanadi.

## Sahifalar va ruxsatlar

| Sahifa | Vazifasi | SUPER_ADMIN | REGION_USER | VIEWER |
|---|---|:--:|:--:|:--:|
| `/dashboard` | Aggregatlar, hudud/kategoriya kesimi | ✅ | ✅ | ✅ |
| `/dashboard/objects` | Ro'yxat, kadastr qidiruv, filtr, keyset pagination | ✅ (barcha) | ✅ (o'z hududi) | ✅ (barcha) |
| `/dashboard/objects/[cad]` | Tafsilot, API 3–8 natijalari, kategoriya + PDF biriktirish | ✅ | ✅ (o'z hududi) | ko'rish |
| `/dashboard/sync` | To'liq/hudud sinxronizatsiya, jonli progress | ✅ | ✅ (o'z hududi) | ko'rish |
| `/dashboard/sources` | Manba/STIR boshqaruvi (API 1 uchun) | ✅ | — | — |
| `/dashboard/users` | Foydalanuvchi yaratish, rol/hudud, parol | ✅ | — | — |
| `/api/documents/[id]` | PDF berish (auth + hudud tekshiruvi bilan) | ✅ | o'z hududi | ✅ |

> ⚠️ Birinchi ishga tushirishda `/dashboard/sources` sahifasidan **real STIR'larni** kiriting —
> seed soxta qiymat (`30000000N`) qo'yadi va u bilan API 1 ishlamaydi.

## Arxitektura (qisqacha)
- `src/server/integrations/*` — tashqi API 1–8 mijozlari, retry/backoff, `withCadFallback`
  (yangi kadastr topilmasa `cad_number_old` bilan qayta urinish). Per-API rate-limit — in-memory
  token-bucket (`rateGuard`, `RateLimiterMemory`).
- `src/server/queue/*` — pg-boss pipeline: `sync-source` (API1 fan-out) →
  `property-base` (API2 upsert, `cadNumberOld` saqlaydi) → `status-check` (API3–8 + klassifikatsiya).
  `boss.ts` (singleton), `dispatch.ts` (enqueue), `worker.ts` (ishlovchi), `jobs.ts` (tiplar).
- `src/server/services/classification.ts` — integratsiya kategoriyasi (1–4) va `isInefficient`.
- `src/server/services/stats.ts` — dashboard aggregatlari, `unstable_cache` (tag `dashboard` + 60s TTL:
  worker alohida process bo'lgani uchun `revalidateTag` chaqira olmaydi, fon natijalari ≤60s da ko'rinadi).
- `src/server/services/properties.ts` — keyset pagination + `pg_trgm` qidiruv, rol/hudud doirasi.
- `prisma/schema.prisma` — 80k+ obyektga mo'ljallangan indekslar.

> Demo/soxta obyekt seed'i **olib tashlangan** — bazada faqat API 1 va API 2 dan kelgan
> real ma'lumot bo'lishi kerak. Sinov uchun obyekt kerak bo'lsa, real STIR bilan
> `/dashboard/sync` orqali bitta hududni sinxronlang.

Batafsil reja: `.claude/plans/` ichidagi arxitektura hujjati.
