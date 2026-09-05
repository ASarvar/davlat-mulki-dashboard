import "server-only";
import { prisma } from "@/lib/prisma";
import { userSourceScope, type SessionUser } from "@/lib/authz";
import { listSourceNames } from "@/server/services/sources";
import type { StatsScope } from "@/server/services/stats";
import { ALL_SOHA, OWN_SOHA } from "./SourceFilter";

/**
 * Manba (soha) kesimi + rol doirasini aniqlash — rasmiy hisobot va boshqaruv paneli
 * UCHALASI uchun YAGONA joy.
 *
 * ⚠️ Nima uchun ajratilgan: qoida nozik (moderatorning standart doirasi tanlov bilan
 * bekor bo'ladi, ijrochiniki esa qat'iy) va ikki sahifada mustaqil yozilsa jimgina
 * ajralib ketardi — bu loyihada shunday xatolar sinfi allaqachon bir necha marta
 * uchragan (`buildWhere()` ↔ `FILTER(...)`, menyu ↔ sahifa qorovuli).
 */
export interface ResolvedScope {
  /** `getDashboardStats()` ga uzatiladigan doira (soha filtri + rol doirasi, AND). */
  scope: StatsScope;
  /** Tanlangan soha nomi (yo'q = hamma sohalar). */
  soha: string | undefined;
  /** "Manba" tugmalarida ko'rsatiladigan sohalar. */
  sohaList: string[];
  /** Qaysi tugma yonganini SERVER hal qiladi (`SourceFilter` izohiga qarang). */
  activeSourceKey: string;
  /** MODERATOR uchun "Mening tashkilotim" tugmasi kerakmi. */
  showOwn: boolean;
  /** Rol doirasi qat'iy cheklanganmi (IJROCHI). */
  hardScope: string[] | null;
  /** Standart doira ishlayaptimi (moderator hech narsa tanlamagan). */
  usingDefaultScope: boolean;
  /** Doiradagi tashkilotlar (hudud aniqlash uchun) — cheklovsiz bo'lsa `null`. */
  ownSources: { name: string; regionId: string | null }[] | null;
  /** Yakuniy tashkilot doirasi — `null` = cheklovsiz. */
  effectiveSourceIds: string[] | null;
}

export async function resolveDashboardScope(
  user: SessionUser,
  sohaRaw: string | undefined,
): Promise<ResolvedScope> {
  // ⚠️ IJROCHI va MODERATOR uchun doira TURLICHA ishlaydi:
  //  - IJROCHI  → QAT'IY cheklov: boshqa tashkilotni umuman ko'ra olmaydi.
  //  - MODERATOR → faqat STANDART tanlov: sahifa ochilganda o'z tashkiloti ko'rinadi,
  //    lekin "Manba" tugmalaridan boshqasini tanlab hamma narsani ko'ra oladi
  //    (foydalanuvchi qarori, 2026-07-31). Tasdiqlash huquqi baribir cheklangan.
  const roleScope = await userSourceScope(user);
  const hardScope = user.role === "IJROCHI" ? roleScope : null;
  const defaultScope = user.role === "MODERATOR" ? roleScope : null;

  const ownSources =
    roleScope === null
      ? null
      : await prisma.organizationSource.findMany({
          where: { id: { in: roleScope } },
          select: { name: true, regionId: true },
        });

  // ⚠️ Faqat QAT'IY cheklangan (IJROCHI) uchun ro'yxat qisqartiriladi — moderator
  // barcha sohalarni ko'radi, aks holda boshqasiga umuman o'ta olmasdi.
  const sohaList =
    hardScope && ownSources
      ? [...new Set(ownSources.map((s) => s.name))].sort()
      : await listSourceNames();

  // ⚠️ MODERATOR biror narsa TANLAGAN bo'lsa (jumladan "Hammasi"), standart doira
  // bekor qilinadi. Hech narsa tanlanmagan bo'lsa (sahifa endi ochilgan) — qo'llanadi.
  const usingDefaultScope = defaultScope !== null && sohaRaw === undefined;
  const effectiveSourceIds = hardScope ?? (usingDefaultScope ? defaultScope : null);

  // ⚠️ Standart holat "Hammasi" emas — "Ijara markazi" (mavjud bo'lsa). "Hammasi"ni
  // ko'rish uchun ANIQ `?soha=__all__` kerak.
  // ⚠️ Moderatorning standart doirasi ishlayotganda soha standarti QO'LLANMAYDI: uning
  // tashkiloti boshqa sohada bo'lsa ikkalasi AND bo'lib natija bo'sh chiqardi.
  const soha =
    sohaRaw === ALL_SOHA
      ? undefined
      : sohaRaw && sohaList.includes(sohaRaw)
        ? sohaRaw
        : !sohaRaw && !usingDefaultScope && sohaList.includes("Ijara markazi")
          ? "Ijara markazi"
          : undefined;

  return {
    scope: { sourceName: soha, sourceIds: effectiveSourceIds },
    soha,
    sohaList,
    activeSourceKey: usingDefaultScope ? OWN_SOHA : (soha ?? ALL_SOHA),
    showOwn: defaultScope !== null,
    hardScope,
    usingDefaultScope,
    ownSources,
    effectiveSourceIds,
  };
}
