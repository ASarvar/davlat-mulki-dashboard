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

// Login: harf/raqam/nuqta/pastki chiziq, email EMAS.
const usernameSchema = z.string().regex(/^[a-z0-9._-]{3,32}$/i, "Login 3–32 belgi (harf, raqam, . _ -)");

const createSchema = z.object({
  username: usernameSchema,
  fullName: z.string().min(2, "F.I.SH kiritilishi kerak"),
  password: z.string().min(8, "Parol kamida 8 belgi bo'lsin"),
  role: z.nativeEnum(Role),
});

// Rolga qarab hudud maydonlarini FormData'dan o'qiydi.
function readSources(formData: FormData, role: Role) {
  return {
    sourceId: String(formData.get("sourceId") ?? "") || null,
    allSources: formData.get("allSources") === "on",
    moderatorSourceIds: formData.getAll("moderatorSourceIds").map(String).filter(Boolean),
  };
}

export async function createUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  try {
    const actor = await requireRole("SUPER_ADMIN", "ADMIN");
    const parsed = createSchema.safeParse({
      username: formData.get("username"),
      fullName: formData.get("fullName"),
      password: formData.get("password"),
      role: formData.get("role"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };
    // ADMIN boshqa ADMIN yoki SUPER_ADMIN yarata olmaydi.
    if (actor.role === "ADMIN" && (parsed.data.role === "ADMIN" || parsed.data.role === "SUPER_ADMIN"))
      return { error: "Admin bu rolni yarata olmaydi" };

    await createUser(actor.id, { ...parsed.data, ...readSources(formData, parsed.data.role) });
    revalidatePath("/dashboard/users");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}

export async function updateUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  try {
    const actor = await requireRole("SUPER_ADMIN", "ADMIN");
    const userId = String(formData.get("userId") ?? "");
    const role = String(formData.get("role") ?? "") as Role;
    const isActive = formData.get("isActive") === "on";

    if (!userId || !(role in Role)) return { error: "Ma'lumot noto'g'ri" };

    await updateUser(actor.id, { userId, role, isActive, ...readSources(formData, role) });
    revalidatePath("/dashboard/users");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Xatolik yuz berdi" };
  }
}

export async function deleteUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  try {
    const actor = await requireRole("SUPER_ADMIN", "ADMIN");
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
    const actor = await requireRole("SUPER_ADMIN", "ADMIN");
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
