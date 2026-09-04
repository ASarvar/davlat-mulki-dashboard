-- CreateEnum
CREATE TYPE "SectionVisibility" AS ENUM ('SUPER_ONLY', 'ROLES', 'EVERYONE');

-- CreateTable
CREATE TABLE "SectionAccess" (
    "key" TEXT NOT NULL,
    "visibility" "SectionVisibility" NOT NULL DEFAULT 'SUPER_ONLY',
    "roles" "Role"[] DEFAULT ARRAY[]::"Role"[],
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionAccess_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "SectionAccess" ADD CONSTRAINT "SectionAccess_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Mavjud bo'limlarni HOZIRGI ruxsatlari bilan ko'chirish.
--
-- ⚠️ Bu qadam MAJBURIY: `SectionAccess`da qatori yo'q bo'lim `SUPER_ONLY` deb
-- qaraladi (fail-closed). Qatorlarsiz deploy qilinsa ertasiga super admindan
-- boshqa hech kim hech qanday bo'limni ko'rmasdi.
--
-- Qiymatlar `Sidebar.tsx` → `NAV.roles` dan aynan ko'chirildi, ya'ni hech kim
-- uchun hech narsa o'zgarmaydi.
--
-- ⚠️ `EVERYONE` emas, aniq `ROLES` ro'yxati ishlatiladi (admin bo'limlarida):
-- `EVERYONE` "SectionDef.allowRoles doirasidagi hamma" degani, ya'ni kelajakda
-- kimdir koddagi `allowRoles`ni kengaytirsa bo'lim JIMGINA ko'proq odamga
-- ochilib ketardi. Aniq ro'yxat bunday sodir bo'lishiga yo'l qo'ymaydi.
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ `now()` EMAS, `now() AT TIME ZONE 'UTC'`. Prisma `DateTime`ni
-- `timestamp(3) WITHOUT TIME ZONE` ga xaritalaydi va o'qiyotganda uni UTC deb
-- HISOBLAYDI. Oddiy `now()` esa bazaning MAHALLIY vaqtini (bu yerda
-- Asia/Tashkent) yozadi — natijada sanalar 5 soat oldinga siljib qolardi
-- (mahalliy sinovda aynan shunday chiqdi: 02:20 o'rniga 07:14).
INSERT INTO "SectionAccess" ("key", "visibility", "roles", "updatedAt") VALUES
  ('dashboard',      'EVERYONE',   ARRAY[]::"Role"[],                              now() AT TIME ZONE 'UTC'),
  ('objects',        'EVERYONE',   ARRAY[]::"Role"[],                              now() AT TIME ZONE 'UTC'),
  ('requests',       'EVERYONE',   ARRAY[]::"Role"[],                              now() AT TIME ZONE 'UTC'),
  ('imtiyoz',        'EVERYONE',   ARRAY[]::"Role"[],                              now() AT TIME ZONE 'UTC'),
  ('notifications',  'ROLES',      ARRAY['IJROCHI','MODERATOR']::"Role"[],         now() AT TIME ZONE 'UTC'),
  ('cadastre-check', 'ROLES',      ARRAY['SUPER_ADMIN','ADMIN']::"Role"[],         now() AT TIME ZONE 'UTC'),
  ('sync',           'ROLES',      ARRAY['SUPER_ADMIN','ADMIN']::"Role"[],         now() AT TIME ZONE 'UTC'),
  ('sources',        'ROLES',      ARRAY['SUPER_ADMIN','ADMIN']::"Role"[],         now() AT TIME ZONE 'UTC'),
  ('users',          'ROLES',      ARRAY['SUPER_ADMIN','ADMIN']::"Role"[],         now() AT TIME ZONE 'UTC'),
  ('sections',       'SUPER_ONLY', ARRAY[]::"Role"[],                              now() AT TIME ZONE 'UTC')
ON CONFLICT ("key") DO NOTHING;
