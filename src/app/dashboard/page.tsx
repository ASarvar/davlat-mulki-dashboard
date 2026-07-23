import { Fragment } from "react";
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
  Download,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { getDashboardStats, buildDashboardColumns, type DashboardColumnSub } from "@/server/services/stats";
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
  // Rasmiy hisobot shakli: mingliklar ajratilgan, kerak bo'lsa o'nlik bilan.
  const nf = (n: number, digits = 0) =>
    n.toLocaleString("uz-UZ", { minimumFractionDigits: digits, maximumFractionDigits: digits });

  // 5 (Tekin foydalanish), 6 (Ijara shartnomasi bor) va 12 (Bo'sh maydoni bor) ustunlari
  // EFFEKTIV kategoriyadan emas, ijara XUSUSIYATIDAN hisoblanadi: obyekt sotilgan yoki
  // savdoda bo'lsa ham, ijara shartnomasi bo'lsa shu ustunda ko'rinadi.
  /** Maydonni ming m² da ko'rsatamiz (hisobot shakli shunday). */
  const km = (m2: number) => nf(m2 / 1000, 1);

  // Ustun tuzilishi markazlashtirilgan (stats.ts) — UI va Excel eksporti bir xil
  // mantiqni ishlatadi, aks holda ikkisi orasida tafovut paydo bo'lishi mumkin.
  const COLUMNS = buildDashboardColumns();

  // JAMI qatori — hududlar yig'indisi (har bir kichik ustun uchun alohida).
  const totalObjects = s.byRegionCategory.reduce((a, r) => a + r.total, 0);
  const sumSub = (sub: DashboardColumnSub) => s.byRegionCategory.reduce((a, r) => a + sub.get(r), 0);

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
        <StatCard label="Bo'sh turgan" value={s.inefficient} icon={TrendingDown} tone="gold" href="/dashboard/objects?inefficient=1" />
        {/* <StatCard label="Bo'sh turgan ulushi" value={`${pct(s.inefficient, s.total)}%`} icon={Percent} tone="cobalt" /> */}
        <StatCard label="Sinxronlangan" value={s.synced} icon={CheckCircle2} tone="green" />
        {/* <StatCard label="Kutilmoqda" value={s.pending} icon={Clock3} tone="amber" /> */}
        <StatCard label="Xato" value={s.failed} icon={XCircle} tone="red" />
      </div>

      {/* Kategoriyalar kesimi — hududlar bo'yicha (JAMI yuqorida) */}
      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon={Tags}>Davlat obyektlaridan foydalanish markazi balansidagi obyektlar</SectionTitle>
          <a
            href="/api/export/dashboard-categories"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-slate-50 hover:text-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            Excelga eksport
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {/* 1-qator: kategoriya nomlari (kengaytirilganlari colSpan bilan) */}
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="sticky left-0 z-10 bg-card py-2 pr-3 font-bold" rowSpan={2}>№</th>
                <th className="sticky left-8 z-10 bg-card py-2 pr-4 font-bold" rowSpan={2}>Hududlar nomi</th>
                <th className="py-2  px-4 text-center font-bold" rowSpan={2}>Jami</th>
                {COLUMNS.map((c) => (
                  <Fragment key={c.code}>
                    <th
                      colSpan={c.subs.length}
                      title={`${c.code}. ${c.nameUz}`}
                      className="border-l border-border px-2 py-2 text-center align-bottom font-bold"
                    >
                      <span className="block text-[12px] font-medium normal-case leading-tight">{c.short}</span>
                    </th>
                    {c.code === 4 ? (
                      <th
                        className="border-l border-border px-2 py-2 text-center align-bottom font-bold"
                        rowSpan={2}
                        title="Bir vaqtda ham xususiylashtirish, ham ijara savdosida turgan obyektlar"
                      >
                        <span className="block text-[12px] font-medium normal-case leading-tight">Auksion savdolarida (Xususiy. va Ijara)</span>
                      </th>
                    ) : null}
                    {c.code === 6 ? (
                      <th
                        className="border-l border-border px-2 py-2 text-center align-bottom font-bold"
                        rowSpan={2}
                        title="Tekin foydalanish yoki Ijara shartnomasi bor kategoriyalaridan biriga tegishli obyektlar"
                      >
                        <span className="block text-[12px] font-medium normal-case leading-tight">Ijaraga berilgan obyektlar (Sotilgan / Savdodagilardan tashqari)</span>
                      </th>
                    ) : null}
                  </Fragment>
                ))}
                <th
                  className="border-l border-border px-2 py-2 text-center align-bottom font-bold"
                  rowSpan={2}
                  title="Ijara shartnomasi bor (tekin foydalanish yoki pullik) VA foydali maydon to'liq band"
                >
                  <span className="block text-[12px] font-medium normal-case leading-tight">To'liq ijara berilgan</span>
                </th>
              </tr>
              {/* 2-qator: kichik ustunlar */}
              <tr className="border-b border-border text-left text-[10px] text-muted-foreground">
                {COLUMNS.map((c) =>
                  c.subs.map((sub, si) => (
                    <th
                      key={`${c.code}-${sub.label}`}
                      className={`px-2 py-1 text-center font-normal ${si === 0 ? "border-l border-border" : ""}`}
                    >
                      {c.subs.length > 1 ? sub.label : ""}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {/* JAMI — birinchi qator */}
              <tr className="border-b-2 font-bold" style={{ background: "rgba(200,169,110,0.14)", borderColor: "var(--gold)" }}>
                <td className="sticky left-0 z-10 py-3 pr-3" style={{ background: "#f7f1e4" }} />
                <td className="sticky left-8 z-10 py-3 pr-4" style={{ background: "#f7f1e4", color: "#b91c1c" }}>
                  J A M I:
                </td>
                <td className="py-3 text-center tabular-nums" style={{ color: "#b91c1c" }}>{nf(totalObjects)}</td>
                {COLUMNS.map((c) => (
                  <Fragment key={c.code}>
                    {c.subs.map((sub, si) => (
                      <td
                        key={`${c.code}-${sub.label}`}
                        className={`px-2 py-3 text-center tabular-nums ${si === 0 ? "border-l border-border" : ""}`}
                        style={{ color: "#b91c1c" }}
                      >
                        {sub.area ? km(sumSub(sub)) : nf(sumSub(sub))}
                      </td>
                    ))}
                    {c.code === 4 ? (
                      <td className="border-l border-border px-2 py-3 text-center tabular-nums" style={{ color: "#b91c1c" }}>
                        {nf(s.byRegionCategory.reduce((a, r) => a + r.rentBreakdown.bothAuctions.count, 0))}
                      </td>
                    ) : null}
                    {c.code === 6 ? (
                      <td className="border-l border-border px-2 py-3 text-center tabular-nums" style={{ color: "#b91c1c" }}>
                        {nf(s.byRegionCategory.reduce((a, r) => a + r.rentBreakdown.onlyFreeOrPaidCategory.count, 0))}
                      </td>
                    ) : null}
                  </Fragment>
                ))}
                <td className="border-l border-border px-2 py-3 text-center tabular-nums" style={{ color: "#b91c1c" }}>
                  {nf(s.byRegionCategory.reduce((a, r) => a + r.rentBreakdown.fullyRented.count, 0))}
                </td>
              </tr>

              {s.byRegionCategory.map((r, i) => (
                <tr key={r.regionId} className="group border-b border-border last:border-0 hover:bg-slate-50/70">
                  <td className="sticky left-0 z-10 bg-card py-2.5 pr-3 tabular-nums text-muted-foreground group-hover:bg-slate-50">
                    {i + 1}
                  </td>
                  <td className="sticky left-4 right-4 z-10 bg-card py-2.5 pr-4 whitespace-nowrap group-hover:bg-slate-50">
                    <Link href={`/dashboard/objects?region=${r.regionId}`} className="font-medium hover:underline" style={{ color: "var(--cobalt)" }}>
                      {r.name}
                    </Link>
                  </td>
                  <td className="py-2.5 text-center font-semibold tabular-nums">{nf(r.total)}</td>
                  {COLUMNS.map((c) => (
                    <Fragment key={c.code}>
                      {c.subs.map((sub, si) => {
                        const v = sub.get(r);
                        const cls = `px-2 py-2.5 text-center tabular-nums ${si === 0 ? "border-l border-border" : ""}`;
                        if (v === 0) {
                          return (
                            <td key={`${c.code}-${sub.label}`} className={cls}>
                              <span className="text-slate-300">0</span>
                            </td>
                          );
                        }
                        // Faqat "Soni" katagi ro'yxatga havola bo'ladi.
                        return (
                          <td key={`${c.code}-${sub.label}`} className={cls}>
                            {sub.area ? (
                              <span className="text-muted-foreground">{km(v)}</span>
                            ) : (
                              <Link
                                href={`/dashboard/objects?region=${r.regionId}&category=${c.code}`}
                                className="hover:underline"
                                style={{ color: "var(--cobalt)" }}
                              >
                                {nf(v)}
                              </Link>
                            )}
                          </td>
                        );
                      })}
                      {c.code === 4 ? (
                        <td className="border-l border-border px-2 py-2.5 text-center tabular-nums">
                          {r.rentBreakdown.bothAuctions.count === 0 ? (
                            <span className="text-slate-300">0</span>
                          ) : (
                            <Link
                              href={`/dashboard/objects?region=${r.regionId}&bothAuctions=1`}
                              className="hover:underline"
                              style={{ color: "var(--cobalt)" }}
                            >
                              {nf(r.rentBreakdown.bothAuctions.count)}
                            </Link>
                          )}
                        </td>
                      ) : null}
                      {c.code === 6 ? (
                        <td className="border-l border-border px-2 py-2.5 text-center tabular-nums">
                          {r.rentBreakdown.onlyFreeOrPaidCategory.count === 0 ? (
                            <span className="text-slate-300">0</span>
                          ) : (
                            <Link
                              href={`/dashboard/objects?region=${r.regionId}&hasRentContract=1`}
                              className="hover:underline"
                              style={{ color: "var(--cobalt)" }}
                            >
                              {nf(r.rentBreakdown.onlyFreeOrPaidCategory.count)}
                            </Link>
                          )}
                        </td>
                      ) : null}
                    </Fragment>
                  ))}
                  <td className="border-l border-border px-2 py-2.5 text-center tabular-nums">
                    {r.rentBreakdown.fullyRented.count === 0 ? (
                      <span className="text-slate-300">0</span>
                    ) : (
                      <Link
                        href={`/dashboard/objects?region=${r.regionId}&fullyRented=1`}
                        className="hover:underline"
                        style={{ color: "var(--cobalt)" }}
                      >
                        {nf(r.rentBreakdown.fullyRented.count)}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Maydonlar <strong>ming m²</strong>da, "Soni" — obyektlar soni (bosilsa ro'yxat ochiladi).
          To'liq kategoriya nomini ko'rish uchun sarlavha ustiga bosing.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          <strong>Tekin foydalanish</strong>, <strong>Ijara shartnomasi bor</strong> va{" "}
          <strong>Bo'sh maydoni bor</strong> ustunlari obyektning asosiy kategoriyasidan qat'i nazar
          hisoblanadi (sotilgan yoki savdodagi obyekt ham ijara shartnomasiga ega bo'lishi mumkin) —
          shuning uchun ustunlar yig'indisi "Jami"dan katta bo'lishi mumkin.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          <strong>To'liq ijara berilgan</strong> — ijara shartnomasi bor (tekin foydalanish yoki pullik,
          ikkisidan biri yoki ikkisi birga) va foydali maydonning to'liq band qismi (bo'sh joy qolmagan).
        </p>
        {/* <p className="mt-1 text-xs text-muted-foreground">
          <strong>Ijaraga berilgan obyektlar</strong> (Ijara shartnomasi bor ustunidan keyin) —{" "}
          <strong>Tekin foydalanish</strong> yoki <strong>Ijara shartnomasi bor</strong> kategoriyalaridan
          biriga tegishli obyektlar soni (ikkalasi bir-birini istisno qiladi).
        </p> */}
        <p className="mt-1 text-xs text-muted-foreground">
          <strong>Auksion savdolarida</strong> — bir vaqtda ham{" "}
          <strong>Savdoda xususiylashtirish</strong>, ham <strong>Savdoda ijara</strong> savdosida
          turgan obyektlar soni.
        </p>
      </section>


      {/* Hududlar kesimi — rasmiy hisobot shakli (JAMI yuqorida) */}
      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon={MapPin}>Hududlar kesimi — ijara shartnomalari</SectionTitle>
          <a
            href="/api/export/dashboard-rent"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-slate-50 hover:text-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            Excelga eksport
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">№</th>
                <th className="py-2 pr-4 font-medium">Hududlar nomi</th>
                <th className="py-2 pr-4 text-right font-medium">
                  Obyektlar soni
                  <span className="block text-[10px] font-normal normal-case">(Kadastr agentligi)</span>
                </th>
                <th className="py-2 pr-4 text-right font-medium">
                  Obyekt soni
                  <span className="block text-[10px] font-normal normal-case">(ijaraga berilgan)</span>
                </th>
                {/* <th className="py-2 pr-4 text-right font-medium">Ijaraga berilishi (%)</th> */}
                <th className="py-2 pr-4 text-right font-medium">Shartnoma soni</th>
                <th className="py-2 pr-4 text-right font-medium">Maydoni (kv.m)</th>
                <th className="py-2 text-right font-medium">Yillik ijara summasi</th>
              </tr>
            </thead>
            <tbody>
              {/* JAMI — birinchi qator */}
              <tr className="border-b-2 font-bold" style={{ background: "rgba(200,169,110,0.14)", borderColor: "var(--gold)" }}>
                <td className="py-3 pr-3" />
                <td className="py-3 pr-4" style={{ color: "#b91c1c" }}>
                  J A M I:
                </td>
                <td className="py-3 pr-4 text-right tabular-nums" style={{ color: "#b91c1c" }}>{nf(s.totals.total)}</td>
                <td className="py-3 pr-4 text-right tabular-nums" style={{ color: "#b91c1c" }}>{nf(s.totals.rentedObjects)}</td>
                {/* <td className="py-3 pr-4 text-right tabular-nums" style={{ color: "#b91c1c" }}>{s.totals.rentedPct}</td> */}
                <td className="py-3 pr-4 text-right tabular-nums" style={{ color: "#b91c1c" }}>{nf(s.totals.contractCount)}</td>
                <td className="py-3 pr-4 text-right tabular-nums" style={{ color: "#b91c1c" }}>{nf(s.totals.rentArea, 1)}</td>
                <td className="py-3 text-right tabular-nums" style={{ color: "#b91c1c" }}>{nf(s.totals.rentSum / 1_000_000, 1)}</td>
              </tr>

              {s.byRegion.map((r, i) => (
                <tr key={r.regionId} className="border-b border-border last:border-0 hover:bg-slate-50/70">
                  <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="py-2.5 pr-4">
                    <Link href={`/dashboard/objects?region=${r.regionId}`} className="font-medium hover:underline" style={{ color: "var(--cobalt)" }}>
                      {r.name}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{nf(r.total)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{nf(r.rentedObjects)}</td>
                  {/* <td className="py-2.5 pr-4 text-right tabular-nums">{r.rentedPct}</td> */}
                  <td className="py-2.5 pr-4 text-right tabular-nums">{nf(r.contractCount)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{nf(r.rentArea, 1)}</td>
                  <td className="py-2.5 text-right tabular-nums">{nf(r.rentSum / 1_000_000, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Yillik ijara summasi — <strong>mln so'm</strong>da. Maydon — kv.m.
        </p>
      </section>
    </div>
  );
}
