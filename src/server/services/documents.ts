import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";

export interface SavedDocument {
  storageKey: string; // nisbiy yo'l (Document.storageKey)
  fileName: string;
  fileSize: number;
}

// PDF faylni local filesystem'ga saqlaydi. Public EMAS — /api/documents orqali beriladi.
export async function saveDocumentFile(
  file: File,
  opts: { regionId: string; cadNumber: string },
): Promise<SavedDocument> {
  if (file.type !== "application/pdf") throw new Error("Faqat PDF fayl qabul qilinadi");
  if (file.size <= 0) throw new Error("Fayl bo'sh");
  if (file.size > env.MAX_UPLOAD_BYTES) {
    throw new Error(`Fayl hajmi ${Math.round(env.MAX_UPLOAD_BYTES / 1024 / 1024)}MB dan oshmasligi kerak`);
  }

  const safeCad = opts.cadNumber.replace(/[^\w.-]/g, "_");
  const relDir = join(opts.regionId, "property", safeCad);
  const diskName = `${randomUUID()}.pdf`;

  const absDir = join(env.UPLOAD_DIR, relDir);
  await mkdir(absDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(absDir, diskName), buffer);

  // storageKey — DB'da saqlanadi (forward-slash, OS-neutral). fileName — asl nom (ko'rsatish uchun).
  const storageKey = join(relDir, diskName).split(sep).join("/");
  return { storageKey, fileName: file.name, fileSize: file.size };
}

// storageKey'dan absolyut yo'lni xavfsiz hal qiladi (path traversal himoyasi).
export function resolveDocumentPath(storageKey: string): string {
  const base = resolve(env.UPLOAD_DIR);
  const abs = resolve(base, storageKey);
  if (abs !== base && !abs.startsWith(base + sep)) {
    throw new Error("Yaroqsiz fayl yo'li");
  }
  return abs;
}
