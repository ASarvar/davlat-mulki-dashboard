import type { CSSProperties } from "react";
import { categoryColor } from "@/lib/chartColors";
import type { CategorySlice } from "./CategoryDonut";

/**
 * Kategoriya taqsimotining KARTA ko'rinishi — halqa diagramma YONIDA turadi
 * (halqadagi yorliqlar ro'yxati o'rniga).
 *
 * ⚠️ Dizayn ATAYLAB yuqoridagi asosiy KPI kartalaridan farqli: ramka/soya/ikonka yo'q,
 * faqat kategoriya rangining yengil foni + nuqta. Shu bilan "asosiy ko'rsatkich" va
 * "taqsimot bo'lagi" vizual ravishda ajraladi.
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
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      {shown.map((d) => {
        const color = categoryColor(d.code);
        return (
          <a
            key={d.code}
            href={d.href}
            style={
              {
                "--ct": `${color}14`,
                "--ct-hover": `${color}26`,
                "--cd": color,
              } as CSSProperties
            }
            className="rounded-lg bg-[color:var(--ct)] px-3 py-2 transition-colors duration-150 hover:bg-[color:var(--ct-hover)]"
          >
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: "var(--cd)" }}
              />
              <span className="truncate text-[11px] font-medium text-slate-600" title={d.label}>
                {d.label}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5 pl-3.5">
              <span
                className="text-base font-bold leading-none tabular-nums"
                style={{ color: "var(--navy)" }}
              >
                {d.countLabel}
              </span>
              <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                {d.pctLabel}%
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
