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

const LABEL: Record<"rented" | "vacant", string> = { rented: "Ijarada", vacant: "Bo'sh" };
const COLOR: Record<"rented" | "vacant", string> = { rented: "#2c6e8a", vacant: BRAND.goldLight };

/**
 * Maydon — hududlar kesimida.
 *
 * `series` berilmasa ikkalasi bitta ustunda TAXLANADI (balans ko'rinishi);
 * berilsa faqat o'sha bittasi chiziladi va afsona ko'rsatilmaydi — sarlavha
 * allaqachon nimani ko'rsatayotganini aytadi (foydalanuvchi tanlovi, 2026-09-06:
 * ijaradagi va bo'sh maydon alohida grafiklarda).
 *
 * ⚠️ Qiymatlar ming m² da (rasmiy hisobot shakli bilan bir xil o'lchov).
 * ⚠️ Bu grafikda drill-down YO'Q — ataylab: maydon yig'indisiga mos keladigan
 * bitta obyekt filtri yo'q (maydon bir nechta kategoriyaga tarqalgan), noto'g'ri
 * havola esa ro'yxatda boshqa songa olib borardi.
 */
export function AreaBalance({
  data,
  series,
}: {
  data: AreaBar[];
  series?: "rented" | "vacant";
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Ma&apos;lumot yo&apos;q</p>;
  }
  // ⚠️ Bitta seriya rejimida ustunlar O'Z qiymati bo'yicha qayta saralanadi —
  // aks holda "Bo'sh maydon" grafigida ustunlar ijara tartibida tushib, o'sish
  // tartibi buzilgandek ko'rinardi.
  const rows = series ? [...data].sort((a, b) => b[series] - a[series]) : data;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart accessibilityLayer data={rows} margin={{ top: 4, right: 8, bottom: 44, left: 0 }}>
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
          formatter={(v, n) => [`${nf(Number(v), 1)} ming m²`, LABEL[n === "rented" ? "rented" : "vacant"]]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        {!series && (
          <Legend
            verticalAlign="top"
            align="right"
            height={24}
            iconType="square"
            iconSize={9}
            formatter={(v: string) => (
              <span style={{ fontSize: 11.5, color: NEUTRAL.text }}>
                {LABEL[v === "rented" ? "rented" : "vacant"]}
              </span>
            )}
          />
        )}
        {series ? (
          <Bar
            dataKey={series}
            fill={COLOR[series]}
            radius={[3, 3, 0, 0]}
            maxBarSize={38}
            isAnimationActive={false}
          />
        ) : (
          <>
            <Bar dataKey="rented" stackId="a" fill={COLOR.rented} radius={[0, 0, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="vacant" stackId="a" fill={COLOR.vacant} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </>
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
