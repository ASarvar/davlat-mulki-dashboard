import { NextRequest, NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/categories";
import { upsertManualEntry } from "@/lib/db";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic"; // har doim yangi ma'lumot (keshlanmasin)

export async function GET() {
  try {
    const data = await getDashboardData();
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/data xato:", err);
    return NextResponse.json(
      { error: "Ma'lumotlarni yuklashda xatolik yuz berdi." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { regionId, categoryId, count } = body ?? {};

    if (!regionId || !categoryId || typeof count !== "number" || count < 0) {
      return NextResponse.json(
        { error: "regionId, categoryId va musbat count majburiy." },
        { status: 400 }
      );
    }

    const category = CATEGORIES.find((c) => c.id === categoryId);
    if (!category) {
      return NextResponse.json(
        { error: "Noma'lum kategoriya." },
        { status: 400 }
      );
    }
    if (category.isIntegration) {
      return NextResponse.json(
        {
          error:
            "Bu kategoriya API integratsiyasi orqali to'ldiriladi va qo'lda o'zgartirib bo'lmaydi.",
        },
        { status: 403 }
      );
    }

    const updated = await upsertManualEntry({ regionId, categoryId, count });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("POST /api/data xato:", err);
    return NextResponse.json(
      { error: "Saqlashda xatolik yuz berdi." },
      { status: 500 }
    );
  }
}
