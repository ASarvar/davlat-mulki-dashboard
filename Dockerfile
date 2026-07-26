# syntax=docker/dockerfile:1
#
# Davlat mulki monitoring platformasi — production image.
#
# Ikkita runtime bosqichi bitta build'dan chiqadi:
#   web    — Next.js standalone serveri (kichik, faqat `node server.js`)
#   tools  — worker + migratsiya (to'liq node_modules: tsx, prisma CLI shu yerda)
#
# docker-compose.yml `target:` orqali qaysi bosqich kerakligini tanlaydi.
# Ikkalasi ham `deps`/`builder` bosqichlarini baham ko'radi — qayta build tez bo'ladi.

ARG NODE_IMAGE=node:22-bookworm-slim

# ───────────────────────────── deps ─────────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app

# openssl — Prisma query engine uchun shart (slim image'da yo'q).
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# ──────────────────────────── builder ────────────────────────────
FROM deps AS builder
WORKDIR /app

# Avval schema — shunda kod o'zgarganda `prisma generate` qatlami kesh'dan olinadi.
COPY prisma ./prisma
RUN npx prisma generate

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# `next build` sahifa modullarini import qiladi, ular esa src/lib/env.ts ni ishga tushiradi
# (zod validatsiyasi) — shuning uchun build paytida soxta qiymat kerak.
# ⚠️ ENV emas, faqat shu RUN uchun: aks holda qiymatlar `tools` image'iga meros bo'lib
#    o'tadi va .env.production'da DATABASE_URL unutilsa xato o'rniga soxta bazaga ulanardi.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    NEXTAUTH_SECRET="build-time-only-not-a-real-secret" \
    npm run build

# ────────────────────────────── web ──────────────────────────────
# Next.js standalone: minimal server + faqat kerakli node_modules.
FROM ${NODE_IMAGE} AS web
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Standalone tracing Prisma engine'ini har doim ham ilib ketmaydi — aniq nusxalaymiz.
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma

# PDF/rasm katalogi — compose'da volume shu yerga ulanadi.
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data

USER node
EXPOSE 3000
CMD ["node", "server.js"]

# ───────────────────────────── tools ─────────────────────────────
# Worker (tsx kerak) va migratsiya (prisma CLI kerak) uchun to'liq muhit.
# `builder`dan meros — node_modules, src/, prisma/ hammasi joyida.
FROM builder AS tools
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN mkdir -p /app/data/uploads && chown -R node:node /app/data

USER node
CMD ["npx", "tsx", "src/server/queue/worker.ts"]
