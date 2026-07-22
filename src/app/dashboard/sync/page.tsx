import { RefreshCw, History, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { getPendingJobCounts, getQueueHealth } from "@/server/services/syncAdmin";
import { SyncRunStatusBadge } from "@/components/badges";
import { SyncControls } from "./SyncControls";
import { AutoRefresh } from "./AutoRefresh";

const RUN_TYPE_LABEL: Record<string, string> = {
  FULL_ALL: "To'liq",
  REGION: "Hudud",
  SINGLE: "Bitta kadastr",
};

export default async function SyncPage() {
  const user = await requireUser();

  const [regions, runs] = await Promise.all([
    prisma.region.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.syncRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { triggeredBy: { select: { fullName: true } } },
    }),
  ]);

  const regionName = new Map(regions.map((r) => [r.id, r.name]));
  const hasActive = runs.some((r) => r.status === "QUEUED" || r.status === "RUNNING");

  // Navbat holati (pg-boss). Redis yo'q — hisob to'g'ridan-to'g'ri Postgres'dan.
  const pending = await getPendingJobCounts().catch(() => ({}) as Record<string, number>);
  const pendingJobs = Object.values(pending).reduce((a, b) => a + b, 0);
  const health = await getQueueHealth().catch(() => null);

  return (
    <div>
      {/* Faol run bo'lsa YOKI joblar osilib qolgan bo'lsa yangilab turamiz */}
      <AutoRefresh enabled={hasActive || (health?.pending ?? 0) > 0} />

      <h1 className="mb-1 flex items-center gap-2 text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
        <RefreshCw className="h-5 w-5" style={{ color: "var(--gold)" }} />
        Sinxronizatsiya
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Tashqi API'lardan ma'lumot yig'ish fon rejimida (pg-boss) bajariladi — sahifani yopsangiz ham davom etadi.
      </p>

      {health?.workerLikelyDown ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Worker ishlamayapti — sinxronizatsiya boshlanmaydi</p>
            <p className="mt-1">
              Navbatda <strong>{health.pending}</strong> ta job{" "}
              {health.oldestPendingSec != null ? `${health.oldestPendingSec} soniyadan beri` : ""} kutmoqda, lekin uni
              bajaradigan jarayon yo'q. Tugma bosilganda ish navbatga qo'yiladi, ammo faqat worker uni bajaradi.
            </p>
            <p className="mt-2">
              Serverda alohida terminalda ishga tushiring:{" "}
              <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs">npm run worker</code>
            </p>
          </div>
        </div>
      ) : null}

      {user.role !== "VIEWER" ? (
        <div className="mb-6">
          <SyncControls
            regions={regions}
            canFullSync={user.role === "SUPER_ADMIN"}
            lockedRegionId={user.role === "REGION_USER" ? user.regionId : null}
            pendingJobs={pendingJobs}
          />
        </div>
      ) : null}

      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--navy)" }}>
        <History className="h-4 w-4" style={{ color: "var(--gold)" }} />
        Sinxronizatsiya tarixi
        {hasActive ? (
          <span className="ml-1 inline-flex items-center gap-1.5 text-xs font-normal text-amber-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            jonli yangilanmoqda
          </span>
        ) : null}
      </h2>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Turi</th>
              <th className="px-4 py-3 font-medium">Hudud</th>
              <th className="px-4 py-3 font-medium">Holat</th>
              <th className="px-4 py-3 font-medium">Jarayon</th>
              <th className="px-4 py-3 font-medium">Kim</th>
              <th className="px-4 py-3 font-medium">Vaqt</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Hali sinxronizatsiya boshlanmagan.
                </td>
              </tr>
            ) : (
              runs.map((r) => {
                const done = r.successCount + r.failCount;
                const pct = r.totalCount > 0 ? Math.min(100, Math.round((done / r.totalCount) * 100)) : 0;
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{RUN_TYPE_LABEL[r.type] ?? r.type}</td>
                    <td className="px-4 py-3">{r.regionId ? (regionName.get(r.regionId) ?? "—") : "Barchasi"}</td>
                    <td className="px-4 py-3">
                      <SyncRunStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="mb-1 h-1.5 w-40 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: "var(--cobalt)" }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {done} / {r.totalCount} · muvaffaqiyatli {r.successCount}, xato {r.failCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.triggeredBy?.fullName ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.createdAt.toLocaleString("uz")}
                      {r.finishedAt ? <br /> : null}
                      {r.finishedAt ? `tugadi: ${r.finishedAt.toLocaleTimeString("uz")}` : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
