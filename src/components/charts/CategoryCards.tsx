import { categoryColor } from "@/lib/chartColors";
import { categoryIcon } from "@/lib/categoryIcons";
import type { CategorySlice } from "./CategoryBars";

/**
 * Kategoriya taqsimotining KARTA ko'rinishi — ustunli grafikning YONIDA (50/50) turadi,
 * 3 ustunda (foydalanuvchi talabi, 2026-09-12: 2 ustunda kartalarda bo'sh joy ko'p edi).
 * Tor kartada yorliq kesilmaydi — 2 qatorga o'raladi (`line-clamp-2`), foiz esa
 * sig'masa son ostiga tushadi (`flex-wrap`).
 *
 * ⚠️ Dizayn ATAYLAB yuqoridagi asosiy KPI kartalaridan farqli: oq fon, ramka va
 * soya yo'q. Rang faqat ikonka chipida — ustun rangi bilan bir xil
 * (`categoryColor`), ikonkasi esa `categoryIcon` dan. Shu bilan "asosiy
 * ko'rsatkich" va "taqsimot bo'lagi" vizual ravishda ajraladi.
 *
 * Har bir karta obyektlar ro'yxatiga havola — mezoni sonning o'zi bilan bir xil
 * (qanday qurilishi `dashboard/page.tsx` da).
 *
 * ⚠️ Matnlar (`countLabel`/`pctLabel`) SERVERDA formatlangan — `CategoryBars` bilan
 * bir xil sabab. Komponent sof server-side — client JS kerak emas.
 */
export function CategoryCards({ data }: { data: CategorySlice[] }) {
  const shown = data.filter((d) => d.count > 0);
  if (shown.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {shown.map((d) => {
        const color = categoryColor(d.code);
        const Icon = categoryIcon(d.code);
        return (
          <a
            key={d.code}
            href={d.href}
            className="group/cc flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2.5 transition-colors duration-150 hover:bg-muted"
          >
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-lg text-white shadow-sm transition-transform duration-150 group-hover/cc:scale-105"
              style={{ background: color }}
            >
              <Icon className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[11.5px] font-medium leading-tight text-slate-600" title={d.label}>
                {d.label}
              </p>
              <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
                <span
                  className="text-lg font-bold leading-none tabular-nums"
                  style={{ color: "var(--navy)" }}
                >
                  {d.countLabel}
                </span>
                <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                  {d.pctLabel}%
                </span>
              </p>
            </div>
          </a>
        );
      })}
    </div>
  );
}
