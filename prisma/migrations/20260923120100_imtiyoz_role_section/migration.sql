-- Imtiyoz bo'limini yangi IMTIYOZ roliga ochish.
--
-- `EVERYONE` bo'lsa hech narsa qilinmaydi — u "allowRoles doirasidagi hamma" degani va
-- `lib/sections.ts` da imtiyoz bo'limining `allowRoles`i IMTIYOZ ni o'z ichiga oladi.
-- `ROLES` bo'lsa ro'yxatga qo'shiladi. `SUPER_ONLY` (yoki qator yo'q) — super admin
-- bo'limni ataylab yopgan, shuning uchun TEGILMAYDI: u /dashboard/sections da ochadi.
UPDATE "SectionAccess"
SET "roles" = array_append("roles", 'IMTIYOZ'::"Role"),
    "updatedAt" = now() AT TIME ZONE 'UTC'
WHERE "key" = 'imtiyoz'
  AND "visibility" = 'ROLES'
  AND NOT ('IMTIYOZ'::"Role" = ANY ("roles"));
