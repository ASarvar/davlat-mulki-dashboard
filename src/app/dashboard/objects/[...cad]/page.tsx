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
  type LucideIcon,
} from "lucide-react";
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
              <Field label="Umumiy maydon" value={p.area ? `${p.area.toString()} m²` : null} />
              <Field label="Bino maydoni" value={p.buildingArea ? `${p.buildingArea.toString()} m²` : null} />
              <Field label="Kategoriya" value={<CategoryBadge integrationCode={p.integrationCategoryCode} manualCode={p.manualCategoryCode} />} />
            </dl>
            {p.lastSyncError ? (
              <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">Sync xatosi: {p.lastSyncError}</p>
            ) : null}
          </div>

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
