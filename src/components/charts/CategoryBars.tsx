"use client";

import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { categoryColor, NEUTRAL } from "@/lib/chartColors";

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

/** Yorliqni so'zlar bo'yicha qatorlarga bo'ladi — Recharts o'qi matnni o'zi o'ramaydi. */
function wrapLabel(s: string, max: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of s.split(" ")) {
    if (cur && `${cur} ${w}`.length > max) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Yorliq TO'G'RI yoziladi (qiya emas — foydalanuvchi talabi, 2026-09-12) va so'zlar
 * bo'yicha ≤10 belgili qatorlarga bo'linadi. Eng uzun so'z ("shartnomasi",
 * "foydalanish") 10px shriftda ~55px — ustun oralig'i undan tor bo'lsa qo'shni
 * yorliqlar tegib qoladi. Shu sabab: kartalar yonida faqat `2xl` dan
 * (`dashboard/page.tsx`), tor ekranda esa `min-w` + gorizontal skroll.
 */
function WrappedTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const lines = wrapLabel(payload?.value ?? "", 10);
  return (
    <text x={x} y={y + 4} textAnchor="middle" fontSize={10} fill={NEUTRAL.text}>
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? "0.71em" : "1.2em"}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

/**
 * Kategoriya taqsimoti — gorizontal grafik: kategoriyalar pastki o'q bo'ylab,
 * rasmiy hisobot ustunlari tartibida, ustunlar yuqoriga o'sadi (foydalanuvchi
 * talabi, 2026-09-12). Keng ekranda kartalar YONIDA, 50/50 turadi.
 *
 * ⚠️ Halqa (donut) EMAS: sonlar hisobotning JAMI qatoridan olinadi, 3/4/5/6/12 esa
 * xususiyat bo'yicha sanalgani uchun bitta obyekt bir nechta ustunga kiradi —
 * yig'indi jamidan katta, ya'ni ular "butunning bo'laklari" emas. Ustun har bir
 * sonni mustaqil ko'rsatadi.
 *
 * ⚠️ Tor ekranda `min-w` + `overflow-x-auto` — 9 ta yorliq bir-birining ustiga
 * chiqib ketmasin, grafik o'z qutisida suriladi.
 *
 * ⚠️ `isAnimationActive={false}` — React 19 dev rejimidagi ikki marta renderda
 * Recharts ustunlari bo'sh `<g>` bo'lib qolardi.
 */
export function CategoryBars({ data }: { data: CategorySlice[] }) {
  const router = useRouter();
  const shown = data.filter((d) => d.count > 0);

  if (shown.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Ma&apos;lumot yo&apos;q</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[540px]">
        <ResponsiveContainer width="100%" height={270}>
          <BarChart accessibilityLayer data={shown} margin={{ top: 22, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={NEUTRAL.grid} />
            <XAxis
              type="category"
              dataKey="label"
              interval={0}
              height={46}
              tick={<WrappedTick />}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,.03)" }}
              formatter={(_v, _n, item) => {
                const d = item.payload as CategorySlice;
                return [`${d.countLabel} ta (${d.pctLabel}%)`, "Soni"];
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
            />
            <Bar dataKey="count" maxBarSize={56} radius={[3, 3, 0, 0]} isAnimationActive={false} className="cursor-pointer">
              {shown.map((d) => (
                <Cell key={d.code} fill={categoryColor(d.code)} onClick={() => router.push(d.href)} />
              ))}
              <LabelList dataKey="countLabel" position="top" fill={NEUTRAL.text} fontSize={11} fontWeight={600} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
