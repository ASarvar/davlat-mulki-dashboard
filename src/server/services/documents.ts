import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";

export interface SavedDocument {
  storageKey: string; // nisbiy yo'l (Document.storageKey)
  fileName: string;
  fileSize: number;
  mimeType: string;
}

// Ixtiyoriy ilova rasmlari soni — forma ham, server ham shu chegarani ishlatadi.
export const MAX_IMAGE_ATTACHMENTS = 4;

// Rasmlar uchun PDF'dan kichikroq chegara (env.MAX_UPLOAD_BYTES — asoslovchi hujjat uchun).
export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

// Qabul qilinadigan turlar → diskdagi kengaytma.
const PDF_EXT: Record<string, string> = { "application/pdf": "pdf" };
const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const IMAGE_ACCEPT = Object.keys(IMAGE_EXT).join(",");

// Faylni local filesystem'ga saqlaydi. Public EMAS — /api/documents orqali beriladi.
// `kind` faqat qaysi MIME turlari ruxsat etilishini belgilaydi (PDF asoslovchi hujjat,
// image — ixtiyoriy ilova rasmlari).
export async function saveDocumentFile(
  file: File,
  opts: { regionId: string; cadNumber: string; kind?: "pdf" | "image" },
): Promise<SavedDocument> {
  const kind = opts.kind ?? "pdf";
  const allowed = kind === "image" ? IMAGE_EXT : PDF_EXT;
  const ext = allowed[file.type];
  if (!ext) {
    throw new Error(
      kind === "image"
        ? "Rasm faqat JPG, PNG yoki WEBP formatida bo'lishi kerak"
        : "Faqat PDF fayl qabul qilinadi",
    );
  }
  if (file.size <= 0) throw new Error("Fayl bo'sh");
  const maxBytes = kind === "image" ? MAX_IMAGE_UPLOAD_BYTES : env.MAX_UPLOAD_BYTES;
  if (file.size > maxBytes) {
    throw new Error(`Fayl hajmi ${Math.round(maxBytes / 1024 / 1024)}MB dan oshmasligi kerak`);
  }

  const safeCad = opts.cadNumber.replace(/[^\w.-]/g, "_");
  const relDir = join(opts.regionId, "property", safeCad);
  const diskName = `${randomUUID()}.${ext}`;

  const absDir = join(env.UPLOAD_DIR, relDir);
  await mkdir(absDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(absDir, diskName), buffer);

  // storageKey — DB'da saqlanadi (forward-slash, OS-neutral). fileName — asl nom (ko'rsatish uchun).
  const storageKey = join(relDir, diskName).split(sep).join("/");
  return { storageKey, fileName: file.name, fileSize: file.size, mimeType: file.type };
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
