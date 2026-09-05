import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Oq fon + yengil ramka — boshqaruv panelidagi barcha bloklar shu qobiqda. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card", className)}>{children}</div>
  );
}

/**
 * Sarlavhali blok (grafik, jadval, xarita). `action` — o'ng chetdagi boshqaruv
 * (rejim tugmalari, "Batafsil" havolasi).
 */
export function ChartCard({
  title,
  subtitle,
  action,
  footnote,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Grafik ostidagi izoh — ma'lumotning cheklovini ochiq aytish uchun. */
  footnote?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("p-4 md:p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold" style={{ color: "var(--navy)" }}>
            {title}
          </h3>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
      {footnote ? (
        <p className="mt-3 border-t border-dashed border-border pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
          {footnote}
        </p>
      ) : null}
    </Card>
  );
}
