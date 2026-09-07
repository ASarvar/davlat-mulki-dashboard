"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/server/services/sectionAccess";
import { getCurrentUser } from "@/lib/authz";
import { getBoss } from "@/server/queue/boss";
import { QUEUE } from "@/server/queue/jobs";
import { auctionConfigured } from "@/server/integrations/auctionOrders";
import {
  latestAuctionSyncRun,
  isRunStale,
  type AuctionCredentialResult,
} from "@/server/services/auctionOrders";
import { auctionDbConfigured } from "@/server/services/auctionOrdersExternal";
import { nf } from "@/lib/format";
import { auctionRegionName } from "@/lib/auctionRegions";

/** Ekranga uzatiladigan jarayon holati — client komponent uchun oddiy tiplar. */
export interface AuctionSyncStatus {
  running: boolean;
  status: "RUNNING" | "DONE" | "PARTIAL" | "FAILED" | null;
  credential: string | null;
  credentialIndex: number;
  credentialTotal: number;
  page: number;
  pages: number;
  saved: number;
  /**
   * ⚠️ Son SERVERDA formatlanadi. `SyncPanel` client komponent bo'lsa ham Next.js
   * uni avval serverda render qiladi; `toLocaleString("uz-UZ")` Node'da
   * `68 196`, brauzerda `68,196` beradi va gidratsiya buziladi.
   */
  savedLabel: string;
  /** 0–100. Akkauntlar va joriy akkaunt ichidagi sahifalardan hisoblanadi. */
  percent: number;
  startedAt: string | null;
  finishedAt: string | null;
  failedCredentials: string[];
  /** Sana oralig'iga tushmagani uchun yozilmagan yozuvlar. */
  filtered: number;
  /** ⚠️ Serverda formatlangan — `savedLabel` bilan bir xil sabab (gidratsiya). */
  filteredLabel: string;
  /** Run doirasi — ekranda "nima yangilangani" ni ko'rsatish uchun. */
  scopeLabel: string | null;
  error: string | null;
  /** Worker o'lib qolgani sababli osilib qolgan run. */
  stale: boolean;
  /**
   * Tashqi `orders` bazasiga yozishdagi xato — sinxronizatsiya YAKUNLANGAN
   * bo'lsa ham ko'rsatiladi.
   *
   * ⚠️ Alohida maydon, `error` ga qo'shilmaydi: bizning reyestrimiz to'liq
   * yozilgan, ya'ni run "DONE". Uni "FAILED" qilib ko'rsatish yolg'on bo'lardi,
   * jim o'tkazib yuborish esa boshqa API'lar eski ma'lumot bilan qolganini
   * yashirardi.
   */
  externalError: string | null;
  /** Tashqi bazaga yozilgan yozuvlar (serverda formatlangan). */
  externalSavedLabel: string | null;
}

/**
 * "2026-01-01 dan · 3 ta akkaunt" ko'rinishidagi qisqa yorliq.
 *
 * ⚠️ Sana SERVERDA formatlanadi (client komponentdagi `toLocaleString` gidratsiyani
 * buzardi — shu fayldagi `savedLabel` izohiga qarang). Bu yerda ISO'ning kun qismi
 * olinadi: u mintaqaga bog'liq emas.
 */
function scopeLabel(run: NonNullable<Awaited<ReturnType<typeof latestAuctionSyncRun>>>): string | null {
  const parts: string[] = [];
  const d = (x: Date) => x.toISOString().slice(0, 10);
  if (run.scopeFrom && run.scopeTo) parts.push(`${d(run.scopeFrom)} — ${d(run.scopeTo)}`);
  else if (run.scopeFrom) parts.push(`${d(run.scopeFrom)} dan`);
  else if (run.scopeTo) parts.push(`${d(run.scopeTo)} gacha`);
  // ⚠️ Akkauntlar TO'LIQ ro'yxat bo'lsa yorliqqa qo'shilmaydi — "14 ta akkaunt"
  // hech qanday ma'lumot bermaydi, faqat matnni uzaytiradi.
  if (run.scopeCredentials.length > 0 && run.scopeCredentials.length < 14) {
    parts.push(run.scopeCredentials.map(auctionRegionName).join(", "));
  }
  return parts.length ? parts.join(" · ") : null;
}

