"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireRole } from "@/lib/authz";
import { reviewRequest } from "@/server/services/assignment";

export interface ReviewState {
  ok?: string;
  error?: string;
}

export async function reviewRequestAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  try {
    const user = await requireRole("MODERATOR", "RAHBARIYAT", "SUPER_ADMIN", "ADMIN");
    const requestId = String(formData.get("requestId") ?? "");
    const approve = String(formData.get("decision") ?? "") === "approve";
    const note = String(formData.get("note") ?? "");
    const stage = String(formData.get("stage") ?? "");
    if (!requestId) return { error: "So'rov ko'rsatilmagan" };

    await reviewRequest(user, requestId, approve, note);
    revalidatePath("/dashboard/requests");
    revalidateTag("dashboard"); // kategoriya o'zgardi => aggregatlar eskirdi
    if (!approve) return { ok: "So'rov rad etildi" };
    // Moderator bosqichida "tasdiqlandi" demaymiz — kategoriya hali qo'llanmadi.
    return {
      ok:
        stage === "PENDING_MODERATOR"
          ? "Qabul qilindi — rahbariyatga yuborildi"
          : "So'rov tasdiqlandi, kategoriya qo'llandi",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}
