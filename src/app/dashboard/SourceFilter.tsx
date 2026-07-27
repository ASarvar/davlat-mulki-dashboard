import Link from "next/link";
import { Layers3 } from "lucide-react";

// Manba (soha) kesimi tanlagichi. Oddiy havolalar — client JS kerak emas.
// "Hammasi" = umumiy statistika, qolganlari = alohida manba bo'yicha.
export function SourceFilter({ names, current }: { names: string[]; current?: string }) {
  // Bitta manba bo'lsa tanlashning ma'nosi yo'q — ko'rsatmaymiz.
  if (names.length < 2) return null;

  const items: { label: string; value?: string }[] = [
    { label: "Hammasi" },
    ...names.map((n) => ({ label: n, value: n })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Layers3 className="h-3.5 w-3.5" />
        Manba
      </span>
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 shadow-sm">
        {items.map((it) => {
          const active = current === it.value || (!current && !it.value);
          return (
            <Link
              key={it.label}
              href={it.value ? `/dashboard?soha=${encodeURIComponent(it.value)}` : "/dashboard"}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                active ? "text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
              style={active ? { background: "var(--cobalt)" } : undefined}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
