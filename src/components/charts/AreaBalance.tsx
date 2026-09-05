"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BRAND, NEUTRAL } from "@/lib/chartColors";
import { nf } from "@/lib/format";

export interface AreaBar {
  name: string;
  /** Ijaraga berilgan maydon, ming m². */
  rented: number;
  /** Bo'sh maydon, ming m². */
  vacant: number;
}

/**
 * Maydon balansi — hududlar kesimida ijaradagi va bo'sh maydon.
 *
 * ⚠️ Qiymatlar ming m² da (rasmiy hisobot shakli bilan bir xil o'lchov).
 * ⚠️ Bu grafikda drill-down YO'Q — ataylab: maydon yig'indisiga mos keladigan
 * bitta obyekt filtri yo'q (maydon bir nechta kategoriyaga tarqalgan), noto'g'ri
 * havola esa ro'yxatda boshqa songa olib borardi.
 */
export function AreaBalance({ data }: { data: AreaBar[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Ma&apos;lumot yo&apos;q</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart accessibilityLayer data={data} margin={{ top: 4, right: 8, bottom: 44, left: 0 }}>
        <CartesianGrid vertical={false} stroke={NEUTRAL.grid} />
        <XAxis
          dataKey="name"
          angle={-42}
          textAnchor="end"
          interval={0}
          height={60}
          tick={{ fontSize: 10.5, fill: NEUTRAL.muted }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 10.5, fill: NEUTRAL.axis }} axisLine={false} tickLine={false} width={44} />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,.03)" }}
          formatter={(v, n) => [`${nf(Number(v), 1)} ming m²`, n === "rented" ? "Ijarada" : "Bo'sh"]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          height={24}
          iconType="square"
          iconSize={9}
          formatter={(v: string) => (
            <span style={{ fontSize: 11.5, color: NEUTRAL.text }}>
              {v === "rented" ? "Ijarada" : "Bo'sh"}
            </span>
          )}
        />
        <Bar dataKey="rented" stackId="a" fill="#2c6e8a" radius={[0, 0, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="vacant" stackId="a" fill={BRAND.goldLight} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
