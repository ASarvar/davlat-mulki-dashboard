import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export type SessionUser = {
  id: string;
  role: Role;
  /** IJROCHI biriktirilgan tashkilot (`OrganizationSource.id`). Boshqa rollarda null. */
  sourceId: string | null;
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
    select: {
      id: true,
      role: true,
      sourceId: true,
      username: true,
      fullName: true,
      isActive: true,
      sessionVersion: true,
    },
  }),
);

// Tizimga kirgan foydalanuvchi (yo'q/faolsiz bo'lsa null).
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const sessionUser = session?.user as SessionUser | undefined;
  if (!sessionUser?.id) return null;

  const db = await loadUser(sessionUser.id);
  if (!db || !db.isActive) return null;

  // ⚠️ Parol almashtirilgan — token eski versiyada. JWT serverdan bekor qilib bo'lmaydi,
  // shuning uchun aynan shu solishtirish eski sessiyani o'ldiradi.
  // ⚠️ Versiyasiz token (bu o'zgarishdan OLDIN berilgan) ham yaroqsiz — deploy paytida
  // hamma bir marta qayta kiradi. Ataylab: yangi 1 soatlik tartibga toza o'tish.
  if (session?.user?.sessionVersion !== db.sessionVersion) return null;

  return { id: db.id, role: db.role, sourceId: db.sourceId, username: db.username, name: db.fullName };
}

/** Yaroqsiz sessiyani tozalaydigan route (`app/session-expired/route.ts`). */
export const SESSION_EXPIRED_PATH = "/session-expired";

/**
 * SAHIFA qo'riqchisi: foydalanuvchi yo'q yoki sessiya eskirgan bo'lsa — LOGIN'ga.
 *
 * ⚠️ `requireUser()` dan farqi: u XATO tashlaydi, bu REDIRECT qiladi. Sahifada xato
 * tashlansa foydalanuvchi login o'rniga xato sahifasini ko'rardi (`error.tsx` yo'q).
 * ⚠️ `requireUser()` ni o'zini redirect qiladigan qilib bo'lmaydi: server action'lar
 * uni `try { } catch { return {error} }` ichida chaqiradi (`objects/actions.ts`) va
 * `redirect()` ning maxsus xatosi yutilib, formada "NEXT_REDIRECT" chiqardi.
 * ⚠️ To'g'ridan-to'g'ri `/login` ga EMAS: middleware JWT'ni yaroqli ko'radi (u bazaga
 * kira olmaydi), ya'ni cookie qolsa foydalanuvchi aylanib qaytardi. Cookie'ni faqat
 * route handler o'chira oladi.
 */
export async function requireUserOrRedirect(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(SESSION_EXPIRED_PATH);
  return user;
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
 * Foydalanuvchi qaysi TASHKILOTLARGA tegishli (`OrganizationSource.id` ro'yxati):
 *  - SUPER_ADMIN / ADMIN / RAHBARIYAT / VIEWER → null (hamma tashkilot, cheklovsiz)
 *  - MODERATOR → allSources bo'lsa null, aks holda biriktirilgan tashkilotlar
 *  - IJROCHI → [o'z tashkiloti] (aynan bitta)
 * `null` = cheklov yo'q. Bo'sh massiv = hech qanday tashkilot (ehtiyot uchun —
 * biriktirilmagan ijrochi/moderator hech narsa ko'rmaydi).
 *
 * ⚠️ Hudud emas, tashkilot: hududiy tashkilotga bog'langan odam amalda faqat o'z
 * hududini ko'radi, respublika darajasidagi tashkilot (Direksiya, Agentlik markaziy)
 * esa kadastr prefiksi orqali barcha hududlarga tarqaladi — bu kutilgan xulq.
 */
export async function userSourceScope(user: SessionUser): Promise<string[] | null> {
  if (isAdmin(user.role) || user.role === "RAHBARIYAT" || user.role === "VIEWER") return null;
  if (user.role === "IJROCHI") return user.sourceId ? [user.sourceId] : [];
  if (user.role === "MODERATOR") {
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: { allSources: true, moderatorSources: { select: { sourceId: true } } },
    });
    if (!u) return [];
    if (u.allSources) return null;
    return u.moderatorSources.map((r) => r.sourceId);
  }
  return [];
}

// Tashkilotga yozish/tasdiqlash ruxsati.
//  - ADMIN/SUPER_ADMIN/RAHBARIYAT — hamma tashkilot
//  - MODERATOR — o'z tashkilotlari (yoki hammasi)
//  - IJROCHI — o'z tashkiloti (lekin u to'g'ridan-to'g'ri emas, so'rov orqali)
export async function assertSourceWriteAccess(user: SessionUser, sourceId: string): Promise<void> {
  if (isAdmin(user.role)) return;
  const scope = await userSourceScope(user);
  if (scope === null) return; // cheklov yo'q (moderator=hammasi)
  if (scope.includes(sourceId)) return;
  throw new Error("Bu tashkilotga o'zgartirish kiritish ruxsati yo'q");
}
