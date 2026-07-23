import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  Info,
  ListChecks,
  FileText,
  Tag,
  History,
  ExternalLink,
  Gavel,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import { lotUrl } from "@/server/integrations/auction";
import { requireUser } from "@/lib/authz";
import { getPropertyDetail } from "@/server/services/properties";
import { pathToCad } from "@/lib/cadastre";
import { CATEGORY_BY_CODE } from "@/lib/categories";
import { CategoryBadge, InefficientBadge, SyncStatusBadge } from "@/components/badges";
import { AssignCategoryForm } from "./AssignCategoryForm";
import { syncSingleAction } from "../actions";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value ?? "—"}</dd>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--navy)" }}>
      <Icon className="h-4 w-4" style={{ color: "var(--gold)" }} />
      {children}
    </h2>
  );
}

// catch-all: kadastr ichidagi "/" yo'l segmentlariga bo'linadi (masalan .../5030/03).
export default async function ObjectDetailPage({ params }: { params: Promise<{ cad: string[] }> }) {
  const { cad } = await params;
  const cadNumber = pathToCad(cad);
  const user = await requireUser();

  const p = await getPropertyDetail(user, cadNumber);
  if (!p) notFound();

  const canWrite =
    user.role === "SUPER_ADMIN" || (user.role === "REGION_USER" && user.regionId === p.regionId);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard/objects"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Obyektlar
          </Link>
          <h1 className="mt-1 text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
            {p.cadNumber}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SyncStatusBadge status={p.syncStatus} />
          <InefficientBadge value={p.isInefficient} />
          {canWrite ? (
            <form action={syncSingleAction}>
              <input type="hidden" name="cadNumber" value={p.cadNumber} />
              <button
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                style={{ background: "var(--cobalt)" }}
              >
                <RefreshCw className="h-4 w-4" />
                API orqali yangilash
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Asosiy ma'lumot */}
        <section className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4">
              <SectionTitle icon={Info}>Asosiy ma'lumotlar</SectionTitle>
            </div>
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Field label="Yangi kadastr" value={p.cadNumber} />
              <Field label="Eski kadastr" value={p.cadNumberOld} />
              <Field label="Hudud" value={p.region.name} />
              <Field label="Manba" value={p.source.name} />
              <Field label="Nomi" value={p.name} />
              <Field label="Manzil" value={p.address} />
              <Field label="Binoning umumiy maydoni" value={p.area ? `${p.area.toString()} m²` : null} />
              <Field label="Foydali maydon" value={p.buildingArea ? `${p.buildingArea.toString()} m²` : null} />
              <Field label="Kategoriya" value={<CategoryBadge integrationCode={p.integrationCategoryCode} manualCode={p.manualCategoryCode} />} />
            </dl>
            {p.lastSyncError ? (
              <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">Sync xatosi: {p.lastSyncError}</p>
            ) : null}
          </div>

          {/* Auksion lotlari — obyekt bir vaqtda ham xususiylashtirish, ham ijara
              savdosida bo'lishi va har biri bir nechta lotga bo'linishi mumkin. */}
          {p.auctionLots.length > 0 || p.auctionStatus ? (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <SectionTitle icon={Gavel}>Auksion lotlari ({p.auctionLots.length})</SectionTitle>
                {p.hasPrivatizationLot ? (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    Savdoda xususiylashtirish
                  </span>
                ) : null}
                {p.hasRentLot ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Savdoda ijara
                  </span>
                ) : null}
              </div>

              <dl className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <Field
                  label="Auksionga chiqarilgan maydon"
                  value={p.auctionTotalArea != null ? `${Number(p.auctionTotalArea).toLocaleString("uz")} m²` : null}
                />
                <Field label="Auksion holati" value={p.auctionStatus} />
                <Field
                  label="To'lov muddati"
                  value={p.paymentTermMonths ? `${p.paymentTermMonths} oy (bo'lib to'lash)` : null}
                />
                <Field
                  label="Tekshirilgan"
                  value={p.auctionCheckedAt ? p.auctionCheckedAt.toLocaleString("uz") : null}
                />
              </dl>

              {p.auctionLots.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Turi</th>
                        <th className="px-3 py-2 font-medium">Lot</th>
                        <th className="px-3 py-2 text-right font-medium">Maydon</th>
                        <th className="px-3 py-2 text-right font-medium">Boshlang'ich narx</th>
                        <th className="px-3 py-2 font-medium">Auksion sanasi</th>
                        <th className="px-3 py-2 font-medium">Holati</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.auctionLots.map((l) => (
                        <tr key={l.id} className="border-b border-border last:border-0 hover:bg-slate-50/60">
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                l.type === "RENT" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              {l.type === "RENT" ? "Ijara" : "Xususiylash."}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {l.lotNumber ? (
                              <a
                                href={lotUrl(l.lotNumber)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 hover:underline"
                                style={{ color: "var(--cobalt)" }}
                                title="e-auksion.uz da ochish"
                              >
                                {l.lotNumber}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              "—"
                            )}
                            {l.matchedByOldCad ? (
                              <span className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] text-amber-700">
                                eski kad.
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {l.area != null ? `${Number(l.area).toLocaleString("uz")} m²` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {l.startPrice != null ? Number(l.startPrice).toLocaleString("uz") : "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {l.auctionDate ? l.auctionDate.toLocaleString("uz") : "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{l.lotStatus ?? l.orderStatus ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Ijara shartnomalari (API 5) — bitta kadastrda bir nechta bo'lishi mumkin */}
          {p.rentContractCount != null ? (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <SectionTitle icon={KeyRound}>
                  Ijara shartnomalari ({p.rentContracts.length})
                </SectionTitle>
                {p.rentMatchedByOldCad ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Eski kadastr orqali topilgan
                  </span>
                ) : null}
              </div>

              <dl className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <Field label="Shartnomalar soni" value={p.rentContractCount} />
                <Field
                  label="Jami summa"
                  value={
                    p.rentTotalSum != null
                      ? Number(p.rentTotalSum) === 0
                        ? "0 (tekin foydalanish)"
                        : `${Number(p.rentTotalSum).toLocaleString("uz")} so'm`
                      : null
                  }
                />
                <Field
                  label="Jami maydon"
                  value={p.rentTotalArea != null ? `${Number(p.rentTotalArea).toLocaleString("uz")} m²` : null}
                />
                <Field label="Tekshirilgan" value={p.rentCheckedAt ? p.rentCheckedAt.toLocaleString("uz") : null} />
              </dl>

              {p.rentContracts.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Shartnoma</th>
                        <th className="px-3 py-2 font-medium">Sana</th>
                        <th className="px-3 py-2 text-right font-medium">Summa</th>
                        <th className="px-3 py-2 text-right font-medium">Maydon</th>
                        <th className="px-3 py-2 font-medium">Ijarachi</th>
                        <th className="px-3 py-2 font-medium">Hujjat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.rentContracts.map((c) => (
                        <tr key={c.id} className="border-b border-border last:border-0 hover:bg-slate-50/60">
                          <td className="px-3 py-2 font-medium">
                            {c.contractNumber ?? "—"}
                            {c.matchedByOldCad ? (
                              <span className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] text-amber-700">
                                eski kad.
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {c.contractDate ? c.contractDate.toLocaleDateString("uz") : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {c.contractSum != null ? Number(c.contractSum).toLocaleString("uz") : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {c.rentalArea != null ? `${Number(c.rentalArea).toLocaleString("uz")} m²` : "—"}
                          </td>
                          <td className="px-3 py-2">{c.tenantName ?? "—"}</td>
                          <td className="px-3 py-2">
                            {c.docLink ? (
                              <a
                                href={c.docLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 hover:underline"
                                style={{ color: "var(--cobalt)" }}
                              >
                                Ko'rish <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Shartnoma topilmadi.</p>
              )}
            </div>
          ) : null}

          {/* Integratsiya holat tekshiruvlari (API 3–8) */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3">
              <SectionTitle icon={ListChecks}>Integratsiya tekshiruvlari (API 3–8)</SectionTitle>
            </div>
            {p.statusChecks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Hali tekshirilmagan.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Manba</th>
                      <th className="py-2 pr-4 font-medium">Topildi</th>
                      <th className="py-2 pr-4 font-medium">Holat</th>
                      <th className="py-2 pr-4 font-medium">Eski kadastr orqali</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.statusChecks.map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-0">
                        <td className="py-2 pr-4 font-medium">{s.apiSource}</td>
                        <td className="py-2 pr-4">{s.found ? "Ha" : "Yo'q"}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{s.status ?? "—"}</td>
                        <td className="py-2 pr-4">
                          {s.matchedByOldCad ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">Fallback</span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Hujjatlar */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3">
              <SectionTitle icon={FileText}>Hujjatlar (PDF)</SectionTitle>
            </div>
            {p.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Hujjat yuklanmagan.</p>
            ) : (
              <ul className="space-y-2">
                {p.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-slate-50">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      {d.fileName}
                    </span>
                    <a
                      href={`/api/documents/${d.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                      style={{ color: "var(--cobalt)" }}
                    >
                      Ko'rish <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Kategoriya biriktirish + tarix */}
        <section className="space-y-4">
          {canWrite ? (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3">
                <SectionTitle icon={Tag}>Qo'lda kategoriya biriktirish</SectionTitle>
              </div>
              <AssignCategoryForm cadNumber={p.cadNumber} />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
              Kategoriya biriktirish uchun ushbu hudud foydalanuvchisi bo'lishingiz kerak.
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3">
              <SectionTitle icon={History}>Biriktirishlar tarixi</SectionTitle>
            </div>
            {p.assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Yo'q.</p>
            ) : (
              <ul className="space-y-3">
                {p.assignments.map((a) => (
                  <li key={a.id} className="border-b border-border pb-3 text-sm last:border-0 last:pb-0">
                    <p className="font-medium">
                      {a.categoryCode}. {CATEGORY_BY_CODE.get(a.categoryCode)?.short ?? a.category.nameUz}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.assignedBy.fullName} · {a.createdAt.toLocaleDateString("uz")}
                    </p>
                    {a.note ? <p className="mt-1 text-xs">{a.note}</p> : null}
                    {a.document ? (
                      <a href={`/api/documents/${a.document.id}`} target="_blank" rel="noreferrer" className="text-xs hover:underline" style={{ color: "var(--cobalt)" }}>
                        Hujjat: {a.document.fileName}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
