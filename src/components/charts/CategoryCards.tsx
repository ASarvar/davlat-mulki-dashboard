import type { CSSProperties } from "react";
import { categoryColor } from "@/lib/chartColors";
import type { CategorySlice } from "./CategoryDonut";

/**
 * Kategoriya taqsimotining KARTA ko'rinishi — halqa diagramma ustida turadi.
 *
 * Har bir karta: kategoriya nomi, obyektlar soni va ulushi (%). Chap chetdagi chiziq
 * `categoryColor()` dan — halqadagi bo'lak rangi bilan bir xil. Butun karta obyektlar
 * ro'yxatiga havola (`href` — `effectiveCategory=N`, halqa bo'lagi bilan bir xil mezon).
 *
 * ⚠️ Matnlar (`countLabel`/`pctLabel`) SERVERDA formatlangan — `CategoryDonut` bilan
 * bir xil sabab (uz-UZ raqami Node va brauzerda farq qiladi, gidratsiya buziladi).
 * Komponent sof server-side — client JS kerak emas.
 */
export function CategoryCards({ data }: { data: CategorySlice[] }) {
  const shown = data.filter((d) => d.count > 0);
  if (shown.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
      {shown.map((d) => {
        const color = categoryColor(d.code);
        return (
          <a
            key={d.code}
            href={d.href}
            style={{ "--cc": color, "--cc-shadow": `${color}59` } as CSSProperties}
            className="group/cc relative overflow-hidden rounded-xl border border-border bg-card p-3 pl-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[color:var(--cc)] hover:shadow-[0_10px_22px_-14px_var(--cc-shadow)]"
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1 transition-all duration-200 ease-out group-hover/cc:w-1.5"
              style={{ background: color }}
            />
            <p className="truncate text-[11px] font-medium text-muted-foreground" title={d.label}>
              {d.label}
            </p>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span
                className="text-xl font-bold leading-none tracking-tight tabular-nums"
                style={{ color: "var(--navy)" }}
              >
                {d.countLabel}
              </span>
              <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                {d.pctLabel}%
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
