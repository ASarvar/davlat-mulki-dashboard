import { categoryColor } from "@/lib/chartColors";
import { categoryIcon } from "@/lib/categoryIcons";
import type { CategorySlice } from "./CategoryDonut";

/**
 * Kategoriya taqsimotining KARTA ko'rinishi — halqa diagrammaning YONIDA turadi
 * (halqadagi yorliqlar ro'yxati o'rniga).
 *
 * ⚠️ Dizayn ATAYLAB yuqoridagi asosiy KPI kartalaridan farqli: oq fon, ramka va
 * soya yo'q. Rang faqat ikonka chipida — halqadagi bo'lak rangi bilan bir xil
 * (`categoryColor`), ikonkasi esa `categoryIcon` dan. Shu bilan "asosiy
 * ko'rsatkich" va "taqsimot bo'lagi" vizual ravishda ajraladi.
 *
 * Har bir karta obyektlar ro'yxatiga havola (`href` — `effectiveCategory=N`, halqa
 * bo'lagini bosish bilan bir xil mezon).
 *
 * ⚠️ Matnlar (`countLabel`/`pctLabel`) SERVERDA formatlangan — `CategoryDonut` bilan
 * bir xil sabab. Komponent sof server-side — client JS kerak emas.
 */
export function CategoryCards({ data }: { data: CategorySlice[] }) {
  const shown = data.filter((d) => d.count > 0);
  if (shown.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
              <p className="truncate text-[11.5px] font-medium text-slate-600" title={d.label}>
                {d.label}
              </p>
              <p className="mt-0.5 flex items-baseline gap-1.5">
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
