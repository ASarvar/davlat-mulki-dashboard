"use client";

import { useRouter } from "next/navigation";
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
import { BRAND, NEUTRAL } from "@/lib/chartColors";
import { nf } from "@/lib/format";

export interface RegionBar {
  name: string;
  /** Bo'sh turgan (samarasiz) obyektlar. */
  vacant: number;
  /** Qolganlari — foydalanilmoqda. */
  used: number;
  total: number;
  vacantHref: string;
  totalHref: string;
}

/**
 * Hududlar reytingi — gorizontal ustunlar, bo'sh turganlar ulushi bilan.
 *
 * ⚠️ Ustun UZUNLIGI jami obyektni, OLTIN qismi esa bo'sh turganlarni bildiradi —
 * ya'ni ekranda oltin qancha ko'p bo'lsa, o'sha hududda muammo shuncha katta.
 * Tartib: jami bo'yicha kamayish tartibida (eng katta hudud tepada).
 */
export function RegionRanking({ data }: { data: RegionBar[] }) {
  const router = useRouter();
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Ma&apos;lumot yo&apos;q</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 26 + 30)}>
      <BarChart accessibilityLayer data={data} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke={NEUTRAL.grid} />
        <XAxis type="number" tick={{ fontSize: 11, fill: NEUTRAL.axis }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={116}
          tick={{ fontSize: 11.5, fill: NEUTRAL.text }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,.03)" }}
          formatter={(v, n) => [`${nf(Number(v))} ta`, n === "vacant" ? "Bo'sh turgan" : "Foydalanilmoqda"]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        {/* Oltin pastda (chapdan boshlanadi) — ko'z avval muammoni ko'radi. */}
        <Bar dataKey="vacant" stackId="a" fill={BRAND.gold} radius={[3, 0, 0, 3]} isAnimationActive={false} className="cursor-pointer">
          {data.map((d) => (
            <Cell key={d.name} onClick={() => router.push(d.vacantHref)} />
          ))}
        </Bar>
        <Bar dataKey="used" stackId="a" fill={BRAND.cobalt} radius={[0, 3, 3, 0]} isAnimationActive={false} className="cursor-pointer">
          {data.map((d) => (
            <Cell key={d.name} onClick={() => router.push(d.totalHref)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
