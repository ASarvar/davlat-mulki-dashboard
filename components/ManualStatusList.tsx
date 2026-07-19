import Link from "next/link";
import { DashboardResponse } from "@/lib/types";

export default function ManualStatusList({
  data,
  regionId,
  activeCategoryId,
}: {
  data: DashboardResponse;
  regionId: string;
  activeCategoryId: string;
}) {
  const region = data.regions.find((r) => r.id === regionId);
  const manualCells = data.cells.filter(
    (c) => c.source === "manual" && c.regionId === regionId
  );
  const categoriesById = new Map(data.categories.map((c) => [c.id, c]));

  return (
    <div className="rounded-xl border border-border bg-surface shadow-card">
      <div className="border-b border-border px-5 py-3">
        <h3 className="font-display text-sm font-semibold text-ink">
          {region?.name} — qo'lda kiritiladigan kategoriyalar holati
        </h3>
      </div>
      <ul className="divide-y divide-border">
        {manualCells
          .sort(
            (a, b) =>
              (categoriesById.get(a.categoryId)?.order ?? 0) -
              (categoriesById.get(b.categoryId)?.order ?? 0)
          )
          .map((cell) => {
            const category = categoriesById.get(cell.categoryId);
            if (!category) return null;
            const isActive = category.id === activeCategoryId;
            return (
              <li key={cell.categoryId}>
                <Link
                  href={`/kiritish?region=${regionId}&category=${category.id}`}
                  className={`flex items-center justify-between px-5 py-3 text-sm transition hover:bg-bg ${
                    isActive ? "bg-amber-light/40" : ""
                  }`}
                >
                  <span className="text-ink">
                    <span className="mr-2 text-xs text-muted">
                      {category.order}.
                    </span>
                    {category.name}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-figures font-medium text-ink">
                      {cell.count.toLocaleString("uz-UZ")}
                    </span>
                    {cell.fileUrl ? (
                      <span className="rounded-full bg-teal-light px-2 py-0.5 text-xs font-medium text-teal">
                        Fayl bor
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-light px-2 py-0.5 text-xs font-medium text-amber">
                        Fayl yo'q
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
