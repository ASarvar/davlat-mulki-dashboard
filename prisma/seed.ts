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
const REGIONS: { code: string; name: string; sortOrder: number }[] = [
  { code: "QQR", name: "Qoraqalpog'iston R.", sortOrder: 1 },
  { code: "AND", name: "Andijon", sortOrder: 2 },
  { code: "BUX", name: "Buxoro", sortOrder: 3 },
  { code: "JIZ", name: "Jizzax", sortOrder: 4 },
  { code: "QAS", name: "Qashqadaryo", sortOrder: 5 },
  { code: "NAV", name: "Navoiy", sortOrder: 6 },
  { code: "NAM", name: "Namangan", sortOrder: 7 },
  { code: "SAM", name: "Samarqand", sortOrder: 8 },
  { code: "SUR", name: "Surxondaryo", sortOrder: 9 },
  { code: "SIR", name: "Sirdaryo", sortOrder: 10 },
  { code: "TAS", name: "Toshkent v.", sortOrder: 11 },
  { code: "FAR", name: "Farg'ona", sortOrder: 12 },
  { code: "XOR", name: "Xorazm", sortOrder: 13 },
  { code: "TAS_CITY", name: "Toshkent sh.", sortOrder: 14 },
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

  // Hududlar + (kerak bo'lsa) placeholder manba
  let created = 0;
  for (const [i, r] of REGIONS.entries()) {
    const region = await prisma.region.upsert({
      where: { code: r.code },
      update: { name: r.name, sortOrder: r.sortOrder },
      create: r,
    });
    // Placeholder manba FAQAT hududda hech qanday manba bo'lmaganda yaratiladi.
    // MUHIM: ilgari bu `upsert` edi va seed qayta ishga tushirilganda real STIR
    // yonига soxta STIR bilan ikkinchi manba qo'shib yuborardi (sync xato berardi).
    const existing = await prisma.organizationSource.count({ where: { regionId: region.id } });
    if (existing === 0) {
      // O'zbekiston STIR'i 9 xonali (validatsiya ham 9 ta raqam talab qiladi).
      const stir = `300000${String(i + 1).padStart(3, "0")}`;
      await prisma.organizationSource.create({
        data: { name: "Ijara markazi", stir, regionId: region.id },
      });
      created++;
    }
  }
  console.log(`✓ ${REGIONS.length} ta hudud (yangi placeholder manba: ${created})`);

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
