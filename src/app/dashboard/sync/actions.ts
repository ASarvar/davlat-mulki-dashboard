"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireUser, requireRole, assertRegionWriteAccess } from "@/lib/authz";
import { triggerFullSync, triggerRegionSync } from "@/server/queue/enqueue";
import { cleanupStuckSyncs } from "@/server/services/syncAdmin";

export interface SyncState {
  ok?: string;
  error?: string;
}

// Barcha manbalarni (14 STIR) yangilash — faqat SUPER_ADMIN.
export async function runFullSyncAction(_prev: SyncState, _formData: FormData): Promise<SyncState> {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const run = await triggerFullSync(user.id);
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
    const user = await requireRole("SUPER_ADMIN");
    const { runsClosed, jobsPurged } = await cleanupStuckSyncs(user.id);
    revalidatePath("/dashboard/sync");
    return { ok: `Tozalandi: ${runsClosed} ta run yopildi, ${jobsPurged} ta kutayotgan job o'chirildi` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}

// Bitta hududni yangilash — SUPER_ADMIN yoki o'z hududidagi REGION_USER.
export async function runRegionSyncAction(_prev: SyncState, formData: FormData): Promise<SyncState> {
  try {
    const user = await requireUser();
    const regionId = String(formData.get("regionId") ?? "");
    if (!regionId) return { error: "Hudud tanlanmagan" };

    assertRegionWriteAccess(user, regionId); // VIEWER / boshqa hudud => xato

    const run = await triggerRegionSync(regionId, user.id);
    revalidatePath("/dashboard/sync");
    revalidateTag("dashboard");
    return { ok: `Hudud sinxronizatsiyasi navbatga qo'yildi (${run.id.slice(0, 8)})` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}
