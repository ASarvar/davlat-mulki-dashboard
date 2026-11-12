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
  // Faqat `/dashboard/imtiyoz` — obyektlar, hisobot va so'rovlarni ko'rmaydi (2026-09-23).
  IMTIYOZ: "Imtiyoz operatori",
  // Menyu kuzatuvchiniki, lekin har bo'limda "Texnik ishlar" ekrani (2026-11-12).
  LIMITED_VIEWER: "Cheklangan kuzatuvchi",
};

// Barcha rollar — enum tartibida. Ro'yxat/tanlagichlarda va bo'limlar registrida
// (`lib/sections.ts` → `allowRoles`) ishlatiladi, shuning uchun bir joyda turadi.
export const ALL_ROLES: Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "RAHBARIYAT",
  "MODERATOR",
  "IJROCHI",
  "VIEWER",
  "IMTIYOZ",
];

/**
 * Obyektlar bilan ishlaydigan rollar — `IMTIYOZ` dan boshqa hammasi.
 *
 * ⚠️ `lib/sections.ts` da obyektlar/hisobot/so'rovlar bo'limlarining `allowRoles`i
 * SHU, `ALL_ROLES` EMAS. Bu koddagi qattiq chegara: bazada bo'lim `EVERYONE` bo'lsa
 * ham imtiyoz operatoriga ochilmaydi ("hamma" = `allowRoles` doirasidagi hamma).
 */
export const STAFF_ROLES: Role[] = ALL_ROLES.filter((r) => r !== "IMTIYOZ");

/**
 * "Texnik ishlar" rollari → menyusi qaysi rolnikidan olinadi (2026-11-12).
 *
 * Bunday rol menyuda ko'zgu-roldagi bo'limlarni KO'RADI, lekin hech birini OCHA OLMAYDI:
 * har bir sahifa o'rnida "Texnik ishlar olib borilmoqda" ekrani chiqadi (`dashboard/layout.tsx`).
 * ⚠️ `ALL_ROLES` ga ATAYLAB qo'shilmagan — u bo'limlar registridagi `allowRoles` ro'yxati
 * va `/dashboard/sections` dagi tanlagich. Bu rol bo'limlarga hech qachon kirmasligi
 * kerak, menyusi esa ko'zgu-rolga ergashadi (kuzatuvchiga ochilgan bo'lim unga ham chiqadi).
 */
export const MAINTENANCE_MENU_ROLE: Partial<Record<Role, Role>> = {
  LIMITED_VIEWER: "VIEWER",
};

export function isMaintenanceRole(role: Role): boolean {
  return role in MAINTENANCE_MENU_ROLE;
}

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
  { value: "IMTIYOZ", label: "Imtiyoz operatori", desc: "Faqat Ijara imtiyozi sahifasi" },
  { value: "LIMITED_VIEWER", label: "Cheklangan kuzatuvchi", desc: "Menyu ko'rinadi, bo'limlar yopiq (texnik ishlar)" },
];

/** Rolga tashkilot kerakmi va qanday shaklda. */
export function sourceMode(role: Role): "single" | "multi" | "none" {
  if (role === "IJROCHI") return "single";
  if (role === "MODERATOR") return "multi";
  return "none";
}
