import { PrismaClient, CategorySource, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── 10 kategoriya (biznes logika) ───
// 1–8: samaradorlik hisobidan CHIQARILADI (excludeInefficient=true)
// 9–10 va kategoriyasizlar: SAMARASIZ (excludeInefficient=false)
// 1–4: INTEGRATSIYA (API'dan), 5–10: QO'LDA (PDF majburiy)
const CATEGORIES: {
  code: number;
  nameUz: string;
  source: CategorySource;
  excludeInefficient: boolean;
  requiresDocument: boolean;
}[] = [
  { code: 1, nameUz: "Sotilgan (Bo'lib to'lash sharti bilan)", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 2, nameUz: "Sotilgan", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 3, nameUz: "Savdoda xususiylashtirish", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 4, nameUz: "Savdoda ijara", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 5, nameUz: "Tekin foydalanish", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 6, nameUz: "Ijara shartnomasi bor", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 7, nameUz: "Savdoga chiqarish jarayonida", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  { code: 8, nameUz: "Savdosi to'xtatilgan", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  { code: 9, nameUz: "Foydalanishga yaroqsiz holatda", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  { code: 10, nameUz: "Chekka hududlarda joylashgan", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  { code: 11, nameUz: "Bo'sh turgan", source: "MANUAL", excludeInefficient: false, requiresDocument: true },
  { code: 12, nameUz: "Bo'sh turgan maydoni mavjud", source: "MANUAL", excludeInefficient: false, requiresDocument: true },
];

// ─── 14 hudud ───
// Tartib rasmiy hisobot shaklidagidek (foydalanuvchi belgilagan) — sortOrder shuni saqlaydi.
// orgName/stir — "Davlat obyektlaridan foydalanish markazi" hududiy boshqarmalarining haqiqiy STIR'i.
const REGIONS: { code: string; name: string; sortOrder: number; orgName: string; stir: string }[] = [
  { code: "QQR", name: "Qoraqalpog'iston R.", sortOrder: 1, orgName: "Davlat obyektlaridan foydalanish markazi Qoraqalpog'iston R. hududiy boshqarmasi", stir: "203618353" },
  { code: "AND", name: "Andijon", sortOrder: 2, orgName: "Davlat obyektlaridan foydalanish markazi Andijon viloyati hududiy boshqarmasi", stir: "203613993" },
  { code: "BUX", name: "Buxoro", sortOrder: 3, orgName: "Davlat obyektlaridan foydalanish markazi Buxoro viloyati hududiy boshqarmasi", stir: "201189099" },
  { code: "JIZ", name: "Jizzax", sortOrder: 4, orgName: "Davlat obyektlaridan foydalanish markazi Jizzax viloyati hududiy boshqarmasi", stir: "201374351" },
  { code: "QAS", name: "Qashqadaryo", sortOrder: 5, orgName: "Davlat obyektlaridan foydalanish markazi Qashqadaryo viloyati hududiy boshqarmasi", stir: "202495873" },
  { code: "NAV", name: "Navoiy", sortOrder: 6, orgName: "Davlat obyektlaridan foydalanish markazi Navoiy viloyati hududiy boshqarmasi", stir: "201295735" },
  { code: "NAM", name: "Namangan", sortOrder: 7, orgName: "Davlat obyektlaridan foydalanish markazi Namangan viloyati hududiy boshqarmasi", stir: "207001028" },
  { code: "SAM", name: "Samarqand", sortOrder: 8, orgName: "Davlat obyektlaridan foydalanish markazi Samarqand viloyati hududiy boshqarmasi", stir: "201660391" },
  { code: "SUR", name: "Surxondaryo", sortOrder: 9, orgName: "Davlat obyektlaridan foydalanish markazi Surxondaryo viloyati hududiy boshqarmasi", stir: "203140182" },
  { code: "SIR", name: "Sirdaryo", sortOrder: 10, orgName: "Davlat obyektlaridan foydalanish markazi Sirdaryo viloyati hududiy boshqarmasi", stir: "204717332" },
  { code: "TAS", name: "Toshkent v.", sortOrder: 11, orgName: "Davlat obyektlaridan foydalanish markazi Toshkent viloyati hududiy boshqarmasi", stir: "300393445" },
  { code: "FAR", name: "Farg'ona", sortOrder: 12, orgName: "Davlat obyektlaridan foydalanish markazi Farg'ona viloyati hududiy boshqarmasi", stir: "207323441" },
  { code: "XOR", name: "Xorazm", sortOrder: 13, orgName: "Davlat obyektlaridan foydalanish markazi Xorazm viloyati hududiy boshqarmasi", stir: "200410308" },
  { code: "TAS_CITY", name: "Toshkent sh.", sortOrder: 14, orgName: "Davlat obyektlaridan foydalanish markazi Toshkent shahar hududiy boshqarmasi", stir: "201502223" },
];

async function main() {
  // Kategoriyalar
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { code: c.code },
      update: { nameUz: c.nameUz, source: c.source, excludeInefficient: c.excludeInefficient, requiresDocument: c.requiresDocument },
      create: c,
    });
  }
  console.log(`✓ ${CATEGORIES.length} ta kategoriya`);

  // Hududlar + (kerak bo'lsa) hududiy boshqarma manbasi (haqiqiy STIR)
  let created = 0;
  for (const r of REGIONS) {
    const region = await prisma.region.upsert({
      where: { code: r.code },
      update: { name: r.name, sortOrder: r.sortOrder },
      create: { code: r.code, name: r.name, sortOrder: r.sortOrder },
    });
    // Manba FAQAT hududda hech qanday manba bo'lmaganda yaratiladi.
    // MUHIM: ilgari bu `upsert` edi va seed qayta ishga tushirilganda real STIR
    // yonига soxta STIR bilan ikkinchi manba qo'shib yuborardi (sync xato berardi).
    const existing = await prisma.organizationSource.count({ where: { regionId: region.id } });
    if (existing === 0) {
      await prisma.organizationSource.create({
        data: { name: r.orgName, stir: r.stir, regionId: region.id },
      });
      created++;
    }
  }
  console.log(`✓ ${REGIONS.length} ta hudud (yangi manba: ${created})`);

  // Super-admin
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@davlatmulki.uz";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "change-me";
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: { role: Role.SUPER_ADMIN, isActive: true },
    create: { email, fullName: "Bosh administrator", passwordHash, role: Role.SUPER_ADMIN },
  });
  console.log(`✓ Super-admin: ${email}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
