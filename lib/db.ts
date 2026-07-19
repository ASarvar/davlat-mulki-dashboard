import { promises as fs } from "fs";
import path from "path";
import { ManualEntry } from "./types";

/**
 * DIQQAT (prototip cheklovi):
 * Bu qatlam demo/prototip uchun oddiy JSON fayl (data/db.json) ustida ishlaydi.
 * Production muhitida (ayniqsa Vercel kabi serverless platformalarda) fayl
 * tizimi doimiy emas — shuning uchun bu qismni PostgreSQL/MySQL kabi haqiqiy
 * ma'lumotlar bazasiga (masalan Prisma ORM bilan) almashtirish tavsiya etiladi.
 * Interfeys (getManualEntries/upsertManualEntry) shu almashtirishni oson
 * qiladigan qilib ataylab ajratilgan.
 */

const DB_PATH = path.join(process.cwd(), "data", "db.json");

type DbShape = {
  manualEntries: ManualEntry[];
};

async function readDb(): Promise<DbShape> {
  const raw = await fs.readFile(DB_PATH, "utf-8");
  return JSON.parse(raw) as DbShape;
}

async function writeDb(data: DbShape): Promise<void> {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function getManualEntries(): Promise<ManualEntry[]> {
  const db = await readDb();
  return db.manualEntries;
}

export async function upsertManualEntry(
  entry: Pick<ManualEntry, "regionId" | "categoryId" | "count"> &
    Partial<Pick<ManualEntry, "fileName" | "fileUrl">>
): Promise<ManualEntry> {
  const db = await readDb();
  const idx = db.manualEntries.findIndex(
    (e) => e.regionId === entry.regionId && e.categoryId === entry.categoryId
  );

  const updated: ManualEntry = {
    regionId: entry.regionId,
    categoryId: entry.categoryId,
    count: entry.count,
    fileName:
      entry.fileName !== undefined
        ? entry.fileName
        : idx >= 0
        ? db.manualEntries[idx].fileName
        : null,
    fileUrl:
      entry.fileUrl !== undefined
        ? entry.fileUrl
        : idx >= 0
        ? db.manualEntries[idx].fileUrl
        : null,
    updatedAt: new Date().toISOString(),
  };

  if (idx >= 0) {
    db.manualEntries[idx] = updated;
  } else {
    db.manualEntries.push(updated);
  }

  await writeDb(db);
  return updated;
}
