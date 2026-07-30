// Bir martalik tuzatish: production'dagi eski OrganizationSource.name qiymatlarini
// (to'liq rasmiy nom, "name"/"orgName" ajratilishidan OLDINGI holat) to'g'ri soha
// nomiga ("Ijara markazi" / "Davlat aktivlari agentligi" / "Direksiya") qaytaradi.
// STIR — global unikal va ishonchli kalit, seed.ts bilan bir xil ro'yxatdan olinadi.
// Ishlatish: npx tsx prisma/fix-source-names-2026-07-30.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SOHA_IJARA = "Ijara markazi";
const SOHA_AKTIVLAR = "Davlat aktivlari agentligi";
const SOHA_DIREKSIYA = "Direksiya";

// seed.ts dagi REGIONS/NATIONAL_SOURCES bilan bir xil STIR ro'yxati.
const STIR_TO_SOHA: Record<string, string> = {
  // Ijara markazi (14 hudud)
  "203618353": SOHA_IJARA, "203613993": SOHA_IJARA, "201189099": SOHA_IJARA, "201374351": SOHA_IJARA,
  "202495873": SOHA_IJARA, "201295735": SOHA_IJARA, "207001028": SOHA_IJARA, "201660391": SOHA_IJARA,
  "203140182": SOHA_IJARA, "204717332": SOHA_IJARA, "300393445": SOHA_IJARA, "207323441": SOHA_IJARA,
  "200410308": SOHA_IJARA, "201502223": SOHA_IJARA,
  // Davlat aktivlari agentligi (14 hudud)
  "202034765": SOHA_AKTIVLAR, "200237728": SOHA_AKTIVLAR, "201513558": SOHA_AKTIVLAR, "200342273": SOHA_AKTIVLAR,
  "200667723": SOHA_AKTIVLAR, "200003425": SOHA_AKTIVLAR, "200055528": SOHA_AKTIVLAR, "202157098": SOHA_AKTIVLAR,
  "200475851": SOHA_AKTIVLAR, "200322622": SOHA_AKTIVLAR, "200555539": SOHA_AKTIVLAR, "200150995": SOHA_AKTIVLAR,
  "201986982": SOHA_AKTIVLAR, "200950435": SOHA_AKTIVLAR,
  // Respublika darajasidagi
  "201122696": SOHA_AKTIVLAR,
  "202230031": SOHA_DIREKSIYA,
};

async function main() {
  const rows = await prisma.organizationSource.findMany({
    where: { stir: { in: Object.keys(STIR_TO_SOHA) } },
    select: { id: true, stir: true, name: true, orgName: true },
  });
  console.log(`Topildi: ${rows.length} / ${Object.keys(STIR_TO_SOHA).length} STIR\n`);

  let changed = 0;
  for (const r of rows) {
    const correct = STIR_TO_SOHA[r.stir];
    if (r.name === correct) continue;
    console.log(`  ${r.stir}: "${r.name}" → "${correct}"`);
    await prisma.organizationSource.update({ where: { id: r.id }, data: { name: correct } });
    changed++;
  }
  console.log(`\n✓ ${changed} ta yozuv tuzatildi (${rows.length - changed} ta allaqachon to'g'ri edi).`);

  const missing = Object.keys(STIR_TO_SOHA).filter((s) => !rows.some((r) => r.stir === s));
  if (missing.length > 0) {
    console.log(`\n⚠️ Bazada topilmagan STIR'lar (e'tiborsiz qoldirilishi mumkin, agar hali qo'shilmagan bo'lsa): ${missing.join(", ")}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
