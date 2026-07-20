import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveDocumentPath } from "@/server/services/documents";

// Himoyalangan PDF berish: avval auth + rol/hudud tekshiriladi, keyin fayl stream qilinadi.
// Fayllar public EMAS (public/ ichida emas) — faqat shu route orqali.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) return new NextResponse("Avtorizatsiya talab qilinadi", { status: 401 });
  const user = session.user;

  const doc = await prisma.document.findUnique({
    where: { id },
    include: { property: { select: { regionId: true } } },
  });
  if (!doc) return new NextResponse("Hujjat topilmadi", { status: 404 });

  // REGION_USER faqat o'z hududi hujjatlarini ko'ra oladi.
  if (user.role === "REGION_USER" && doc.property.regionId !== user.regionId) {
    return new NextResponse("Ruxsat yo'q", { status: 403 });
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(resolveDocumentPath(doc.storageKey));
  } catch {
    return new NextResponse("Fayl diskda topilmadi", { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": doc.mimeType || "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}
