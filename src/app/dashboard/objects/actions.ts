"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, assertSourceWriteAccess } from "@/lib/authz";
import { objectHref } from "@/lib/cadastre";
import { assignManualCategory, removeManualCategory } from "@/server/services/assignment";
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
    // Ixtiyoriy ilova rasmlari — bo'sh input ham File (size 0) qaytaradi, filtrlanadi.
    const images = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);

    if (!cadNumber) return { error: "Kadastr ko'rsatilmagan" };
    if (!categoryCode) return { error: "Kategoriya tanlanmagan" };

    await assignManualCategory(user, {
      cadNumber,
      categoryCode,
      note,
      file: file instanceof File ? file : null,
      images,
    });

    revalidatePath(objectHref(cadNumber));
    revalidatePath("/dashboard/objects");
    revalidateTag("dashboard"); // isInefficient o'zgardi => aggregatlar eskirdi
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}

// Yaroqsiz/Chekka belgisini olib tashlash — obyekt yana "Bo'sh turgan"ga qaytadi.
export async function removeCategoryAction(_prev: AssignState, formData: FormData): Promise<AssignState> {
  try {
    const user = await requireUser();
    const cadNumber = String(formData.get("cadNumber") ?? "");
    const note = String(formData.get("note") ?? "");
    if (!cadNumber) return { error: "Kadastr ko'rsatilmagan" };

    await removeManualCategory(user, cadNumber, note);

    revalidatePath(objectHref(cadNumber));
    revalidatePath("/dashboard/objects");
    revalidateTag("dashboard");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}

// Bitta kadastrni API orqali yangilash (admin yoki o'z tashkilotidagi foydalanuvchi).
//
// ⚠️ Bu amal faqat NAVBATGA QO'YADI — haqiqiy yangilashni worker alohida jarayonda
// bajaradi. Shuning uchun natija "yangilandi" emas, "navbatga qo'yildi" deb qaytariladi
// va tugma bosilgach sahifa darhol yangi ma'lumot ko'rsatmaydi (SyncButton buni
// kutish/qayta yuklash bilan hal qiladi).
export async function syncSingleAction(_prev: AssignState, formData: FormData): Promise<AssignState> {
  try {
    const user = await requireUser();
    const cadNumber = String(formData.get("cadNumber") ?? "");
    if (!cadNumber) return { error: "Kadastr ko'rsatilmagan" };

    const property = await prisma.property.findUnique({ where: { cadNumber }, select: { sourceId: true } });
    if (!property) return { error: "Obyekt topilmadi" };
    await assertSourceWriteAccess(user, property.sourceId); // VIEWER/boshqa tashkilot => xato

    await triggerSingleSync(cadNumber, user.id);
    revalidatePath(objectHref(cadNumber));
    return { ok: true };
  } catch (err) {
    // Eng ko'p uchraydigan xato — `assertNoActiveRun()`: boshqa sinxronizatsiya ketmoqda.
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}
