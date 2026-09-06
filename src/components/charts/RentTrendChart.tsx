"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BRAND, NEUTRAL } from "@/lib/chartColors";
import { nf } from "@/lib/format";

export interface TrendRow {
  /** Serverda formatlangan yorliq ("Yan 26") — gidratsiya buzilmasin. */
  label: string;
  count: number;
  /** Maydon, ming m². */
  area: number;
}

/**
 * Oylik ijara shartnomalari — ustunlar soni, chiziq maydoni.
 *
 * Ikki o'q ataylab: shartnoma SONI o'nliklarda, MAYDON esa ming m² da yuradi —
 * bitta o'qda maydon chizig'i ustunlarni butunlay bosib ketardi.
 */
export function RentTrendChart({ data }: { data: TrendRow[] }) {
  // ⚠️ Oylar NOL bilan to'ldiriladi (`trends.ts` → `fillMonths`), ya'ni massiv hech
  // qachon bo'sh bo'lmaydi. Lekin hammasi nol bo'lsa — tep-tekis nol chiziq
  // "shartnoma tuzilmagan" emas, "grafik buzuq" degan taassurot berardi.
  if (data.every((d) => d.count === 0)) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Bu yilda sanasi ko&apos;rsatilgan shartnoma yo&apos;q
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={250}>
      <ComposedChart accessibilityLayer data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={NEUTRAL.grid} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10.5, fill: NEUTRAL.muted }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={12}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 10.5, fill: NEUTRAL.axis }}
          axisLine={false}
          tickLine={false}
          width={38}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 10.5, fill: "#8a6d33" }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,.03)" }}
          formatter={(v, n) =>
            n === "count"
              ? [`${nf(Number(v))} ta`, "Shartnomalar"]
              : [`${nf(Number(v), 1)} ming m²`, "Maydon"]
          }
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          height={24}
          iconSize={9}
          formatter={(v: string) => (
            <span style={{ fontSize: 11.5, color: NEUTRAL.text }}>
              {v === "count" ? "Shartnomalar soni" : "Maydon (ming m²)"}
            </span>
          )}
        />
        <Bar yAxisId="left" dataKey="count" fill={BRAND.cobalt} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="area"
          stroke={BRAND.gold}
          strokeWidth={2.2}
          dot={{ r: 2.5, fill: "#fff", stroke: BRAND.gold, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
