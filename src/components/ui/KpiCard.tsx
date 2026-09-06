import Link from "next/link";
import type { ComponentType, CSSProperties, ReactNode, SVGProps } from "react";
import { ArrowUpRight } from "lucide-react";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Boshqaruv panelidagi asosiy ko'rsatkich kartasi.
 *
 * `accent` — kartaning semantik rangi (`lib/chartColors.ts`): chap chetdagi chiziq,
 * ikonka fonи va hover holatlari shundan quriladi. Oltin = bo'sh turgan (muammo).
 * ⚠️ `accent` 6 xonali hex bo'lishi shart — hover fonlari `${accent}` + alfa bilan quriladi.
 *
 * `icon` — lucide ikonkasi (ixtiyoriy), o'ng yuqori burchakda rangli badge ichida.
 *
 * `href` berilsa butun karta obyektlar ro'yxatiga havola bo'ladi va hoverda
 * o'ng-past burchakda strelka chiqadi.
 * ⚠️ Havoladagi filtr kartadagi son bilan AYNAN bir xil mezonda bo'lishi shart —
 * bu loyihada eng ko'p uchragan xatolar sinfi (jadvaldagi son ≠ ro'yxatdagi son).
 *
 * Barcha effektlar sof CSS (`group-hover`, `transition`) — komponent server-side qoladi.
 */
export function KpiCard({
  label,
  value,
  unit,
  footer,
  accent,
  href,
  icon: Icon,
}: {
  label: string;
  value: string;
  /** Qiymatdan keyingi kichik birlik ("ming m²", "mlrd so'm"). */
  unit?: string;
  footer?: ReactNode;
  accent: string;
  href?: string;
  icon?: IconType;
}) {
  const vars = {
    "--kpi-accent": accent,
    "--kpi-shadow": `${accent}4d`, // ~30% alfa — hover soyasi
    "--kpi-tint": `${accent}14`, // ~8% alfa — ikonka foni
  } as CSSProperties;

  const body = (
    <div
      style={vars}
      className={[
        "group/kpi relative h-full overflow-hidden rounded-xl border border-border bg-card p-4",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-[color:var(--kpi-accent)]",
        "hover:shadow-[0_10px_24px_-12px_var(--kpi-shadow)]",
      ].join(" ")}
    >
      {/* chap chetdagi rangli chiziq — hoverda kengayadi */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] transition-all duration-200 ease-out group-hover/kpi:w-1.5"
        style={{ background: accent }}
      />
      {/* burchakdagi yumshoq nur — hoverda bilinar-bilinmas yonadi */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-300 ease-out group-hover/kpi:opacity-[0.09]"
        style={{ background: accent }}
      />

      <div className="relative flex items-start justify-between gap-2">
        <p className="pt-0.5 text-[11.5px] font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-lg transition-transform duration-200 ease-out group-hover/kpi:scale-110 group-hover/kpi:-rotate-3"
            style={{ background: "var(--kpi-tint)", color: accent }}
          >
            <Icon className="size-[18px]" />
          </span>
        ) : null}
      </div>

      <p
        className="relative mt-2 text-2xl font-bold leading-none tracking-tight"
        style={{ color: "var(--navy)" }}
      >
        {value}
        {unit ? (
          <span className="ml-1 text-[13px] font-semibold text-muted-foreground">{unit}</span>
        ) : null}
      </p>

      {footer ? <div className="relative mt-2 text-[11.5px] text-muted-foreground">{footer}</div> : null}

      {href ? (
        <ArrowUpRight
          aria-hidden
          className="absolute bottom-3 right-3 size-4 translate-x-1 opacity-0 transition-all duration-200 ease-out group-hover/kpi:translate-x-0 group-hover/kpi:opacity-100"
          style={{ color: accent }}
        />
      ) : null}
    </div>
  );

  if (!href) return body;
  return (
    <Link
      href={href}
      style={vars}
      className="block h-full rounded-xl outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[color:var(--kpi-accent)] focus-visible:ring-offset-2"
    >
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
