import { cache } from "react";
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

// Rol/hudud JWT'dan EMAS, har so'rovda DB'dan o'qiladi.
// Sabab: JWT tizimga kirgan paytdagi rolni muzlatib qo'yadi — rol o'zgarsa (yoki
// enum qayta nomlansa, masalan NAZORATCHI→IJROCHI) foydalanuvchi qayta kirmaguncha
// eski huquqda qolardi. `cache()` bir so'rov ichida faqat bitta so'rov ketishini
// ta'minlaydi. Middleware (edge) baribir faqat "kirganmi?" ni tekshiradi.
const loadUser = cache(async (id: string) =>
  prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, regionId: true, username: true, fullName: true, isActive: true },
  }),
);

// Tizimga kirgan foydalanuvchi (yo'q/faolsiz bo'lsa null).
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const sessionUser = session?.user as SessionUser | undefined;
  if (!sessionUser?.id) return null;

  const db = await loadUser(sessionUser.id);
  if (!db || !db.isActive) return null;

  return { id: db.id, role: db.role, regionId: db.regionId, username: db.username, name: db.fullName };
}

// Tizimga kirgan foydalanuvchini talab qiladi.
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Avtorizatsiya talab qilinadi");
  return user;
}

// Ma'lum rol(lar)ni talab qiladi.
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new Error("Ruxsat yo'q (rol)");
  return user;
}

/**
 * Foydalanuvchi qaysi hududlarga tegishli:
 *  - SUPER_ADMIN / ADMIN / RAHBARIYAT / VIEWER → null (hamma hudud, cheklovsiz)
 *  - MODERATOR → allRegions bo'lsa null, aks holda biriktirilgan hududlar ro'yxati
 *  - IJROCHI → [o'z hududi]
 * `null` = cheklov yo'q. Bo'sh massiv = hech qanday hudud (ehtiyot uchun).
 */
export async function userRegionScope(user: SessionUser): Promise<string[] | null> {
  if (isAdmin(user.role) || user.role === "RAHBARIYAT" || user.role === "VIEWER") return null;
  if (user.role === "IJROCHI") return user.regionId ? [user.regionId] : [];
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
//  - ADMIN/SUPER_ADMIN/RAHBARIYAT — hamma hudud
//  - MODERATOR — o'z hududlari (yoki hammasi)
//  - IJROCHI — o'z hududi (lekin u to'g'ridan-to'g'ri emas, so'rov orqali)
export async function assertRegionWriteAccess(user: SessionUser, regionId: string): Promise<void> {
  if (isAdmin(user.role)) return;
  const scope = await userRegionScope(user);
  if (scope === null) return; // cheklov yo'q (moderator=hammasi)
  if (scope.includes(regionId)) return;
  throw new Error("Bu hududga o'zgartirish kiritish ruxsati yo'q");
}
