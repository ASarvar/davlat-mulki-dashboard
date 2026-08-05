import { PrismaClient, CategorySource, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SOHA_AKTIVLAR, SOHA_DIREKSIYA } from "../src/lib/sourceLabel";

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

// ─── SOHA (guruh) nomlari ───
// `OrganizationSource.name` SHU qiymatlardan biri bo'ladi — dashboard va ro'yxat
// filtrlari aynan shu bo'yicha guruhlaydi, shuning uchun bitta sohaning barcha
// yozuvlarida harfma-harf bir xil bo'lishi shart.
const SOHA_IJARA = "Ijara markazi";
// SOHA_AKTIVLAR / SOHA_DIREKSIYA — src/lib/sourceLabel.ts'dan (bitta joyda, boshqa
// joyda ham ishlatiladi — masalan dashboard'dagi Yer/Bino ajratish varianti).

// ─── 14 hudud ───
// Tartib rasmiy hisobot shaklidagidek (foydalanuvchi belgilagan) — sortOrder shuni saqlaydi.
// cadastrePrefix — kadastr raqamining birinchi bo'lagi; hududga biriktirilmagan manbaning
// obyektlari shu orqali to'g'ri hududga taqsimlanadi (jonli ma'lumotda tasdiqlangan).
// orgName/stir — "Davlat obyektlaridan foydalanish markazi" hududiy boshqarmalari,
// aktivStir — "Davlat aktivlarini boshqarish" hududiy boshqarmalari (foydalanuvchi fayli).
const REGIONS: {
  code: string;
  name: string;
  sortOrder: number;
  cadastrePrefix: string;
  orgName: string;
  stir: string;
  aktivOrgName: string;
  aktivStir: string;
}[] = [
  { code: "QQR", name: "Qoraqalpog'iston R.", sortOrder: 1, cadastrePrefix: "23", orgName: "Davlat obyektlaridan foydalanish markazi Qoraqalpog'iston R. hududiy boshqarmasi", stir: "203618353", aktivOrgName: "Qoraqalpog'iston Respublikasi Davlat aktivlarini boshqarish boshqarmasi", aktivStir: "202034765" },
  { code: "AND", name: "Andijon", sortOrder: 2, cadastrePrefix: "17", orgName: "Davlat obyektlaridan foydalanish markazi Andijon viloyati hududiy boshqarmasi", stir: "203613993", aktivOrgName: "Andijon viloyati Davlat aktivlarini boshqarish boshqarmasi", aktivStir: "200237728" },
  { code: "BUX", name: "Buxoro", sortOrder: 3, cadastrePrefix: "20", orgName: "Davlat obyektlaridan foydalanish markazi Buxoro viloyati hududiy boshqarmasi", stir: "201189099", aktivOrgName: "Buxoro viloyati Davlat aktivlarini boshqarish boshqarmasi", aktivStir: "201513558" },
  { code: "JIZ", name: "Jizzax", sortOrder: 4, cadastrePrefix: "13", orgName: "Davlat obyektlaridan foydalanish markazi Jizzax viloyati hududiy boshqarmasi", stir: "201374351", aktivOrgName: "Jizzax viloyati Davlat aktivlarini boshqarish boshqarmasi", aktivStir: "200342273" },
  { code: "QAS", name: "Qashqadaryo", sortOrder: 5, cadastrePrefix: "18", orgName: "Davlat obyektlaridan foydalanish markazi Qashqadaryo viloyati hududiy boshqarmasi", stir: "202495873", aktivOrgName: "Qashqadaryo viloyati Davlat aktivlarini boshqarish boshqarmasi", aktivStir: "200667723" },
  { code: "NAV", name: "Navoiy", sortOrder: 6, cadastrePrefix: "21", orgName: "Davlat obyektlaridan foydalanish markazi Navoiy viloyati hududiy boshqarmasi", stir: "201295735", aktivOrgName: "Navoiy viloyati Davlat aktivlarini boshqarish boshqarmasi", aktivStir: "200003425" },
  { code: "NAM", name: "Namangan", sortOrder: 7, cadastrePrefix: "16", orgName: "Davlat obyektlaridan foydalanish markazi Namangan viloyati hududiy boshqarmasi", stir: "207001028", aktivOrgName: "Namangan viloyati Davlat aktivlarini boshqarish boshqarmasi", aktivStir: "200055528" },
  { code: "SAM", name: "Samarqand", sortOrder: 8, cadastrePrefix: "14", orgName: "Davlat obyektlaridan foydalanish markazi Samarqand viloyati hududiy boshqarmasi", stir: "201660391", aktivOrgName: "Samarqand viloyati Davlat aktivlarini boshqarish boshqarmasi", aktivStir: "202157098" },
  { code: "SUR", name: "Surxondaryo", sortOrder: 9, cadastrePrefix: "19", orgName: "Davlat obyektlaridan foydalanish markazi Surxondaryo viloyati hududiy boshqarmasi", stir: "203140182", aktivOrgName: "Surxondaryo viloyati Davlat aktivlarini boshqarish boshqarmasi", aktivStir: "200475851" },
  { code: "SIR", name: "Sirdaryo", sortOrder: 10, cadastrePrefix: "12", orgName: "Davlat obyektlaridan foydalanish markazi Sirdaryo viloyati hududiy boshqarmasi", stir: "204717332", aktivOrgName: "Sirdaryo viloyati Davlat aktivlarini boshqarish boshqarmasi", aktivStir: "200322622" },
  { code: "TAS", name: "Toshkent v.", sortOrder: 11, cadastrePrefix: "11", orgName: "Davlat obyektlaridan foydalanish markazi Toshkent viloyati hududiy boshqarmasi", stir: "300393445", aktivOrgName: "Toshkent viloyati Davlat aktivlarini boshqarish boshqarmasi", aktivStir: "200555539" },
  { code: "FAR", name: "Farg'ona", sortOrder: 12, cadastrePrefix: "15", orgName: "Davlat obyektlaridan foydalanish markazi Farg'ona viloyati hududiy boshqarmasi", stir: "207323441", aktivOrgName: "Farg'ona viloyati Davlat aktivlarini boshqarish boshqarmasi", aktivStir: "200150995" },
  { code: "XOR", name: "Xorazm", sortOrder: 13, cadastrePrefix: "22", orgName: "Davlat obyektlaridan foydalanish markazi Xorazm viloyati hududiy boshqarmasi", stir: "200410308", aktivOrgName: "Xorazm viloyati Davlat aktivlarini boshqarish boshqarmasi", aktivStir: "201986982" },
  { code: "TAS_CITY", name: "Toshkent sh.", sortOrder: 14, cadastrePrefix: "10", orgName: "Davlat obyektlaridan foydalanish markazi Toshkent shahar hududiy boshqarmasi", stir: "201502223", aktivOrgName: "Toshkent shahar Davlat aktivlarini boshqarish boshqarmasi", aktivStir: "200950435" },
];

