import bcrypt from "bcryptjs";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface CreateUserInput {
  email: string;
  fullName: string;
  password: string;
  role: Role;
  regionId?: string | null;
}

export interface UpdateUserInput {
  userId: string;
  role: Role;
  regionId?: string | null;
  isActive: boolean;
}

// REGION_USER uchun hudud majburiy; SUPER_ADMIN/VIEWER uchun hudud saqlanmaydi.
function normalizeRegion(role: Role, regionId?: string | null): string | null {
  if (role === "REGION_USER") {
    if (!regionId) throw new Error("REGION_USER uchun hudud tanlanishi shart");
    return regionId;
  }
  return null;
}

export interface UserFilters {
  regionId?: string;
  role?: Role;
}

export async function listUsers(f: UserFilters = {}) {
  return prisma.user.findMany({
    where: {
      ...(f.regionId ? { regionId: f.regionId } : {}),
      ...(f.role ? { role: f.role } : {}),
    },
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      createdAt: true,
      region: { select: { id: true, name: true } },
      // O'chirish mumkinligini aniqlash uchun — bu yozuvlar userga bog'liq (majburiy FK)
      _count: { select: { documents: true, assignments: true } },
    },
  });
}

// Foydalanuvchini butunlay o'chirish.
// Hujjat yuklagan yoki kategoriya biriktirgan bo'lsa — O'CHIRMAYMIZ: audit izi
// yo'qoladi va FK ham ruxsat bermaydi. Bunday holatda "bloklash" tavsiya qilinadi.
export async function deleteUser(actorId: string, userId: string) {
  if (actorId === userId) throw new Error("O'z hisobingizni o'chira olmaysiz");

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      role: true,
      _count: { select: { documents: true, assignments: true } },
    },
  });
  if (!target) throw new Error("Foydalanuvchi topilmadi");

  if (target.role === "SUPER_ADMIN") {
    const activeAdmins = await prisma.user.count({ where: { role: "SUPER_ADMIN", isActive: true } });
    if (activeAdmins <= 1) throw new Error("Tizimda kamida bitta faol super admin qolishi kerak");
  }

  const { documents, assignments } = target._count;
  if (documents > 0 || assignments > 0) {
    throw new Error(
      `Bu foydalanuvchi ${documents} ta hujjat yuklagan va ${assignments} ta kategoriya biriktirgan — ` +
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
        metadata: { email: target.email, role: target.role },
      },
    });
  });
}

export async function createUser(actorId: string, input: CreateUserInput) {
  const regionId = normalizeRegion(input.role, input.regionId);
  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email.toLowerCase().trim(),
          fullName: input.fullName.trim(),
          passwordHash,
          role: input.role,
          regionId,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE_USER",
          entityType: "User",
          entityId: created.id,
          metadata: { email: created.email, role: created.role },
        },
      });
      return created;
    });
    return user;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("Bu email allaqachon ro'yxatdan o'tgan");
    }
    throw err;
  }
}

export async function updateUser(actorId: string, input: UpdateUserInput) {
  const regionId = normalizeRegion(input.role, input.regionId);

  // O'zini bloklab qo'yishning oldini olamiz (lockout himoyasi).
  if (actorId === input.userId) {
    if (input.role !== "SUPER_ADMIN") throw new Error("O'z rolingizni pasaytira olmaysiz");
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
    await tx.user.update({
      where: { id: input.userId },
      data: { role: input.role, regionId, isActive: input.isActive },
    });
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "UPDATE_USER",
        entityType: "User",
        entityId: input.userId,
        metadata: { role: input.role, isActive: input.isActive, regionId },
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
