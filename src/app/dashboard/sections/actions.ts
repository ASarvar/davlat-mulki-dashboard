"use server";

import { revalidatePath } from "next/cache";
import { SectionVisibility, type Role } from "@prisma/client";
import { ALL_ROLES } from "@/lib/roles";
import { requireSection, setSectionAccess } from "@/server/services/sectionAccess";

const VISIBILITIES = Object.values(SectionVisibility) as string[];

export async function saveSectionAction(formData: FormData): Promise<void> {
  // `requireSection` allaqachon `allowRoles: ["SUPER_ADMIN"]` bo'yicha cheklaydi;
  // rolni yana bir marta aniq tekshirish — ataylab (himoyaning ikkinchi qatlami).
  const actor = await requireSection("sections");
  if (actor.role !== "SUPER_ADMIN") throw new Error("Ruxsat yo'q");

  const key = String(formData.get("key") ?? "");
  const rawVisibility = String(formData.get("visibility") ?? "");
  if (!VISIBILITIES.includes(rawVisibility)) throw new Error("Noto'g'ri ko'rinish rejimi");

  // ⚠️ Rol ro'yxati client'dan keladi — `setSectionAccess` uni `SectionDef.allowRoles`
  // bo'yicha yana filtrlaydi. Bu yerda faqat enum'ga tegishliligini tekshiramiz.
  const roles = formData
    .getAll("roles")
    .map(String)
    .filter((r): r is Role => (ALL_ROLES as string[]).includes(r));

  await setSectionAccess(key, rawVisibility as SectionVisibility, roles, actor.id);

  // Sidebar `dashboard/layout.tsx` da quriladi — layout keshini yangilamasak,
  // o'zgarish menyuda faqat to'liq qayta yuklashdan keyin ko'rinardi.
  revalidatePath("/dashboard", "layout");
}