// ─── Respublika darajasidagi manbalar (hududga biriktirilmaydi) ───
// Obyektlari istalgan hududda bo'lishi mumkin — kadastr prefiksidan taqsimlanadi.
const NATIONAL_SOURCES: { soha: string; orgName: string; stir: string }[] = [
  { soha: SOHA_AKTIVLAR, orgName: "Davlat aktivlarini boshqarish agentligi", stir: "201122696" },
  { soha: SOHA_DIREKSIYA, orgName: "Bino va mol-mulklarni vaqtinchalik saqlash direksiyasi", stir: "202230031" },
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

  // Manbani STIR bo'yicha upsert qilamiz — STIR global unikal va tashkilotning haqiqiy
  // identifikatori. MUHIM: `name` (soha) yangilanmaydi — admin UI'da qayta nomlagan
  // bo'lsa, seed uni bosib ketmasligi kerak. `orgName` esa rasmiy reyestr qiymati,
  // uni har safar yangilash xavfsiz.
  let created = 0;
  async function upsertSource(soha: string, orgName: string, stir: string, regionId: string | null) {
    const before = await prisma.organizationSource.findUnique({ where: { stir }, select: { id: true } });
    await prisma.organizationSource.upsert({
      where: { stir },
      update: { orgName },
      create: { name: soha, orgName, stir, regionId },
    });
    if (!before) created++;
  }

  // Hududlar + har bir hudud uchun ikki manba (Ijara markazi, Davlat aktivlari boshqarmasi)
  for (const r of REGIONS) {
    const region = await prisma.region.upsert({
      where: { code: r.code },
      update: { name: r.name, sortOrder: r.sortOrder, cadastrePrefix: r.cadastrePrefix },
      create: { code: r.code, name: r.name, sortOrder: r.sortOrder, cadastrePrefix: r.cadastrePrefix },
    });
    await upsertSource(SOHA_IJARA, r.orgName, r.stir, region.id);
    await upsertSource(SOHA_AKTIVLAR, r.aktivOrgName, r.aktivStir, region.id);
  }

  // Respublika darajasidagi manbalar — hududsiz (regionId = null).
  for (const n of NATIONAL_SOURCES) {
    await upsertSource(n.soha, n.orgName, n.stir, null);
  }

  console.log(`✓ ${REGIONS.length} ta hudud, ${REGIONS.length * 2 + NATIONAL_SOURCES.length} ta manba (yangi: ${created})`);

  // Super-admin — login (username) + parol. Email YO'Q.
  const username = process.env.SEED_ADMIN_LOGIN ?? "admin";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "change-me";
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { username },
    update: { role: Role.SUPER_ADMIN, isActive: true },
    create: { username, fullName: "Bosh administrator", passwordHash, role: Role.SUPER_ADMIN },
  });
  console.log(`✓ Super-admin login: ${username}`);
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
