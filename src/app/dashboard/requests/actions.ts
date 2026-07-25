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
    const user = await requireRole("MODERATOR", "SUPER_ADMIN", "ADMIN");
    const requestId = String(formData.get("requestId") ?? "");
    const approve = String(formData.get("decision") ?? "") === "approve";
    const note = String(formData.get("note") ?? "");
    if (!requestId) return { error: "So'rov ko'rsatilmagan" };

    await reviewRequest(user, requestId, approve, note);
    revalidatePath("/dashboard/requests");
    revalidateTag("dashboard"); // kategoriya o'zgardi => aggregatlar eskirdi
    return { ok: approve ? "So'rov tasdiqlandi" : "So'rov rad etildi" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}
