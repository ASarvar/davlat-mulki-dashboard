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
  { code: 1, nameUz: "Bo'lib to'lash sharti bilan sotilgan", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 2, nameUz: "Sotilgan - kadastr hujjati rasmiylashtirilmagan", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 3, nameUz: "Beg'araz foydalanishga berilgan", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 4, nameUz: "Xususiylashtirish va ijaraga berish uchun savdoda turgan", source: "INTEGRATION", excludeInefficient: true, requiresDocument: false },
  { code: 5, nameUz: "Savdoga chiqarish jarayonida", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  { code: 6, nameUz: "Savdosi to'xtatilgan", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  { code: 7, nameUz: "Foydalanishga yaroqsiz holatda", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  { code: 8, nameUz: "Chekka hududlarda joylashgan", source: "MANUAL", excludeInefficient: true, requiresDocument: true },
  { code: 9, nameUz: "Bo'sh turgan", source: "MANUAL", excludeInefficient: false, requiresDocument: true },
  { code: 10, nameUz: "Bo'sh turgan maydoni mavjud", source: "MANUAL", excludeInefficient: false, requiresDocument: true },
];

// ─── 14 hudud ───
const REGIONS: { code: string; name: string }[] = [
  { code: "TAS_CITY", name: "Toshkent shahri" },
  { code: "TAS", name: "Toshkent viloyati" },
  { code: "AND", name: "Andijon viloyati" },
  { code: "FAR", name: "Farg'ona viloyati" },
  { code: "NAM", name: "Namangan viloyati" },
  { code: "SAM", name: "Samarqand viloyati" },
  { code: "BUX", name: "Buxoro viloyati" },
  { code: "NAV", name: "Navoiy viloyati" },
  { code: "QAS", name: "Qashqadaryo viloyati" },
  { code: "SUR", name: "Surxondaryo viloyati" },
  { code: "JIZ", name: "Jizzax viloyati" },
  { code: "SIR", name: "Sirdaryo viloyati" },
  { code: "XOR", name: "Xorazm viloyati" },
  { code: "QQR", name: "Qoraqalpog'iston Respublikasi" },
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

  // Hududlar + har biriga "Ijara markazi" manbasi (placeholder STIR)
  for (const [i, r] of REGIONS.entries()) {
    const region = await prisma.region.upsert({
      where: { code: r.code },
      update: { name: r.name },
      create: r,
    });
    // Placeholder — real STIR keyin /dashboard/sources orqali kiritiladi.
    // O'zbekiston STIR'i 9 xonali (validatsiya ham 9 ta raqam talab qiladi).
    const stir = `300000${String(i + 1).padStart(3, "0")}`;
    await prisma.organizationSource.upsert({
      where: { regionId_stir: { regionId: region.id, stir } },
      update: { name: "Ijara markazi" },
      create: { name: "Ijara markazi", stir, regionId: region.id },
    });
  }
  console.log(`✓ ${REGIONS.length} ta hudud + ijara markazi manbalari`);

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