function toStatus(run: Awaited<ReturnType<typeof latestAuctionSyncRun>>): AuctionSyncStatus | null {
  if (!run) return null;
  const stale = run.status === "RUNNING" && isRunStale(run.startedAt);
  const per = Array.isArray(run.perCredential)
    ? (run.perCredential as unknown as AuctionCredentialResult[])
    : [];
  const externalError = per.find((c) => c.externalError)?.externalError ?? null;
  const externalSaved = per.reduce((s, c) => s + (c.externalSaved ?? 0), 0);

  // ⚠️ Foiz IKKI darajadan: tugagan akkauntlar + joriy akkauntning sahifalari.
  // Faqat akkauntlar bo'yicha hisoblansa ko'rsatkich 14 marta sakrab, oradagi
  // 5 daqiqa davomida qotib turardi.
  const done = Math.max(0, run.credentialIndex - 1);
  const inner = run.pages > 0 ? Math.min(1, run.page / run.pages) : 0;
  const percent =
    run.status !== "RUNNING"
      ? 100
      : run.credentialTotal > 0
        ? Math.min(99, Math.round(((done + inner) / run.credentialTotal) * 100))
        : 0;

  return {
    running: run.status === "RUNNING" && !stale,
    status: run.status,
    credential: run.credential,
    credentialIndex: run.credentialIndex,
    credentialTotal: run.credentialTotal,
    page: run.page,
    pages: run.pages,
    saved: run.saved,
    savedLabel: nf(run.saved),
    percent,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    failedCredentials: per.filter((c) => c.error).map((c) => c.name),
    filtered: run.filtered,
    filteredLabel: nf(run.filtered),
    scopeLabel: scopeLabel(run),
    error: run.error,
    stale,
    externalError,
    // ⚠️ Tashqi baza sozlanmagan bo'lsa `externalSaved` har doim 0 bo'ladi —
    // bunda qator UMUMAN ko'rsatilmaydi ("0 ta yozildi" xato taassurot berardi).
    externalSavedLabel: auctionDbConfigured() && externalSaved > 0 ? nf(externalSaved) : null,
  };
}

/** Jonli holat — client komponent shu bilan so'rov yuborib turadi. */
export async function getAuctionSyncStatus(): Promise<AuctionSyncStatus | null> {
  await requireSection("auksion");
  return toStatus(await latestAuctionSyncRun());
}

/**
 * Reyestrni qo'lda yangilash — navbatga qo'yadi, DARHOL bajarmaydi.
 *
 * ⚠️ Bu yerda `syncAuctionOrders()` to'g'ridan-to'g'ri CHAQIRILMAYDI: u bir necha
 * daqiqa ishlaydi va Next.js server action'i bunchaga cho'zilmaydi. Worker uni
 * fon rejimida bajaradi.
 *
 * ⚠️ `requireSection` MAJBURIY — bo'limni yashirish uning server action'ini
 * yashirmaydi (CLAUDE.md qoidasi).
 */
export interface TriggerScope {
  /** "YYYY-MM-DD" — bo'sh bo'lsa cheklovsiz. */
  from?: string;
  to?: string;
  /** Akkaunt nomlari. Bo'sh = hammasi. */
  credentials?: string[];
}

export async function triggerAuctionSync(
  scope: TriggerScope = {},
): Promise<{ ok: boolean; message: string }> {
  await requireSection("auksion");

  if (!auctionConfigured()) {
    return { ok: false, message: "AUCTION_ORDERS_* sozlanmagan" };
  }

  // ⚠️ Allaqachon ketayotgan run ustiga ikkinchisini qo'ymaymiz: ikkalasi bir xil
  // yozuvlarni upsert qilib, shlyuzga ikki barobar yuk berardi. Osilib qolgan
  // (worker o'lgan) run bundan mustasno — aks holda tugma abadiy bloklanardi.
  const last = await latestAuctionSyncRun();
  if (last?.status === "RUNNING" && !isRunStale(last.startedAt)) {
    return { ok: true, message: "Yangilash allaqachon ketmoqda." };
  }

  try {
    const user = await getCurrentUser();
    const boss = await getBoss();
    const id = await boss.send(
      QUEUE.AUCTION_ORDERS_SYNC,
      {
        startedById: user?.id,
        from: scope.from || undefined,
        to: scope.to || undefined,
        credentials: scope.credentials?.length ? scope.credentials : undefined,
      },
      // ⚠️ `singletonKey` — takroriy bosishda navbat bir xil job bilan to'lib
      // ketmasin (YATT indeksidagi bilan bir xil sabab). Doira kalitga KIRADI:
      // aks holda "faqat TOSH-SH" so'rovi navbatdagi to'liq yangilash tufayli
      // jimgina tashlanib ketardi.
      {
        singletonKey: `auction-orders-sync:${scope.from ?? ""}:${scope.to ?? ""}:${(scope.credentials ?? []).join(",")}`,
      },
    );
    revalidatePath("/dashboard/auksion");
    return id
      ? { ok: true, message: "Navbatga qo'yildi — worker fon rejimida yuklaydi." }
      : { ok: true, message: "Allaqachon navbatda turibdi." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Navbatga qo'yib bo'lmadi" };
  }
}
