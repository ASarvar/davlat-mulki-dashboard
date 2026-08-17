"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireRole } from "@/lib/authz";
import { triggerFullSync, triggerRegionSync, triggerStatusRefresh } from "@/server/queue/enqueue";
import { cleanupStuckSyncs } from "@/server/services/syncAdmin";

export interface SyncState {
  ok?: string;
  error?: string;
}

const sohaOf = (formData: FormData) => String(formData.get("sourceName") ?? "").trim() || undefined;

// Barcha manbalarni (yoki tanlangan soha bo'yicha barchasini) yangilash — SUPER_ADMIN yoki ADMIN.
export async function runFullSyncAction(_prev: SyncState, formData: FormData): Promise<SyncState> {
  try {
    const user = await requireRole("SUPER_ADMIN", "ADMIN");
    const run = await triggerFullSync(user.id, sohaOf(formData));
    revalidatePath("/dashboard/sync");
    revalidateTag("dashboard");
    return { ok: `To'liq sinxronizatsiya navbatga qo'yildi (${run.id.slice(0, 8)})` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}

// Osilib qolgan sinxronizatsiyalarni tozalash — faqat SUPER_ADMIN.
// Navbatdagi joblarni o'chiradi va faol run'larni yopadi (ma'lumot o'chmaydi).
export async function cleanupSyncAction(_prev: SyncState, _formData: FormData): Promise<SyncState> {
  try {
    const user = await requireRole("SUPER_ADMIN", "ADMIN");
    const { runsClosed, jobsPurged } = await cleanupStuckSyncs(user.id);
    revalidatePath("/dashboard/sync");
    return { ok: `Tozalandi: ${runsClosed} ta run yopildi, ${jobsPurged} ta kutayotgan job o'chirildi` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}

// Bitta hudud (ixtiyoriy: + bitta soha) manbalarini yangilash — SUPER_ADMIN yoki ADMIN.
export async function runRegionSyncAction(_prev: SyncState, formData: FormData): Promise<SyncState> {
  try {
    const user = await requireRole("SUPER_ADMIN", "ADMIN");
    const regionId = String(formData.get("regionId") ?? "");
    if (!regionId) return { error: "Hudud tanlanmagan" };

    const run = await triggerRegionSync(regionId, user.id, sohaOf(formData));
    revalidatePath("/dashboard/sync");
    revalidateTag("dashboard");
    return { ok: `Hudud sinxronizatsiyasi navbatga qo'yildi (${run.id.slice(0, 8)})` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}

// "Faqat holat yangilash" — API1/2 (kashfiyot) siz, mavjud obyektlarga tanlangan
// modul(lar) bo'yicha holat-API qayta ishga tushiriladi. SUPER_ADMIN yoki ADMIN.
export async function runStatusRefreshAction(_prev: SyncState, formData: FormData): Promise<SyncState> {
  try {
    const user = await requireRole("SUPER_ADMIN", "ADMIN");
    const regionId = String(formData.get("regionId") ?? "").trim() || undefined;
    const sourceName = sohaOf(formData);
    const refreshBase = formData.get("refreshBase") === "on";
    const refreshAuction = formData.get("refreshAuction") === "on";
    const refreshRent = formData.get("refreshRent") === "on";
    const refreshUtility = formData.get("refreshUtility") === "on";

    const run = await triggerStatusRefresh({
      regionId,
      sourceName,
      refreshBase,
      refreshAuction,
      refreshRent,
      refreshUtility,
      userId: user.id,
    });
    revalidatePath("/dashboard/sync");
    revalidateTag("dashboard");
    return {
      ok: `Holat yangilash navbatga qo'yildi (${run.id.slice(0, 8)}) — ${run.totalCount} ta obyekt`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}
