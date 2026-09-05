import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Boshqaruv panelidagi asosiy ko'rsatkich kartasi.
 *
 * `accent` — chap chetdagi ingichka rangli chiziq. Rang SEMANTIK
 * (`lib/chartColors.ts` ga qarang): oltin = bo'sh turgan, ya'ni muammo.
 *
 * `href` berilsa butun karta obyektlar ro'yxatiga havola bo'ladi.
 * ⚠️ Havoladagi filtr kartadagi son bilan AYNAN bir xil mezonda bo'lishi shart —
 * bu loyihada eng ko'p uchragan xatolar sinfi (jadvaldagi son ≠ ro'yxatdagi son).
 */
export function KpiCard({
  label,
  value,
  unit,
  footer,
  accent,
  href,
}: {
  label: string;
  value: string;
  /** Qiymatdan keyingi kichik birlik ("ming m²", "mlrd so'm"). */
  unit?: string;
  footer?: ReactNode;
  accent: string;
  href?: string;
}) {
  const body = (
    <div className="relative h-full overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors">
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: accent }} />
      <p className="text-[11.5px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-bold leading-none tracking-tight" style={{ color: "var(--navy)" }}>
        {value}
        {unit ? <span className="ml-1 text-[13px] font-semibold text-muted-foreground">{unit}</span> : null}
      </p>
      {footer ? <div className="mt-2 text-[11.5px] text-muted-foreground">{footer}</div> : null}
    </div>
  );

  if (!href) return body;
  return (
    <Link href={href} className={cn("block h-full rounded-xl transition-shadow hover:shadow-md")}>
      {body}
    </Link>
  );
}

/** Karta ichidagi kichik yorliq (foiz, holat). */
export function Tag({ children, tone = "gold" }: { children: ReactNode; tone?: "gold" | "grey" }) {
  return (
    <span
      className="rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold"
      style={
        tone === "gold"
          ? { background: "var(--gold-lighter)", color: "#8a6d33" }
          : { background: "hsl(var(--muted))", color: "#475569" }
      }
    >
      {children}
    </span>
  );
}
