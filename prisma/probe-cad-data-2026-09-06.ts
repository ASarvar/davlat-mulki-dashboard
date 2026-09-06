/**
 * `cad_data` (API 2 ning o'rnini bosuvchi) API'sini JONLI tekshirish.
 *
 * ⚠️ **To'liq qayta sinxronizatsiyadan OLDIN ishga tushiring.** 6000 obyektni
 * yangilashdan avval kichik namunada javob to'liqligini va koordinata qamrovini
 * o'lchaydi — bazaga HECH NARSA yozmaydi.
 *
 * Ishga tushirish (serverda):
 *   docker compose run --rm worker npx tsx prisma/probe-cad-data-2026-09-06.ts
 * Dev'da:
 *   npx tsx prisma/probe-cad-data-2026-09-06.ts [namuna_soni]
 *
 * Kutilgan natija (2026-09-06 dagi o'lchov, 200 obyekt):
 *   muvaffaqiyat 98% · geometry 95% · umumiy maydon/tuman/eski kadastr mosligi 100%
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { fetchCadData } from "@/server/integrations/cadData";
import { isCadDataConfigured } from "@/server/integrations/config";
import { totalBuildingArea, usefulArea } from "@/lib/area";

const SAMPLE = Number(process.argv[2]) || 120;
const CONCURRENCY = 8;

interface Row {
  cadNumber: string;
  cadNumberOld: string | null;
  name: string | null;
  rawApi2: unknown;
  lat: number | null;
  region: string;
  dcode: number | null;
  stir: string;
}

async function main() {
  if (!isCadDataConfigured()) {
    console.error("CADDATA_* sozlanmagan — .env ga CADDATA_BASE_URL/USERNAME/PASSWORD qo'shing.");
    process.exit(1);
  }

  // Har hududdan teng miqdorda — bitta hududga qiyshaymasin.
  const rows = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT * FROM (
      SELECT p."cadNumber", p."cadNumberOld", p.name, p."rawApi2", p.lat,
             r.name AS region, d.code AS dcode, s.stir,
             ROW_NUMBER() OVER (PARTITION BY p."regionId" ORDER BY random()) AS rn
      FROM "Property" p
      JOIN "Region" r ON r.id = p."regionId"
      JOIN "OrganizationSource" s ON s.id = p."sourceId"
      LEFT JOIN "District" d ON d.id = p."districtId"
      WHERE p."removedFromBalance" = false
    ) t WHERE rn <= ${Math.max(1, Math.ceil(SAMPLE / 14))}
  `);

  const st = {
    n: 0, ok: 0, fail: 0, geo: 0, hadCoord: 0,
    oldMatch: 0, oldBothNull: 0, oldMismatch: 0,
    nameMatch: 0, dcodeMatch: 0, totalMatch: 0, usefulMatch: 0,
  };
  const fails = new Map<string, number>();
  const mismatches: string[] = [];
  const t0 = Date.now();

  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < rows.length) {
        const row = rows[i++];
        st.n++;
        if (row.lat != null) st.hadCoord++;

        const res = await fetchCadData(row.cadNumber, row.stir).catch((e: unknown) => ({
          ok: false as const,
          reason: e instanceof Error ? e.message : String(e),
        }));

        if (!res.ok) {
          st.fail++;
          const key = res.reason.slice(0, 70);
          fails.set(key, (fails.get(key) ?? 0) + 1);
          continue;
        }
        st.ok++;
        const d = res.data;
        if (d.coords) st.geo++;

        // Eski kadastr — fallback zanjiri uchun eng muhim maydon.
        if (!row.cadNumberOld && !d.cadNumberOld) st.oldBothNull++;
        else if (row.cadNumberOld === d.cadNumberOld) st.oldMatch++;
        else {
          st.oldMismatch++;
          if (mismatches.length < 10)
            mismatches.push(`  eski kadastr ${row.cadNumber}: baza="${row.cadNumberOld}" API="${d.cadNumberOld}"`);
        }

        if ((row.name ?? null) === (d.name ?? null)) st.nameMatch++;
        if (String(row.dcode ?? "") === String(d.districtCode ?? "")) st.dcodeMatch++;

        // Maydonlar — ESKI xom javob bilan solishtiramiz (ikkalasi ham `lib/area.ts` orqali).
        const oldRaw = row.rawApi2 as Record<string, unknown> | null;
        const near = (a: number | null, b: number | null | undefined) =>
          (a == null && b == null) ||
          (a != null && b != null && Math.abs(a - b) / Math.max(a, b) < 0.02);
        if (near(totalBuildingArea(oldRaw), d.area)) st.totalMatch++;
        else if (mismatches.length < 10)
          mismatches.push(`  umumiy maydon ${row.cadNumber}: eski=${totalBuildingArea(oldRaw)} yangi=${d.area}`);
        if (near(usefulArea(oldRaw), d.buildingArea)) st.usefulMatch++;
      }
    }),
  );

  const dt = (Date.now() - t0) / 1000;
  const pct = (x: number, d = st.ok) => (d > 0 ? `${Math.round((x / d) * 100)}%` : "—");

  console.log(`\n=== cad_data tekshiruvi: ${st.n} obyekt, ${CONCURRENCY} parallel, ${dt.toFixed(1)}s ===\n`);
  console.log(`  Muvaffaqiyatli        : ${st.ok} / ${st.n}  (${pct(st.ok, st.n)})`);
  console.log(`  Xato                  : ${st.fail}`);
  for (const [k, n] of [...fails].sort((a, b) => b[1] - a[1])) console.log(`      ${n} ta — ${k}`);
  console.log();
  console.log(`  Koordinata (geometry) : ${st.geo} / ${st.ok}  (${pct(st.geo)})`);
  console.log(`  HOZIR bazada bor      : ${st.hadCoord} / ${st.n}  (${pct(st.hadCoord, st.n)})`);
  console.log();
  console.log(`  Eski kadastr mos      : ${st.oldMatch} (+ ${st.oldBothNull} ikkalasida yo'q)`);
  console.log(`  ⚠ Eski kadastr FARQLI : ${st.oldMismatch}`);
  console.log(`  Nom mos               : ${st.nameMatch} / ${st.ok}  (${pct(st.nameMatch)})`);
  console.log(`  Tuman kodi mos        : ${st.dcodeMatch} / ${st.ok}  (${pct(st.dcodeMatch)})`);
  console.log(`  Umumiy maydon mos     : ${st.totalMatch} / ${st.ok}  (${pct(st.totalMatch)})`);
  console.log(`  Foydali maydon mos    : ${st.usefulMatch} / ${st.ok}  (${pct(st.usefulMatch)})`);
  if (mismatches.length) {
    console.log("\n  Farqlarga misol:");
    mismatches.forEach((m) => console.log(m));
  }
  console.log(`\n  Taxminiy to'liq sinxronizatsiya vaqti: ~${((6000 / st.n) * dt / 60).toFixed(0)} daqiqa\n`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
