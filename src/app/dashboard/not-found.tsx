import Link from "next/link";
import { FileQuestion } from "lucide-react";

/**
 * Bo'lim ochilmaganda (`requireSection` → `notFound()`) va mavjud bo'lmagan
 * manzillarda ko'rsatiladi.
 *
 * ⚠️ Matn ATAYLAB "ruxsatingiz yo'q" demaydi: bo'limning umuman borligi ham
 * oshkor qilinmaydi. Foydalanuvchi kerak bo'lsa administratorga murojaat qiladi.
 */
export default function DashboardNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-slate-100">
        <FileQuestion className="h-7 w-7 text-slate-400" />
      </div>
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--navy)" }}>
          Sahifa topilmadi
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Bunday sahifa mavjud emas yoki u sizga ochilmagan. Kerak bo'lsa administrator
          bilan bog'laning.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ background: "var(--navy)" }}
      >
        Boshqaruv paneliga qaytish
      </Link>
    </div>
  );
}
