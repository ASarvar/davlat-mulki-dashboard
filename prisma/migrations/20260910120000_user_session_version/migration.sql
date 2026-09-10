-- Sessiya versiyasi: parol almashtirilganda oshiriladi va o'sha foydalanuvchining
-- BARCHA faol sessiyalari (JWT) bekor bo'ladi. JWT o'zi ichida hamma narsani
-- saqlagani uchun uni serverdan "o'chirib" bo'lmaydi — shuning uchun token ichidagi
-- versiya har so'rovda bazadagisi bilan solishtiriladi (`getCurrentUser`).
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
