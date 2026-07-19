"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DashboardResponse } from "@/lib/types";

export default function DataMatrix({ data }: { data: DashboardResponse }) {
  const [regionFilter, setRegionFilter] = useState<string>("all");

  const regions = useMemo(
    () =>
      regionFilter === "all"
        ? data.regions
        : data.regions.filter((r) => r.id === regionFilter),
    [data.regions, regionFilter]
  );

  const cellMap = useMemo(() => {
    const map = new Map<string, DashboardResponse["cells"][number]>();
    for (const c of data.cells) {
      map.set(`${c.regionId}__${c.categoryId}`, c);
    }
    return map;
  }, [data.cells]);

  const columnTotal = (categoryId: string) =>
    data.cells
      .filter((c) => c.categoryId === categoryId)
      .reduce((acc, c) => acc + c.count, 0);

  const rowTotal = (regionId: string) =>
    data.cells
      .filter((c) => c.regionId === regionId)
      .reduce((acc, c) => acc + c.count, 0);

  const grandTotal = data.cells.reduce((acc, c) => acc + c.count, 0);

  return (
    <div className="rounded-xl border border-border bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">
            Hududlar va kategoriyalar bo'yicha reestr
          </h2>
          <p className="text-xs text-muted">
            Obyektlar soni, {data.year}-yil holatiga ko'ra
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-teal" /> Integratsiya
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber" /> Qo'lda
            </span>
          </div>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-navy"
          >
            <option value="all">Barcha hududlar</option>
            {data.regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-h-[640px] overflow-auto">
        <table className="ledger-table w-full text-sm">
          <thead>
            <tr>
              <th className="region-col-head px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                Hudud
              </th>
              {data.categories.map((cat) => (
                <th
                  key={cat.id}
                  className={`px-4 py-3 text-right text-xs font-semibold text-ink ${
                    cat.isIntegration ? "bg-teal-light/50" : "bg-amber-light/60"
                  }`}
                  title={cat.name}
                >
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[11px] text-muted">
                      {cat.order}.
                    </span>
                    <span className="max-w-[130px] whitespace-normal text-right leading-tight">
                      {cat.name}
                    </span>
                  </div>
                </th>
              ))}
              <th className="bg-navy/5 px-4 py-3 text-right text-xs font-semibold text-ink">
                Jami
              </th>
            </tr>
          </thead>
          <tbody>
            {regions.map((region) => (
              <tr key={region.id} className="hover:bg-bg/60">
                <th className="region-col px-4 py-3 text-left text-sm font-medium text-ink">
                  {region.name}
                </th>
                {data.categories.map((cat) => {
                  const cell = cellMap.get(`${region.id}__${cat.id}`);
                  const count = cell?.count ?? 0;
                  if (cat.isIntegration) {
                    return (
                      <td
                        key={cat.id}
                        className="px-4 py-3 text-right tabular-figures text-ink"
                      >
                        {count.toLocaleString("uz-UZ")}
                      </td>
                    );
                  }
                  return (
                    <td key={cat.id} className="px-4 py-3 text-right">
                      <Link
                        href={`/kiritish?region=${region.id}&category=${cat.id}`}
                        className="group inline-flex items-center gap-1.5 tabular-figures text-ink hover:text-amber"
                        title="Tahrirlash uchun bosing"
                      >
                        {count.toLocaleString("uz-UZ")}
                        {count > 0 && !cell?.fileUrl ? (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-amber"
                            title="Asos fayli biriktirilmagan"
                          />
                        ) : null}
                      </Link>
                    </td>
                  );
                })}
                <th className="bg-navy/5 px-4 py-3 text-right tabular-figures text-ink">
                  {rowTotal(region.id).toLocaleString("uz-UZ")}
                </th>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th className="region-col px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                Jami (barcha hududlar)
              </th>
              {data.categories.map((cat) => (
                <td
                  key={cat.id}
                  className="px-4 py-3 text-right font-semibold tabular-figures text-ink"
                >
                  {columnTotal(cat.id).toLocaleString("uz-UZ")}
                </td>
              ))}
              <th className="bg-navy/10 px-4 py-3 text-right font-semibold tabular-figures text-ink">
                {grandTotal.toLocaleString("uz-UZ")}
              </th>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="border-t border-border px-5 py-3 text-xs text-muted">
        Amber nuqta — soni kiritilgan, lekin asos fayli hali biriktirilmagan
        yozuvlarni bildiradi. Qo'lda kiritiladigan katakka bosib, ma'lumotni
        tahrirlashingiz mumkin.
      </div>
    </div>
  );
}
