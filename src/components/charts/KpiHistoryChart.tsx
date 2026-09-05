"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BRAND, NEUTRAL } from "@/lib/chartColors";
import { nf } from "@/lib/format";

export interface KpiHistoryRow {
  /** Serverda formatlangan yorliq ("05.09") — gidratsiya buzilmasin. */
  label: string;
  total: number;
  vacant: number;
  rented: number;
}

const SERIES = [
  { key: "total", label: "Jami obyektlar", color: BRAND.cobalt },
  { key: "vacant", label: "Bo'sh turgan", color: BRAND.gold },
  { key: "rented", label: "Ijaraga berilgan", color: "#2c6e8a" },
] as const;

const LABEL: Record<string, string> = Object.fromEntries(SERIES.map((s) => [s.key, s.label]));

/**
 * Asosiy ko'rsatkichlar dinamikasi — kunlik snapshot jadvalidan.
 *
 * ⚠️ Uchala qator BITTA o'qda: jami / bo'sh turgan / ijaradagi sonlar bir xil
 * tartibda yuradi (mingliklar), shuning uchun ikkinchi o'q chalg'itardi.
 *
 * ⚠️ `domain` **`[0, auto]` EMAS, `["auto", "auto"]`** — nol'dan boshlansa kunlik
 * o'zgarish (2400 → 2405) tekis chiziqqa aylanib, grafikning butun ma'nosi
 * yo'qolardi. O'zgarishni ko'rsatish uchun mo'ljallangan, hajmni emas.
 */
export function KpiHistoryChart({ data }: { data: KpiHistoryRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart accessibilityLayer data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={NEUTRAL.grid} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10.5, fill: NEUTRAL.muted }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          tick={{ fontSize: 10.5, fill: NEUTRAL.axis }}
          axisLine={false}
          tickLine={false}
          width={44}
          domain={["auto", "auto"]}
        />
        <Tooltip
          cursor={{ stroke: NEUTRAL.axis, strokeDasharray: "3 3" }}
          formatter={(v, n) => [`${nf(Number(v))} ta`, LABEL[String(n)] ?? String(n)]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          height={24}
          iconSize={9}
          formatter={(v: string) => (
            <span style={{ fontSize: 11.5, color: NEUTRAL.text }}>{LABEL[v] ?? v}</span>
          )}
        />
        {SERIES.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color}
            strokeWidth={2.2}
            // ⚠️ React 19 dev rejimida ikki marta render bo'ladi va animatsiya yoqiq
            // bo'lsa Recharts bo'sh shakl chizib qo'yadi (donutda aynan shu bo'lgan edi).
            isAnimationActive={false}
            dot={data.length <= 14 ? { r: 2.5, fill: "#fff", stroke: s.color, strokeWidth: 2 } : false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
