import type { Role } from "@prisma/client";

// Rol yorliqlari va tavsiflari — UI'da bir joyda.
export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  MODERATOR: "Moderator",
  NAZORATCHI: "Hudud nazoratchisi",
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
  { value: "MODERATOR", label: "Moderator", desc: "So'rovlarni tasdiqlaydi (hudud biriktiriladi)" },
  { value: "NAZORATCHI", label: "Hudud nazoratchisi", desc: "Bitta hudud, kategoriya so'rovi yuboradi" },
  { value: "VIEWER", label: "Kuzatuvchi", desc: "Faqat ko'rish" },
];

/** Rolga hudud kerakmi va qanday shaklda. */
export function regionMode(role: Role): "single" | "multi" | "none" {
  if (role === "NAZORATCHI") return "single";
  if (role === "MODERATOR") return "multi";
  return "none";
}
