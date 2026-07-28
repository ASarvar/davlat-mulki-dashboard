import { prisma } from "@/lib/prisma";
import { fetchCadastresByStir } from "@/server/integrations/api1";
import { insertPropertyBaseBulk } from "../dispatch";
import type { JobOutcome, PropertyBaseJob, SyncSourceJob } from "../jobs";

const CHUNK = 500;

// Kadastr raqamining birinchi bo'lagi -> hudud ("17:15:40:..." => Andijon).
// Hududga biriktirilmagan (respublika darajasidagi) manbaning obyektlarini to'g'ri
// hududga taqsimlash uchun. Har chaqiruvda bir marta o'qiladi (14 qator).
async function loadRegionByPrefix(): Promise<Map<string, string>> {
  const regions = await prisma.region.findMany({
    where: { cadastrePrefix: { not: null } },
    select: { id: true, cadastrePrefix: true },
  });
  return new Map(regions.map((r) => [r.cadastrePrefix as string, r.id]));
}

const prefixOf = (cadNumber: string): string => cadNumber.split(":")[0]?.trim() ?? "";

// Job A: API 1 orqali STIR bo'yicha barcha kadastrlarni olib, har biriga
// property-base job qo'yadi (fan-out). Katta massivni chunk'lab insert qiladi.
export async function processSyncSource(data: SyncSourceJob): Promise<JobOutcome> {
  const { syncRunId, sourceId, regionId, stir, filterRegionId } = data;

  const cadastres = await fetchCadastresByStir(stir);

  let jobs: PropertyBaseJob[];

  if (regionId) {
    // Hududiy manba — hamma obyekti o'sha hududga tegishli.
    jobs = cadastres.map((cadNumber) => ({ syncRunId, sourceId, regionId, cadNumber }));
  } else {
    // Respublika darajasidagi manba — hudud har bir kadastrdan alohida aniqlanadi.
    const byPrefix = await loadRegionByPrefix();
    const unknown: string[] = [];
    jobs = [];
    for (const cadNumber of cadastres) {
      const rid = byPrefix.get(prefixOf(cadNumber));
      if (!rid) {
        // Noma'lum prefiks — obyektni TASODIFIY hududga yozib yubormaymiz, chunki butun
        // dashboard hudud kesimida qurilgan. Log'ga chiqarib, o'tkazib yuboramiz.
        unknown.push(cadNumber);
        continue;
      }
      jobs.push({ syncRunId, sourceId, regionId: rid, cadNumber });
    }
    if (unknown.length > 0) {
      console.warn(
        `[sync-source] stir=${stir}: ${unknown.length} ta kadastrning hududi aniqlanmadi ` +
          `(noma'lum prefiks). Namuna: ${unknown.slice(0, 5).join(", ")}`,
      );
    }
  }

  // Hudud bo'yicha sinxronizatsiya: faqat o'sha hudud kadastrlari qoladi.
  // Hududiy manba uchun bu shartsiz o'tadi (hammasi allaqachon bir xil hudud).
  if (filterRegionId) {
    jobs = jobs.filter((j) => j.regionId === filterRegionId);
  }

  for (let i = 0; i < jobs.length; i += CHUNK) {
    await insertPropertyBaseBulk(jobs.slice(i, i + CHUNK));
  }

  // totalCount'ni oshiramiz (leaf joblar shu songa qarab yakunlanadi).
  // ⚠️ `cadastres.length` emas, `jobs.length` — filtrlangan yoki o'tkazib yuborilgan
  // kadastr hech qachon leaf job bermaydi, aks holda run yakunlanmay osilib qolardi.
  await prisma.syncRun.update({
    where: { id: syncRunId },
    data: { totalCount: { increment: jobs.length }, status: "RUNNING", startedAt: new Date() },
  });

  return "pending"; // fan-out — o'zi hisoblanmaydi
}
