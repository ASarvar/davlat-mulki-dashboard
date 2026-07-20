"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, assertRegionWriteAccess } from "@/lib/authz";
import { objectHref } from "@/lib/cadastre";
import { assignManualCategory } from "@/server/services/assignment";
import { triggerSingleSync } from "@/server/queue/enqueue";

export interface AssignState {
  ok?: boolean;
  error?: string;
}

// Qo'lda kategoriya + PDF biriktirish (useActionState bilan ishlatiladi).
export async function assignCategoryAction(_prev: AssignState, formData: FormData): Promise<AssignState> {
  try {
    const user = await requireUser();
    const cadNumber = String(formData.get("cadNumber") ?? "");
    const categoryCode = Number(formData.get("categoryCode"));
    const note = String(formData.get("note") ?? "");
    const file = formData.get("file");

    if (!cadNumber) return { error: "Kadastr ko'rsatilmagan" };
    if (!categoryCode) return { error: "Kategoriya tanlanmagan" };

    await assignManualCategory(user, {
      cadNumber,
      categoryCode,
      note,
      file: file instanceof File ? file : null,
    });

    revalidatePath(objectHref(cadNumber));
    revalidatePath("/dashboard/objects");
    revalidateTag("dashboard"); // isInefficient o'zgardi => aggregatlar eskirdi
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}

// Bitta kadastrni API orqali yangilash (SUPER_ADMIN yoki o'z hududidagi REGION_USER).
export async function syncSingleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const cadNumber = String(formData.get("cadNumber") ?? "");
  if (!cadNumber) return;

  const property = await prisma.property.findUnique({ where: { cadNumber }, select: { regionId: true } });
  if (!property) return;
  assertRegionWriteAccess(user, property.regionId); // VIEWER/boshqa hudud => xato

  await triggerSingleSync(cadNumber, user.id);
  revalidatePath(objectHref(cadNumber));
}
