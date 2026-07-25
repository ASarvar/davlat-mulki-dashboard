import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export type SessionUser = {
  id: string;
  role: Role;
  regionId: string | null;
  username?: string;
  name?: string | null;
};

// Rol guruhlari — bir joyda, takrorlanmasin.
export const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN"]; // to'liq huquq

export function isAdmin(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

// Tizimga kirgan foydalanuvchini talab qiladi.
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) throw new Error("Avtorizatsiya talab qilinadi");
  return session.user as SessionUser;
}

// Ma'lum rol(lar)ni talab qiladi.
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new Error("Ruxsat yo'q (rol)");
  return user;
}

/**
 * Foydalanuvchi qaysi hududlarga tegishli:
 *  - SUPER_ADMIN / ADMIN / VIEWER → null (hamma hudud, cheklovsiz)
 *  - MODERATOR → allRegions bo'lsa null, aks holda biriktirilgan hududlar ro'yxati
 *  - NAZORATCHI → [o'z hududi]
 * `null` = cheklov yo'q. Bo'sh massiv = hech qanday hudud (ehtiyot uchun).
 */
export async function userRegionScope(user: SessionUser): Promise<string[] | null> {
  if (isAdmin(user.role) || user.role === "VIEWER") return null;
  if (user.role === "NAZORATCHI") return user.regionId ? [user.regionId] : [];
  if (user.role === "MODERATOR") {
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: { allRegions: true, moderatorRegions: { select: { regionId: true } } },
    });
    if (!u) return [];
    if (u.allRegions) return null;
    return u.moderatorRegions.map((r) => r.regionId);
  }
  return [];
}

// Hududga yozish/tasdiqlash ruxsati.
//  - ADMIN/SUPER_ADMIN — hamma hudud
//  - MODERATOR — o'z hududlari (yoki hammasi)
//  - NAZORATCHI — o'z hududi (lekin u to'g'ridan-to'g'ri emas, so'rov orqali)
export async function assertRegionWriteAccess(user: SessionUser, regionId: string): Promise<void> {
  if (isAdmin(user.role)) return;
  const scope = await userRegionScope(user);
  if (scope === null) return; // cheklov yo'q (moderator=hammasi)
  if (scope.includes(regionId)) return;
  throw new Error("Bu hududga o'zgartirish kiritish ruxsati yo'q");
}
