"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createSource, updateSource, deleteSource } from "@/server/services/sources";

export interface SourceState {
  ok?: boolean;
  error?: string;
}

// O'zbekiston STIR — 9 raqam.
const stirSchema = z.string().regex(/^\d{9}$/, "STIR 9 ta raqamdan iborat bo'lishi kerak");

const createSchema = z.object({
  regionId: z.string().min(1, "Hudud tanlanmagan"),
  name: z.string().min(2, "Manba nomi kiritilsin"),
  stir: stirSchema,
});

export async function createSourceAction(_prev: SourceState, formData: FormData): Promise<SourceState> {
  try {
    const actor = await requireRole("SUPER_ADMIN");
    const parsed = createSchema.safeParse({
      regionId: formData.get("regionId"),
      name: formData.get("name"),
      stir: formData.get("stir"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };

    await createSource(actor.id, parsed.data);
    revalidatePath("/dashboard/sources");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}

export async function deleteSourceAction(_prev: SourceState, formData: FormData): Promise<SourceState> {
  try {
    const actor = await requireRole("SUPER_ADMIN");
    const sourceId = String(formData.get("sourceId") ?? "");
    if (!sourceId) return { error: "Manba ko'rsatilmagan" };

    await deleteSource(actor.id, sourceId);
    revalidatePath("/dashboard/sources");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}

const updateSchema = z.object({
  sourceId: z.string().min(1),
  name: z.string().min(2, "Manba nomi kiritilsin"),
  stir: stirSchema,
});

export async function updateSourceAction(_prev: SourceState, formData: FormData): Promise<SourceState> {
  try {
    const actor = await requireRole("SUPER_ADMIN");
    const parsed = updateSchema.safeParse({
      sourceId: formData.get("sourceId"),
      name: formData.get("name"),
      stir: formData.get("stir"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };

    await updateSource(actor.id, parsed.data.sourceId, {
      name: parsed.data.name,
      stir: parsed.data.stir,
      isActive: formData.get("isActive") === "on",
    });
    revalidatePath("/dashboard/sources");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}
