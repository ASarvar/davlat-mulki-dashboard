import type { Role } from "@prisma/client";

// Rol yorliqlari va tavsiflari — UI'da bir joyda.
export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  RAHBARIYAT: "Rahbariyat",
  MODERATOR: "Moderator",
  // ⚠️ "Hudud ijrochisi" EMAS — doira endi tashkilot bo'yicha, va respublika
  // darajasidagi tashkilot (Direksiya, Agentlik markaziy) barcha hududlarga tarqaladi.
  IJROCHI: "Ijrochi",
  VIEWER: "Kuzatuvchi",
};

export interface RoleOption {
  value: Role;
  label: string;
  desc: string;
}

// Ro'yxatda ko'rsatiladigan yaratiladigan rollar (SUPER_ADMIN yaratilmaydi — u seed).
export const ASSIGNABLE_ROLES: RoleOption[] = [
  { value: "ADMIN", label: "Admin", desc: "Super admin bilan bir xil huquq" },
  { value: "RAHBARIYAT", label: "Rahbariyat", desc: "So'rovni yakuniy tasdiqlaydi (cheklovsiz)" },
  { value: "MODERATOR", label: "Moderator", desc: "So'rovni qabul qiladi (tashkilot(lar) biriktiriladi)" },
  { value: "IJROCHI", label: "Ijrochi", desc: "Bitta tashkilot, kategoriya so'rovi yuboradi" },
  { value: "VIEWER", label: "Kuzatuvchi", desc: "Faqat ko'rish" },
];

/** Rolga tashkilot kerakmi va qanday shaklda. */
export function sourceMode(role: Role): "single" | "multi" | "none" {
  if (role === "IJROCHI") return "single";
  if (role === "MODERATOR") return "multi";
  return "none";
}
