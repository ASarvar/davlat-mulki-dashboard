"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useRouter } from "next/navigation";
import { NEUTRAL } from "@/lib/chartColors";
import { nf, pct1 } from "@/lib/format";

export interface UtilityBar {
  name: string;
  value: number;
  color: string;
  href?: string;
}

/**
 * Kommunal qamrov — FAQAT "Bo'sh turgan" (kat 11) obyektlar bo'yicha.
 *
 * ⚠️ Har bir havolada `category=11` MAJBURIY (kommunal jadvaldagi qoida bilan bir xil),
 * usiz ro'yxatdagi son grafikdagidan katta chiqardi.
 */
export function UtilityCoverage({ data, vacantTotal }: { data: UtilityBar[]; vacantTotal: number }) {
  const router = useRouter();
  // ⚠️ Bo'sh turgan obyekt umuman bo'lmasa (masalan bitta tashkilotga cheklangan
  // foydalanuvchida) grafik yetti nolli ustun chizib, "tekshirildi — hech narsa
  // topilmadi" degan yolg'on taassurot berardi. Aslida tekshiriladigan obyekt yo'q.
  if (vacantTotal === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        &laquo;Bo&apos;sh turgan&raquo; obyekt yo&apos;q — tekshiriladigan narsa ham yo&apos;q
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34 + 24)}>
      <BarChart accessibilityLayer data={data} layout="vertical" margin={{ top: 0, right: 74, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke={NEUTRAL.grid} />
        <XAxis type="number" tick={{ fontSize: 11, fill: NEUTRAL.axis }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={124}
          tick={{ fontSize: 11.5, fill: NEUTRAL.text }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,.03)" }}
          formatter={(v) => [`${nf(Number(v))} ta (${pct1(Number(v), vacantTotal)}%)`, "Obyektlar"]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
          {data.map((d) => (
            <Cell
              key={d.name}
              fill={d.color}
              className={d.href ? "cursor-pointer" : undefined}
              onClick={() => d.href && router.push(d.href)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
