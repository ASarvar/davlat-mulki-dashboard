"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/authz";
import { createUser, updateUser, resetPassword, deleteUser } from "@/server/services/users";

export interface UserFormState {
  ok?: boolean;
  error?: string;
}

const createSchema = z.object({
  email: z.string().email("Email noto'g'ri"),
  fullName: z.string().min(2, "F.I.SH kiritilishi kerak"),
  password: z.string().min(8, "Parol kamida 8 belgi bo'lsin"),
  role: z.nativeEnum(Role),
  regionId: z.string().optional(),
});

export async function createUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  try {
    const actor = await requireRole("SUPER_ADMIN");
    const parsed = createSchema.safeParse({
      email: formData.get("email"),
      fullName: formData.get("fullName"),
      password: formData.get("password"),
      role: formData.get("role"),
      regionId: String(formData.get("regionId") ?? "") || undefined,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };
    }

    await createUser(actor.id, parsed.data);
    revalidatePath("/dashboard/users");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}

export async function updateUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  try {
    const actor = await requireRole("SUPER_ADMIN");
    const userId = String(formData.get("userId") ?? "");
    const role = String(formData.get("role") ?? "") as Role;
    const regionId = String(formData.get("regionId") ?? "") || null;
    const isActive = formData.get("isActive") === "on";

    if (!userId || !(role in Role)) return { error: "Ma'lumot noto'g'ri" };

    await updateUser(actor.id, { userId, role, regionId, isActive });
    revalidatePath("/dashboard/users");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}

export async function deleteUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  try {
    const actor = await requireRole("SUPER_ADMIN");
    const userId = String(formData.get("userId") ?? "");
    if (!userId) return { error: "Foydalanuvchi ko'rsatilmagan" };

    await deleteUser(actor.id, userId);
    revalidatePath("/dashboard/users");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}

export async function resetPasswordAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  try {
    const actor = await requireRole("SUPER_ADMIN");
    const userId = String(formData.get("userId") ?? "");
    const password = String(formData.get("password") ?? "");
    if (password.length < 8) return { error: "Parol kamida 8 belgi bo'lsin" };

    await resetPassword(actor.id, userId, password);
    revalidatePath("/dashboard/users");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}
