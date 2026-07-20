import Link from "next/link";
import {
  Building2,
  TrendingDown,
  Percent,
  CheckCircle2,
  Clock3,
  XCircle,
  RefreshCw,
  MapPin,
  Tags,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { getDashboardStats } from "@/server/services/stats";
import { CATEGORY_BY_CODE } from "@/lib/categories";
import { SyncRunStatusBadge } from "@/components/badges";

type Tone = "navy" | "gold" | "green" | "amber" | "red" | "cobalt";

const TONES: Record<Tone, { bg: string; color: string }> = {
  navy: { bg: "rgba(7,16,43,0.06)", color: "var(--navy)" },
  cobalt: { bg: "rgba(26,58,124,0.10)", color: "var(--cobalt)" },
  gold: { bg: "rgba(200,169,110,0.18)", color: "#8a6d34" },
  green: { bg: "rgba(16,185,129,0.12)", color: "#047857" },
  amber: { bg: "rgba(245,158,11,0.12)", color: "#b45309" },
  red: { bg: "rgba(239,68,68,0.10)", color: "#b91c1c" },
};

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone: Tone;
  href?: string;
}) {
  const t = TONES[tone];
  const card = (
    <div className="group h-full rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
            {value}
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: t.bg }}>
          <Icon className="h-5 w-5" style={{ color: t.color }} />
        </div>
      </div>
      {href ? (
        <p className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          Batafsil <ArrowUpRight className="h-3 w-3" />
        </p>
      ) : null}
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--navy)" }}>
      <Icon className="h-4 w-4" style={{ color: "var(--gold)" }} />
      {children}
    </h2>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();

  // Aggregatlar keshlangan (tag: dashboard, TTL 60s). Oxirgi run — jonli.
  const [s, latestRun] = await Promise.all([
    getDashboardStats(),
    prisma.syncRun.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
            Boshqaruv paneli
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Davlat mulki obyektlari bo'yicha umumiy holat</p>
        </div>
        {user.role !== "VIEWER" ? (
          <Link
            href="/dashboard/sync"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ background: "var(--cobalt)" }}
          >
            <RefreshCw className="h-4 w-4" />
            Sinxronizatsiya
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Jami obyektlar" value={s.total} icon={Building2} tone="navy" href="/dashboard/objects" />
        <StatCard label="Samarasiz" value={s.inefficient} icon={TrendingDown} tone="gold" href="/dashboard/objects?inefficient=1" />
        <StatCard label="Samarasiz ulushi" value={`${pct(s.inefficient, s.total)}%`} icon={Percent} tone="cobalt" />
        <StatCard label="Sinxronlangan" value={s.synced} icon={CheckCircle2} tone="green" />
        <StatCard label="Kutilmoqda" value={s.pending} icon={Clock3} tone="amber" />
        <StatCard label="Xato" value={s.failed} icon={XCircle} tone="red" />
      </div>

      {latestRun ? (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm shadow-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(26,58,124,0.10)" }}>
            <RefreshCw className="h-4 w-4" style={{ color: "var(--cobalt)" }} />
          </span>
          <span className="font-medium" style={{ color: "var(--navy)" }}>
            Oxirgi sinxronizatsiya
          </span>
          <SyncRunStatusBadge status={latestRun.status} />
          <span className="text-muted-foreground">
            {latestRun.successCount + latestRun.failCount} / {latestRun.totalCount} · xato {latestRun.failCount} ·{" "}
            {latestRun.createdAt.toLocaleString("uz")}
          </span>
          <Link href="/dashboard/sync" className="ml-auto inline-flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: "var(--cobalt)" }}>
            Batafsil <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Hududlar kesimi */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle icon={MapPin}>Hududlar kesimi</SectionTitle>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Hudud</th>
                  <th className="py-2 pr-4 font-medium">Jami</th>
                  <th className="py-2 pr-4 font-medium">Samarasiz</th>
                  <th className="py-2 font-medium">Ulush</th>
                </tr>
              </thead>
              <tbody>
                {s.byRegion.map((r) => (
                  <tr key={r.regionId} className="border-b border-border last:border-0 hover:bg-slate-50/70">
                    <td className="py-2.5 pr-4">
                      <Link href={`/dashboard/objects?region=${r.regionId}`} className="font-medium hover:underline" style={{ color: "var(--cobalt)" }}>
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums">{r.total}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{r.inefficient}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full" style={{ width: `${pct(r.inefficient, r.total)}%`, background: "var(--gold)" }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{pct(r.inefficient, r.total)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Kategoriyalar kesimi */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4">
            <SectionTitle icon={Tags}>Kategoriyalar kesimi (effektiv)</SectionTitle>
          </div>
          <ul className="space-y-1">
            {s.byCategory.map((c) => {
              const meta = c.code != null ? CATEGORY_BY_CODE.get(c.code) : null;
              return (
                <li
                  key={c.code ?? "none"}
                  className="flex items-center justify-between rounded-lg px-2 py-2 text-sm transition-colors hover:bg-slate-50"
                >
                  <span className={c.code == null ? "text-muted-foreground" : ""}>
                    {c.code != null ? `${c.code}. ${meta?.short ?? "—"}` : "Kategoriyasiz"}
                    {meta && !meta.excludeInefficient ? (
                      <span className="ml-2 rounded-full bg-red-50 px-1.5 py-0.5 text-xs text-red-700">samarasiz</span>
                    ) : null}
                  </span>
                  <span className="font-semibold tabular-nums" style={{ color: "var(--navy)" }}>
                    {c.count}
                  </span>
                </li>
              );
            })}
            {s.byCategory.length === 0 ? <li className="px-2 text-sm text-muted-foreground">Ma'lumot yo'q.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
