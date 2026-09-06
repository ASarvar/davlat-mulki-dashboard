"use client";

import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { categoryColor } from "@/lib/chartColors";
import { nf } from "@/lib/format";

/**
 * ⚠️ `countLabel` / `pctLabel` — SERVERDA formatlangan matnlar.
 *
 * Sabab: `toLocaleString("uz-UZ")` Node'da va brauzerda TURLI natija beradi
 * (Node: "1 167", brauzer: "1,167") — client komponentida formatlansa gidratsiya
 * buzilardi. Bu loyihada shu xato allaqachon bir marta sanalarda uchragan.
 * Grafik GEOMETRIYASI uchun `count` (son) qoladi, EKRANGA esa tayyor matn chiqadi.
 */
export interface CategorySlice {
  code: number;
  label: string;
  count: number;
  countLabel: string;
  pctLabel: string;
  href: string;
}

/**
 * Kategoriya taqsimoti — halqa diagramma + yonida yorliqlar ro'yxati.
 *
 * ⚠️ Yorliqlar ro'yxati ATAYLAB alohida ustunda: 11 (Bo'sh turgan) va 12 (Bo'sh maydoni
 * bor) oltinlari bir-biriga juda yaqin, faqat rangga tayanib ularni ajratib bo'lmasdi.
 * Har bir qator — obyektlar ro'yxatiga havola (grafik bo'lagini bosish ham shunday).
 *
 * `showLegend={false}` — yonidagi ro'yxat ko'rsatilmaydi (raqamlar boshqa joyda,
 * masalan yuqoridagi kartalar ko'rinishida). U holda halqa markazlashadi.
 */
export function CategoryDonut({
  data,
  totalLabel,
  showLegend = true,
}: {
  data: CategorySlice[];
  totalLabel: string;
  showLegend?: boolean;
}) {
  const router = useRouter();
  const shown = data.filter((d) => d.count > 0);

  if (shown.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Ma&apos;lumot yo&apos;q</p>;
  }

  return (
    <div
      className={
        showLegend
          ? "flex flex-col items-center gap-5 sm:flex-row sm:items-start"
          : "flex justify-center py-1"
      }
    >
      <div className="relative h-[200px] w-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shown}
              dataKey="count"
              nameKey="label"
              // ⚠️ Markaz va radius ANIQ SON, foiz emas: Recharts 3.x da "50%"
              // qiymati bo'lak geometriyasiga yetib bormay, `<svg>` atributiga
              // o'tib ketadi va halqa umuman chizilmaydi (bo'sh `<g>` qoladi).
              // Konteyner o'lchami qat'iy 200×200 bo'lgani uchun bu xavfsiz.
              cx={100}
              cy={100}
              innerRadius={58}
              outerRadius={92}
              paddingAngle={1}
              // ⚠️ Animatsiya o'chirilgan: React 19 ning dev rejimidagi ikki marta
              // render qilishida Recharts 3.x da bo'lak radiusi 0 da qotib qolib,
              // halqa umuman chizilmasdi (bo'sh `<g class="recharts-shape">`).
              isAnimationActive={false}
              stroke="#fff"
              strokeWidth={1.5}
              onClick={(d: unknown) => {
                const slice = d as { payload?: CategorySlice };
                if (slice?.payload?.href) router.push(slice.payload.href);
              }}
              className="cursor-pointer outline-none"
            >
              {shown.map((d) => (
                <Cell key={d.code} fill={categoryColor(d.code)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v, n) => [`${nf(Number(v))} ta`, String(n)]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Markazdagi jami — halqa ichida bo'sh joy behuda ketmasin. */}
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <p className="text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
            {totalLabel}
          </p>
          <p className="text-[11px] text-muted-foreground">obyekt</p>
        </div>
      </div>

      {showLegend ? (
        <ul className="w-full min-w-0 flex-1 space-y-0.5 text-[12px]">
          {shown.map((d) => (
            <li key={d.code}>
              <a
                href={d.href}
                className="flex items-center gap-2 rounded px-1.5 py-1 transition-colors hover:bg-muted"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: categoryColor(d.code) }}
                />
                <span className="min-w-0 flex-1 truncate text-slate-600">{d.label}</span>
                <b className="font-semibold tabular-nums">{d.countLabel}</b>
                <span className="w-11 text-right tabular-nums text-muted-foreground">
                  {d.pctLabel}%
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
