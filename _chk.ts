import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const rows = await p.$queryRawUnsafe<any[]>(`
    SELECT "cadNumber",
           "buildingArea"::text AS useful,
           "rentTotalArea"::text AS rented,
           ("rawApi2"->>'land_area')::text     AS land,
           ("rawApi2"->>'object_area_p')::text AS oap,
           ("rawApi2"->>'object_area_u')::text AS oau
    FROM "Property"
    WHERE COALESCE("rentContractCount",0) > 0
      AND COALESCE("rentTotalArea",0) > COALESCE("buildingArea",0)
    ORDER BY COALESCE("rentTotalArea",0) - COALESCE("buildingArea",0) DESC
    LIMIT 100
  `);
  console.log("Anomaliya: ijara > foydali. land_area yordam beradimi?\n");
  for (const r of rows) {
    const land = Number(r.land ?? 0);
    const rented = Number(r.rented ?? 0);
    const ok = land >= rented ? "✓ land yetarli" : "✗ land ham kichik";
    console.log(`  ${r.cadNumber}`);
    console.log(`     foydali=${r.useful}  ijarada=${r.rented}  land_area=${r.land}  ${ok}`);
  }

  const agg = await p.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE ("rawApi2"->>'land_area')::numeric >= COALESCE("rentTotalArea",0)) AS land_ok
    FROM "Property"
    WHERE COALESCE("rentContractCount",0) > 0
      AND COALESCE("rentTotalArea",0) > COALESCE("buildingArea",0)
      AND "rawApi2" IS NOT NULL
  `);
  console.log(`\nJami anomaliya: ${agg[0].total}   land_area yetarli bo'lganlari: ${agg[0].land_ok}`);
  await p.$disconnect();
}
main().catch(async (e) => { console.error(String(e).slice(0, 400)); await p.$disconnect(); process.exit(1); });
