import { cache } from "react";
import { notFound } from "next/navigation";
import type { Role, SectionVisibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, type SessionUser } from "@/lib/authz";
import { SECTIONS, sectionDef, type SectionDef } from "@/lib/sections";

/**
 * Bo'limlar ko'rinishi — MENYU va RUXSATNING yagona manbasi.
 *
 * ⚠️ Ilgari bu ikkisi mustaqil edi (`Sidebar.tsx` → `NAV.roles` va sahifadagi
 * `requireRole(...)`) va allaqachon ajralib ketgan edi. Yangi bo'lim qo'shsangiz
 * `lib/sections.ts` ga bitta qator yozing — menyu ham, qorovul ham shundan ishlaydi.
 *
 * ⚠️ Kesh SIYOSATI: `cache()` (React, bitta so'rov ichida), `unstable_cache` EMAS.
 * Ruxsat o'zgarishi 60 soniyalik TTL kutmasligi kerak — super admin tugmani bosgan
 * zahoti keyingi sahifa yuklanishida kuchga kiradi.
 */

export interface SectionState {
  visibility: SectionVisibility;
  roles: Role[];
}

const loadAccess = cache(async (): Promise<Map<string, SectionState>> => {
  const rows = await prisma.sectionAccess.findMany({
    select: { key: true, visibility: true, roles: true },
  });
  return new Map(rows.map((r) => [r.key, { visibility: r.visibility, roles: r.roles }]));
});

/**
 * Bo'lim shu foydalanuvchiga ochiqmi.
 *
 * Tartib muhim:
 *  1. SUPER_ADMIN — HAR DOIM ochiq. Busiz u `/dashboard/sections` ni o'zidan yopib,
 *     boshqaruv panelini butunlay yo'qotib qo'yishi mumkin bo'lardi.
 *  2. `allowRoles` — koddagi qattiq chegara, bazadagi sozlama uni kengaytira olmaydi.
 *  3. `core` — o'zak bo'lim (`/dashboard`), bazaga bo'ysunmaydi.
 *  4. Qator yo'q — `SUPER_ONLY` (fail-closed).
 */
export function canAccessWith(
  access: Map<string, SectionState>,
  user: SessionUser,
  def: SectionDef,
): boolean {
  if (user.role === "SUPER_ADMIN") return true;
  if (!def.allowRoles.includes(user.role)) return false;
  if (def.core) return true;

  const state = access.get(def.key);
  if (!state) return false; // qator yo'q → SUPER_ONLY
  if (state.visibility === "EVERYONE") return true;
  if (state.visibility === "ROLES") return state.roles.includes(user.role);
  return false; // SUPER_ONLY
}

export async function canAccess(user: SessionUser, key: string): Promise<boolean> {
  const def = sectionDef(key);
  if (!def) return false; // registrda yo'q bo'lim — hech kimga ochilmaydi
  return canAccessWith(await loadAccess(), user, def);
}

/** Menyu uchun: shu foydalanuvchiga ochiq bo'limlar kalitlari (registr tartibida). */
export async function allowedSectionKeys(user: SessionUser): Promise<string[]> {
  const access = await loadAccess();
  return SECTIONS.filter((def) => canAccessWith(access, user, def)).map((d) => d.key);
}

/**
 * Sahifa qorovuli. Ruxsat bo'lmasa — `notFound()`.
 *
 * ⚠️ NIMA UCHUN `notFound()`, `throw new Error(...)` EMAS: Next.js production'da
 * xato XABARINI o'chirib tashlaydi (o'rniga `digest` qoladi), ya'ni `error.tsx` da
 * "Ruxsat yo'q"ni oddiy xatodan matn bo'yicha ajratib bo'lmaydi — dev'da ishlaydi,
 * serverda ishlamaydi. Bundan tashqari ma'no jihatdan ham to'g'ri: ochilmagan bo'lim
 * foydalanuvchi uchun MAVJUD EMAS va uning borligi ham oshkor qilinmaydi.
 */
export async function requireSection(key: string): Promise<SessionUser> {
  const user = await requireUser();
  if (!(await canAccess(user, key))) notFound();
  return user;
}

// ───────────────────────── Boshqaruv (faqat super admin) ─────────────────────

export interface SectionRow extends SectionDef {
  visibility: SectionVisibility;
  roles: Role[];
  updatedAt: Date | null;
  updatedByName: string | null;
}

/** Boshqaruv sahifasi uchun: registr + bazadagi holat. */
export async function listSections(): Promise<SectionRow[]> {
  const rows = await prisma.sectionAccess.findMany({
    select: {
      key: true,
      visibility: true,
      roles: true,
      updatedAt: true,
      updatedBy: { select: { fullName: true, username: true } },
    },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));

  // ⚠️ Registr ustidan yuriladi, baza ustidan EMAS: koddan olib tashlangan bo'limning
  // eski qatori ro'yxatda "arvoh" bo'lib qolmasin.
  return SECTIONS.map((def) => {
    const row = byKey.get(def.key);
    return {
      ...def,
      visibility: row?.visibility ?? "SUPER_ONLY",
      roles: row?.roles ?? [],
      updatedAt: row?.updatedAt ?? null,
      updatedByName: row?.updatedBy ? (row.updatedBy.fullName || row.updatedBy.username) : null,
    };
  });
}

export async function setSectionAccess(
  key: string,
  visibility: SectionVisibility,
  roles: Role[],
  actorId: string,
): Promise<void> {
  const def = sectionDef(key);
  if (!def) throw new Error("Bunday bo'lim yo'q");
  if (def.core) throw new Error(`"${def.label}" — o'zak bo'lim, uni yopib bo'lmaydi`);

  // ⚠️ Chegara SERVERDA qayta qo'llanadi: client'dan kelgan rol ro'yxatiga ishonilmaydi.
  const allowed = roles.filter((r) => def.allowRoles.includes(r));

  await prisma.sectionAccess.upsert({
    where: { key },
    create: { key, visibility, roles: allowed, updatedById: actorId },
    update: { visibility, roles: allowed, updatedById: actorId },
  });
}
