import { prisma } from "./src/lib/prisma";
(async () => {
  const rows = await prisma.organizationSource.findMany({
    select: { name: true, orgName: true, stir: true, region: { select: { name: true } }, _count: { select: { properties: true } } },
    orderBy: [{ name: "asc" }, { regionId: "asc" }],
  });
  console.log(`Jami manba yozuvlari: ${rows.length}\n`);
  const byName = new Map<string, { count: number; withRegion: number; noRegion: number; props: number }>();
  for (const r of rows) {
    const e = byName.get(r.name) ?? { count: 0, withRegion: 0, noRegion: 0, props: 0 };
    e.count++; r.region ? e.withRegion++ : e.noRegion++; e.props += r._count.properties;
    byName.set(r.name, e);
  }
  console.log("Soha bo'yicha:");
  for (const [n, e] of byName) console.log(`  ${n}: ${e.count} yozuv (hududli=${e.withRegion}, hududsiz=${e.noRegion}), ${e.props} obyekt`);
  console.log("\nBir nechta namuna:");
  rows.slice(0, 5).forEach(r => console.log(`  [${r.name}] ${r.region?.name ?? "RESPUBLIKA"} | STIR ${r.stir} | org="${r.orgName ?? "-"}" | ${r._count.properties} obyekt`));
  console.log("\n=== Userlar ===");
  const users = await prisma.user.findMany({
    select: { username: true, role: true, region: { select: { name: true } }, allRegions: true, moderatorRegions: { select: { region: { select: { name: true } } } } },
  });
  users.forEach(u => console.log(`  ${u.username} (${u.role}) hudud=${u.region?.name ?? "-"} allRegions=${u.allRegions} moderatorHududlar=[${u.moderatorRegions.map(m=>m.region.name).join(", ")}]`));
  await prisma.$disconnect();
})();
