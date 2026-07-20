import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface SourceInput {
  regionId: string;
  name: string;
  stir: string;
  isActive?: boolean;
}

export interface SourceFilters {
  regionId?: string;
  /** Soha = manba nomi ("Ijara markazi", "Sog'liqni saqlash", ...) */
  name?: string;
}

export async function listSources(f: SourceFilters = {}) {
  return prisma.organizationSource.findMany({
    where: {
      ...(f.regionId ? { regionId: f.regionId } : {}),
      ...(f.name ? { name: f.name } : {}),
    },
    orderBy: [{ region: { name: "asc" } }, { name: "asc" }],
    include: {
      region: { select: { id: true, name: true } },
      _count: { select: { properties: true } },
    },
  });
}

// Mavjud sohalar ro'yxati (filtr uchun) — bazadagi noyob nomlar.
export async function listSourceNames(): Promise<string[]> {
  const rows = await prisma.organizationSource.findMany({
    distinct: ["name"],
    orderBy: { name: "asc" },
    select: { name: true },
  });
  return rows.map((r) => r.name);
}

// Manbani o'chirish. Unga bog'langan obyektlar bo'lsa — O'CHIRMAYMIZ:
// Property.sourceId majburiy, ya'ni obyektlar ham yo'qolib ketardi.
export async function deleteSource(actorId: string, sourceId: string) {
  const src = await prisma.organizationSource.findUnique({
    where: { id: sourceId },
    select: { name: true, stir: true, _count: { select: { properties: true } } },
  });
  if (!src) throw new Error("Manba topilmadi");

  if (src._count.properties > 0) {
    throw new Error(
      `Bu manbaga ${src._count.properties} ta obyekt bog'langan — o'chirilsa ular ham yo'qoladi. ` +
        `Uni o'chirish o'rniga "Faol" belgisini olib qo'ying (sinxronizatsiyaga tushmaydi).`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.organizationSource.delete({ where: { id: sourceId } });
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "DELETE_SOURCE",
        entityType: "OrganizationSource",
        entityId: sourceId,
        metadata: { name: src.name, stir: src.stir },
      },
    });
  });
}

export async function createSource(actorId: string, input: SourceInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.organizationSource.create({
        data: {
          regionId: input.regionId,
          name: input.name.trim(),
          stir: input.stir.trim(),
          isActive: input.isActive ?? true,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE_SOURCE",
          entityType: "OrganizationSource",
          entityId: created.id,
          metadata: { stir: created.stir, name: created.name },
        },
      });
      return created;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("Bu hudud uchun ushbu STIR allaqachon mavjud");
    }
    throw err;
  }
}

export async function updateSource(
  actorId: string,
  sourceId: string,
  input: { name: string; stir: string; isActive: boolean },
) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.organizationSource.update({
        where: { id: sourceId },
        data: { name: input.name.trim(), stir: input.stir.trim(), isActive: input.isActive },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE_SOURCE",
          entityType: "OrganizationSource",
          entityId: sourceId,
          metadata: { stir: input.stir, isActive: input.isActive },
        },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("Bu hudud uchun ushbu STIR allaqachon mavjud");
    }
    throw err;
  }
}
