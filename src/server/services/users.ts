import bcrypt from "bcryptjs";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface CreateUserInput {
  username: string;
  fullName: string;
  password: string;
  role: Role;
  sourceId?: string | null; // IJROCHI uchun (aynan bitta tashkilot)
  allSources?: boolean; // MODERATOR uchun (hamma tashkilot)
  moderatorSourceIds?: string[]; // MODERATOR uchun (aniq tashkilotlar)
}

export interface UpdateUserInput {
  userId: string;
  role: Role;
  sourceId?: string | null;
  allSources?: boolean;
  moderatorSourceIds?: string[];
  isActive: boolean;
}

// Rol bo'yicha TASHKILOT ma'lumotini normallashtiradi va validatsiya qiladi.
// ⚠️ Doira hudud emas, tashkilot bo'yicha (2026-07-30) — `OrganizationSource.id`.
function resolveSources(input: {
  role: Role;
  sourceId?: string | null;
  allSources?: boolean;
  moderatorSourceIds?: string[];
}): { sourceId: string | null; allSources: boolean; moderatorSourceIds: string[] } {
  if (input.role === "IJROCHI") {
    if (!input.sourceId) throw new Error("Ijrochi uchun tashkilot tanlanishi shart");
    return { sourceId: input.sourceId, allSources: false, moderatorSourceIds: [] };
  }
  if (input.role === "MODERATOR") {
    const all = Boolean(input.allSources);
    const ids = all ? [] : (input.moderatorSourceIds ?? []).filter(Boolean);
    if (!all && ids.length === 0)
      throw new Error("Moderator uchun kamida bitta tashkilot yoki 'hammasi' tanlang");
    return { sourceId: null, allSources: all, moderatorSourceIds: ids };
  }
  // SUPER_ADMIN / ADMIN / RAHBARIYAT / VIEWER — tashkilot saqlanmaydi (cheklovsiz).
  return { sourceId: null, allSources: false, moderatorSourceIds: [] };
}

export interface UserFilters {
  /**
   * SOHA (`OrganizationSource.name`) — "Ijara markazi", "Direksiya", ...
   * ⚠️ Aynan tashkilot (`OrganizationSource.id`) EMAS: bir sohaga 14 hududning
   * tashkilotlari kiradi va foydalanuvchilar ro'yxatida soha kesimi amaliyroq
   * (foydalanuvchi talabi, 2026-08-19). Dashboard va obyektlardagi `soha` filtri
   * bilan bir xil mezon.
   */
  soha?: string;
  role?: Role;
  /** ADMIN uchun: SUPER_ADMIN foydalanuvchilarni ko'rsatmaymiz. */
  hideSuperAdmin?: boolean;
}

export async function listUsers(f: UserFilters = {}) {
  return prisma.user.findMany({
    where: {
      // Ijrochi bitta tashkilotga (`sourceId`), moderator bir nechtasiga
      // (`moderatorSources`) biriktiriladi — ikkalasi ham shu soha ichida qidiriladi.
      ...(f.soha
        ? {
            OR: [
              { source: { name: f.soha } },
              { moderatorSources: { some: { source: { name: f.soha } } } },
            ],
          }
        : {}),
      ...(f.role ? { role: f.role } : {}),
      ...(f.hideSuperAdmin ? { role: { not: "SUPER_ADMIN" } } : {}),
    },
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      isActive: true,
      allSources: true,
      createdAt: true,
      source: { select: { id: true, name: true, orgName: true, region: { select: { name: true } } } },
      moderatorSources: { select: { sourceId: true } },
      _count: { select: { documents: true, assignments: true, requestedChanges: true } },
    },
  });
}

export async function deleteUser(actorId: string, userId: string) {
  if (actorId === userId) throw new Error("O'z hisobingizni o'chira olmaysiz");

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      role: true,
      _count: { select: { documents: true, assignments: true, requestedChanges: true } },
    },
  });
  if (!target) throw new Error("Foydalanuvchi topilmadi");

  if (target.role === "SUPER_ADMIN") {
    const activeAdmins = await prisma.user.count({ where: { role: "SUPER_ADMIN", isActive: true } });
    if (activeAdmins <= 1) throw new Error("Tizimda kamida bitta faol super admin qolishi kerak");
  }

  const { documents, assignments, requestedChanges } = target._count;
  if (documents > 0 || assignments > 0 || requestedChanges > 0) {
    throw new Error(
      `Bu foydalanuvchida ${documents} hujjat, ${assignments} biriktirish, ${requestedChanges} so'rov bor — ` +
        `o'chirib bo'lmaydi (audit izi saqlanishi kerak). Uni "Faol" belgisini olib bloklang.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.delete({ where: { id: userId } });
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "DELETE_USER",
        entityType: "User",
        entityId: userId,
        metadata: { username: target.username, role: target.role },
      },
    });
  });
}

export async function createUser(actorId: string, input: CreateUserInput) {
  const { sourceId, allSources, moderatorSourceIds } = resolveSources(input);
  const passwordHash = await bcrypt.hash(input.password, 10);
  const username = input.username.toLowerCase().trim();

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username,
          fullName: input.fullName.trim(),
          passwordHash,
          role: input.role,
          sourceId,
          allSources,
          moderatorSources: moderatorSourceIds.length
            ? { create: moderatorSourceIds.map((sid) => ({ sourceId: sid })) }
            : undefined,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE_USER",
          entityType: "User",
          entityId: created.id,
          metadata: { username: created.username, role: created.role },
        },
      });
      return created;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("Bu login allaqachon band");
    }
    throw err;
  }
}

export async function updateUser(actorId: string, input: UpdateUserInput) {
  const { sourceId, allSources, moderatorSourceIds } = resolveSources(input);

  // O'zini bloklab qo'yishning oldini olamiz (lockout himoyasi).
  if (actorId === input.userId) {
    if (input.role !== "SUPER_ADMIN" && input.role !== "ADMIN")
      throw new Error("O'z rolingizni bu darajaga pasaytira olmaysiz");
    if (!input.isActive) throw new Error("O'z hisobingizni o'chira olmaysiz");
  }

  // Oxirgi faol SUPER_ADMIN qolmasligiga yo'l qo'ymaymiz.
  if (input.role !== "SUPER_ADMIN" || !input.isActive) {
    const target = await prisma.user.findUnique({ where: { id: input.userId }, select: { role: true } });
    if (target?.role === "SUPER_ADMIN") {
      const activeAdmins = await prisma.user.count({ where: { role: "SUPER_ADMIN", isActive: true } });
      if (activeAdmins <= 1) throw new Error("Tizimda kamida bitta faol super admin qolishi kerak");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.userSource.deleteMany({ where: { userId: input.userId } });
    await tx.user.update({
      where: { id: input.userId },
      data: {
        role: input.role,
        sourceId,
        allSources,
        isActive: input.isActive,
        moderatorSources: moderatorSourceIds.length
          ? { create: moderatorSourceIds.map((sid) => ({ sourceId: sid })) }
          : undefined,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "UPDATE_USER",
        entityType: "User",
        entityId: input.userId,
        metadata: { role: input.role, isActive: input.isActive, sourceId, allSources },
      },
    });
  });
}

export async function resetPassword(actorId: string, userId: string, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await tx.auditLog.create({
      data: { userId: actorId, action: "RESET_PASSWORD", entityType: "User", entityId: userId },
    });
  });
}
