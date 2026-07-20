import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Ko'rsatiladigan sahifa raqamlari: joriy sahifa atrofidagi oyna + chekkalar.
function pageWindow(page: number, pageCount: number, span = 2): (number | "…")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const pages = new Set<number>([1, pageCount]);
  for (let p = page - span; p <= page + span; p++) {
    if (p > 1 && p < pageCount) pages.add(p);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

const baseBtn =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm shadow-sm transition";
const enabled = "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
const disabled = "pointer-events-none border-slate-100 bg-slate-50 text-slate-300";

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  /** Sahifa raqamidan URL yasaydi (joriy filtrlarni saqlagan holda). */
  hrefFor: (page: number) => string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {total === 0 ? (
          "Obyekt topilmadi"
        ) : (
          <>
            <span className="font-medium text-slate-700">
              {from}–{to}
            </span>{" "}
            / jami <span className="font-medium text-slate-700">{total}</span> ta
          </>
        )}
      </p>

      {pageCount > 1 ? (
        <nav className="flex items-center gap-1" aria-label="Sahifalash">
          <Link
            href={hrefFor(1)}
            aria-label="Birinchi sahifa"
            className={cn(baseBtn, page === 1 ? disabled : enabled)}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Link>
          <Link
            href={hrefFor(page - 1)}
            aria-label="Oldingi sahifa"
            className={cn(baseBtn, page === 1 ? disabled : enabled)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>

          {pageWindow(page, pageCount).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <Link
                key={p}
                href={hrefFor(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(baseBtn, p === page ? "border-transparent text-white" : enabled)}
                style={p === page ? { background: "var(--navy)" } : undefined}
              >
                {p}
              </Link>
            ),
          )}

          <Link
            href={hrefFor(page + 1)}
            aria-label="Keyingi sahifa"
            className={cn(baseBtn, page === pageCount ? disabled : enabled)}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href={hrefFor(pageCount)}
            aria-label="Oxirgi sahifa"
            className={cn(baseBtn, page === pageCount ? disabled : enabled)}
          >
            <ChevronsRight className="h-4 w-4" />
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
