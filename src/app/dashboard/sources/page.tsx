import { Database, AlertTriangle, Plus, Search, RotateCcw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { listSources, listSourceNames } from "@/server/services/sources";
import { CreateSourceForm, SourceRow } from "./SourceForms";

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-cobalt focus:ring-2 focus:ring-cobalt/20";

export default async function SourcesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole("SUPER_ADMIN");
  const sp = await searchParams;

  const regionId = str(sp.region) || undefined;
  const soha = str(sp.soha) || undefined;

  const [sources, regions, sohaList] = await Promise.all([
    listSources({ regionId, name: soha }),
    prisma.region.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    listSourceNames(),
  ]);

  // Seed'dagi placeholder STIR'lar — real qiymat kiritilishi kerak.
  // "300000" prefiksi bilan tekshiramiz: eski seed 10 xonali (3000000003),
  // yangisi 9 xonali (300000001) qiymat yozgan — ikkalasini ham ushlaydi.
  const placeholders = sources.filter((s) => s.stir.startsWith("300000")).length;

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
        <Database className="h-5 w-5" style={{ color: "var(--gold)" }} />
        Manbalar (STIR)
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        API 1 shu STIR'lar bo'yicha kadastr raqamlarini oladi. Har bir hudud uchun kamida bitta faol manba bo'lishi kerak.
      </p>

      {placeholders > 0 ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Diqqat:</strong> {placeholders} ta manbada seed'dan kelgan soxta STIR turibdi. Sinxronizatsiya
            ishlashi uchun real STIR'larni kiriting.
          </p>
        </div>
      ) : null}

      <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--navy)" }}>
          <Plus className="h-4 w-4" style={{ color: "var(--gold)" }} />
          Yangi manba
        </h2>
        <CreateSourceForm regions={regions} />
      </div>

      {/* Filtr: hudud va soha */}
      <form
        method="get"
        action="/dashboard/sources"
        className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-muted-foreground">Hudud</label>
          <select name="region" defaultValue={regionId ?? ""} className={`${selectCls} w-52`}>
            <option value="">Barchasi</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-muted-foreground">Soha (manba)</label>
          <select name="soha" defaultValue={soha ?? ""} className={`${selectCls} w-56`}>
            <option value="">Barchasi</option>
            {sohaList.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          style={{ background: "var(--cobalt)" }}
        >
          <Search className="h-4 w-4" />
          Filtrlash
        </button>
        <a
          href="/dashboard/sources"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <RotateCcw className="h-4 w-4" />
          Tozalash
        </a>
        <span className="ml-auto text-sm text-muted-foreground">{sources.length} ta manba</span>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Hudud</th>
              <th className="px-4 py-3 font-medium" colSpan={3}>
                Manba / STIR / holat
              </th>
              <th className="px-4 py-3 font-medium">Obyektlar</th>
            </tr>
          </thead>
          <tbody>
            {sources.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Bunday manba topilmadi.
                </td>
              </tr>
            ) : null}
            {sources.map((s) => (
              <SourceRow
                key={s.id}
                source={{
                  id: s.id,
                  name: s.name,
                  stir: s.stir,
                  isActive: s.isActive,
                  regionName: s.region.name,
                  propertyCount: s._count.properties,
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
