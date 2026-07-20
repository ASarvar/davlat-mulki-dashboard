import { prisma } from "@/lib/prisma";
import { fetchCadastresByStir } from "@/server/integrations/api1";
import { insertPropertyBaseBulk } from "../dispatch";
import type { JobOutcome, SyncSourceJob } from "../jobs";

const CHUNK = 500;

// Job A: API 1 orqali STIR bo'yicha barcha kadastrlarni olib, har biriga
// property-base job qo'yadi (fan-out). Katta massivni chunk'lab insert qiladi.
export async function processSyncSource(data: SyncSourceJob): Promise<JobOutcome> {
  const { syncRunId, sourceId, regionId, stir } = data;

  const cadastres = await fetchCadastresByStir(stir);

  for (let i = 0; i < cadastres.length; i += CHUNK) {
    const slice = cadastres.slice(i, i + CHUNK);
    await insertPropertyBaseBulk(slice.map((cadNumber) => ({ syncRunId, sourceId, regionId, cadNumber })));
  }

  // totalCount'ni oshiramiz (leaf joblar shu songa qarab yakunlanadi).
  await prisma.syncRun.update({
    where: { id: syncRunId },
    data: { totalCount: { increment: cadastres.length }, status: "RUNNING", startedAt: new Date() },
  });

  return "pending"; // fan-out — o'zi hisoblanmaydi
}
