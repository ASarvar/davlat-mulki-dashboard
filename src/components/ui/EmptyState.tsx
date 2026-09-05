import type { ReactNode } from "react";

/**
 * Ma'lumot yo'qligini OCHIQ aytadigan blok.
 *
 * ⚠️ Nima uchun kerak: nol bilan to'ldirilgan grafik "hech narsa o'zgarmadi" degan
 * YOLG'ON xulosa beradi. Ma'lumot yig'ilmagan bo'lsa grafik umuman chizilmaydi.
 */
export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
}) {
  return (
    <div className="grid place-content-center justify-items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      {icon ? <div className="text-slate-400">{icon}</div> : null}
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
