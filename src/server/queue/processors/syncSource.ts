import { prisma } from "@/lib/prisma";
import { fetchCadastresByStir } from "@/server/integrations/api1";
import { fetchPropertyBase } from "@/server/integrations/api2";
import { insertPropertyBaseBulk } from "../dispatch";
import type { JobOutcome, PropertyBaseJob, SyncSourceJob } from "../jobs";

const CHUNK = 500;

/** Bitta sinxronizatsiyada yangi egasi uchun API 2 ga nechta so'rov yuborilishi mumkin. */
const MAX_HOLDER_LOOKUPS = 200;
/**
 * Bir marotabada balansdan chiqarilgan deb belgilanishi mumkin bo'lgan ULUSH chegarasi.
 * Bundan oshsa — API qisman/nosoz javob qaytargan deb qaraladi va HECH NARSA belgilanmaydi.
 */
const MAX_REMOVED_RATIO = 0.5;

/**
 * API 1 tashkilotning JORIY kadastr ro'yxatini qaytaradi. Bazada bor, lekin ro'yxatda
 * yo'q obyekt — balansdan chiqarilgan (odatda boshqa STIRga o'tkazilgan).
 *
 * ⚠️ Bunday obyekt O'CHIRILMAYDI (foydalanuvchi qarori, 2026-08-06) — `removedFromBalance`
 * bayrog'i qo'yiladi, tarix saqlanadi. Teskarisi ham ishlaydi: ro'yxatga qaytgan obyektdan
 * bayroq olib tashlanadi (ya'ni funksiya idempotent, har sinxronizatsiyada qayta hisoblanadi).
 */
async function reconcileRemovedFromBalance(opts: {
  sourceId: string;
  stir: string;
  /**
   * API 1 qaytargan XOM ro'yxat. ⚠️ `jobs` EMAS: prefiksi noma'lum bo'lgani uchun
   * o'tkazib yuborilgan kadastr ham balansda TURIBDI — uni "chiqarilgan" deb
   * belgilash noto'g'ri bo'lardi.
   */
  liveCadastres: string[];
  /** Hudud bo'yicha sinxronizatsiya bo'lsa — solishtiruv shu hudud bilan cheklanadi. */
  filterRegionId?: string;
}): Promise<void> {
  const { sourceId, stir, liveCadastres, filterRegionId } = opts;

  // ⚠️ Bo'sh ro'yxat — API vaqtincha ishlamayapti deb qaraladi. Aks holda bitta nosoz
  // javob butun tashkilot obyektlarini "chiqarilgan" qilib qo'yardi.
  if (liveCadastres.length === 0) {
    console.warn(`[reconcile] stir=${stir}: API 1 bo'sh ro'yxat qaytardi — solishtiruv o'tkazib yuborildi`);
    return;
  }

  const live = new Set(liveCadastres);
  const existing = await prisma.property.findMany({
    where: { sourceId, ...(filterRegionId ? { regionId: filterRegionId } : {}) },
    select: { id: true, cadNumber: true, removedFromBalance: true, removedToStir: true },
  });

  const missing = existing.filter((p) => !p.removedFromBalance && !live.has(p.cadNumber));
  const returned = existing.filter((p) => p.removedFromBalance && live.has(p.cadNumber));

  // ⚠️ Ommaviy noto'g'ri belgilashdan himoya: API qisman ro'yxat qaytarsa (bo'sh emas,
  // lekin kam), o'nlab obyekt birdan yo'qolgandek ko'rinardi. Bunday holatda hech narsa
  // belgilanmaydi — log'ga yoziladi va qo'lda tekshirish kutiladi.
  if (existing.length >= 10 && missing.length / existing.length > MAX_REMOVED_RATIO) {
    console.warn(
      `[reconcile] stir=${stir}: ${existing.length} tadan ${missing.length} tasi API ro'yxatida yo'q ` +
        `(>${MAX_REMOVED_RATIO * 100}%) — shubhali, HECH NARSA belgilanmadi. API 1 javobini tekshiring.`,
    );
    return;
  }

  if (returned.length > 0) {
    await prisma.property.updateMany({
      where: { id: { in: returned.map((p) => p.id) } },
      data: { removedFromBalance: false, removedAt: null, removedToStir: null, removedToName: null },
    });
    console.log(`[reconcile] stir=${stir}: ${returned.length} ta obyekt balansga QAYTDI`);
  }

  if (missing.length > 0) {
    await prisma.property.updateMany({
      where: { id: { in: missing.map((p) => p.id) } },
      data: { removedFromBalance: true, removedAt: new Date() },
    });
    console.log(
      `[reconcile] stir=${stir}: ${missing.length} ta obyekt balansdan chiqarilgan deb belgilandi: ` +
        missing.slice(0, 10).map((p) => p.cadNumber).join(", "),
    );
  }

  // Yangi egasini aniqlash (API 2 → `subjects[0]`). Yangi belgilanganlar + egasi
  // hali aniqlanmagan eskilar — ya'ni API bir marta javob bermasa, keyingi
  // sinxronizatsiyada qayta uriniladi.
  const needHolder = [
    ...missing,
    ...existing.filter((p) => p.removedFromBalance && !p.removedToStir && !live.has(p.cadNumber)),
  ].slice(0, MAX_HOLDER_LOOKUPS);

  for (const p of needHolder) {
    try {
      const res = await fetchPropertyBase(p.cadNumber);
      if (!res.ok) continue;
      const inn = res.data.holderInn;
      // O'zimizning STIR qaytsa — kadastr bazasi hali yangilanmagan, yozmaymiz.
      if (!inn || inn === stir) continue;
      await prisma.property.update({
        where: { id: p.id },
        data: { removedToStir: inn, removedToName: res.data.holderName ?? null },
      });
    } catch (err) {
      // Belgilashning o'zi allaqachon saqlangan — egasi keyingi safar aniqlanadi.
      console.warn(
        `[reconcile] ${p.cadNumber}: yangi egasi aniqlanmadi:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

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

  // Balansdan chiqarilganlarni belgilash. ⚠️ Kashfiyotdan KEYIN va alohida try/catch
  // bilan: bu qadamdagi xato (masalan API 2 ishlamay qolishi) yangi obyektlarni
  // topish/yangilashni buzmasligi kerak — joblar allaqachon navbatga qo'yilgan.
  try {
    await reconcileRemovedFromBalance({ sourceId, stir, liveCadastres: cadastres, filterRegionId });
  } catch (err) {
    console.error(`[reconcile] stir=${stir}: xato:`, err instanceof Error ? err.message : err);
  }

  return "pending"; // fan-out — o'zi hisoblanmaydi
}
