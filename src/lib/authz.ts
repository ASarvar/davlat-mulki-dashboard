import { auth } from "@/auth";
import type { Role } from "@prisma/client";

export type SessionUser = {
  id: string;
  role: Role;
  regionId: string | null;
  email?: string | null;
  name?: string | null;
};

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

// Hududga yozish ruxsati: SUPER_ADMIN — hamma, REGION_USER — faqat o'z hududi.
// VIEWER hech qachon yoza olmaydi.
export function assertRegionWriteAccess(user: SessionUser, regionId: string): void {
  if (user.role === "SUPER_ADMIN") return;
  if (user.role === "REGION_USER" && user.regionId === regionId) return;
  throw new Error("Bu hududga o'zgartirish kiritish ruxsati yo'q");
}
