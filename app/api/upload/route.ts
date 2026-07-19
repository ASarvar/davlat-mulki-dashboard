import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { CATEGORIES } from "@/lib/categories";
import { REGIONS } from "@/lib/regions";
import { upsertManualEntry, getManualEntries } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png"];

/**
 * Har bir asos fayl FAQAT bitta (hudud, kategoriya) juftligiga tegishli
 * bo'lishi shart. Buni ta'minlash uchun:
 *   1. Fayl jismonan  /public/uploads/<categoryId>/...  papkasiga
 *      (kategoriya bo'yicha ajratilgan papka) saqlanadi.
 *   2. data/db.json ichida yozuv regionId+categoryId bo'yicha bog'lanadi.
 *   3. Boshqa kategoriya uchun forma ochilganda faqat o'sha kategoriyaga
 *      tegishli fayl ko'rinadi/almashtiriladi (components/EntryForm.tsx'ga q.).
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const regionId = formData.get("regionId");
    const categoryId = formData.get("categoryId");
    const countRaw = formData.get("count");
    const file = formData.get("file");

    if (
      typeof regionId !== "string" ||
      typeof categoryId !== "string" ||
      typeof countRaw !== "string"
    ) {
      return NextResponse.json(
        { error: "regionId, categoryId va count majburiy." },
        { status: 400 }
      );
    }

    const count = Number(countRaw);
    if (!Number.isFinite(count) || count < 0) {
      return NextResponse.json(
        { error: "count musbat son bo'lishi kerak." },
        { status: 400 }
      );
    }

    const region = REGIONS.find((r) => r.id === regionId);
    const category = CATEGORIES.find((c) => c.id === categoryId);

    if (!region || !category) {
      return NextResponse.json(
        { error: "Hudud yoki kategoriya topilmadi." },
        { status: 400 }
      );
    }

    if (category.isIntegration) {
      return NextResponse.json(
        {
          error:
            "Bu kategoriya API integratsiyasi orqali to'ldiriladi, fayl biriktirish shart emas.",
        },
        { status: 403 }
      );
    }

    let fileName: string | null = null;
    let fileUrl: string | null = null;

    if (file instanceof File) {
      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          {
            error: `Ruxsat etilmagan fayl turi. Quyidagilardan foydalaning: ${ALLOWED_EXTENSIONS.join(
              ", "
            )}`,
          },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Fayl hajmi 10 MB dan oshmasligi kerak." },
          { status: 400 }
        );
      }

      // Fayl shu kategoriyaga ajratilgan papkaga saqlanadi -> boshqa
      // kategoriyalar bilan aralashib ketmaydi.
      const categoryDir = path.join(
        process.cwd(),
        "public",
        "uploads",
        category.id
      );
      await fs.mkdir(categoryDir, { recursive: true });

      const safeStamp = Date.now();
      const storedName = `${region.id}-${safeStamp}${ext}`;
      const filePath = path.join(categoryDir, storedName);

      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(filePath, buffer);

      fileName = file.name;
      fileUrl = `/uploads/${category.id}/${storedName}`;

      // Shu (hudud, kategoriya) uchun avval yuklangan eski fayl bo'lsa,
      // uni diskdan tozalab qo'yamiz (bitta yozuv = bitta amaldagi fayl).
      const existing = (await getManualEntries()).find(
        (e) => e.regionId === region.id && e.categoryId === category.id
      );
      if (existing?.fileUrl && existing.fileUrl !== fileUrl) {
        const oldPath = path.join(process.cwd(), "public", existing.fileUrl);
        await fs.unlink(oldPath).catch(() => {
          /* fayl allaqachon yo'q bo'lsa e'tiborsiz qoldiramiz */
        });
      }
    }

    const updated = await upsertManualEntry({
      regionId: region.id,
      categoryId: category.id,
      count,
      ...(file instanceof File ? { fileName, fileUrl } : {}),
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("POST /api/upload xato:", err);
    return NextResponse.json(
      { error: "Faylni yuklashda xatolik yuz berdi." },
      { status: 500 }
    );
  }
}
