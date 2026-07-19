import { DashboardResponse } from "@/lib/types";

function sum(cells: DashboardResponse["cells"], filter: (c: DashboardResponse["cells"][number]) => boolean) {
  return cells.filter(filter).reduce((acc, c) => acc + c.count, 0);
}

export default function SummaryCards({ data }: { data: DashboardResponse }) {
  const total = sum(data.cells, () => true);
  const integrationTotal = sum(data.cells, (c) => c.source === "integration");
  const manualTotal = sum(data.cells, (c) => c.source === "manual");
  const manualCells = data.cells.filter((c) => c.source === "manual");
  const missingFiles = manualCells.filter(
    (c) => c.count > 0 && !c.fileUrl
  ).length;

  const cards = [
    {
      label: "Jami obyektlar soni",
      value: total,
      hint: `${data.regions.length} ta hudud, ${data.categories.length} ta kategoriya`,
      accent: "border-navy/20",
    },
    {
      label: "Integratsiya orqali (avtomatik)",
      value: integrationTotal,
      hint: "1–5 kategoriyalar, API orqali",
      accent: "border-teal/30 bg-teal-light/40",
    },
    {
      label: "Qo'lda kiritilgan",
      value: manualTotal,
      hint: "6–10 kategoriyalar, asos fayl bilan",
      accent: "border-amber/30 bg-amber-light/50",
    },
    {
      label: "Asos fayli biriktirilmagan",
      value: missingFiles,
      hint: "Soni > 0, lekin fayl yo'q yozuvlar",
      accent: missingFiles > 0 ? "border-amber/40 bg-amber-light/60" : "border-border",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-xl border bg-surface p-4 shadow-card ${c.accent}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {c.label}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-figures text-ink">
            {c.value.toLocaleString("uz-UZ")}
          </p>
          <p className="mt-1 text-xs text-muted">{c.hint}</p>
        </div>
      ))}
    </div>
  );
}
