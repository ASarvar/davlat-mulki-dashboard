import { Search, RotateCcw } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-cobalt focus:ring-2 focus:ring-cobalt/20";

// Server-rendered GET form — submit qilinganda URL searchParams yangilanadi (client JS shart emas).
export function ObjectFilters({
  regions,
  sohaList,
  canFilterRegion,
  current,
}: {
  regions: { id: string; name: string }[];
  sohaList: string[];
  canFilterRegion: boolean;
  current: { q?: string; region?: string; soha?: string; category?: string; inefficient?: string };
}) {
  return (
    <form
      method="get"
      action="/dashboard/objects"
      className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-col">
        <label className="mb-1 text-xs font-medium text-muted-foreground">Kadastr (yangi/eski)</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={current.q ?? ""} placeholder="Qidirish..." className={`${selectCls} w-56 pl-9`} />
        </div>
      </div>

      {canFilterRegion ? (
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-muted-foreground">Hudud</label>
          <select name="region" defaultValue={current.region ?? ""} className={`${selectCls} w-48`}>
            <option value="">Barchasi</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col">
        <label className="mb-1 text-xs font-medium text-muted-foreground">Soha (manba)</label>
        <select name="soha" defaultValue={current.soha ?? ""} className={`${selectCls} w-52`}>
          <option value="">Barchasi</option>
          {sohaList.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col">
        <label className="mb-1 text-xs font-medium text-muted-foreground">Kategoriya</label>
        <select name="category" defaultValue={current.category ?? ""} className={`${selectCls} w-56`}>
          <option value="">Barchasi</option>
          {CATEGORIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.short}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col">
        <label className="mb-1 text-xs font-medium text-muted-foreground">Samaradorlik</label>
        <select name="inefficient" defaultValue={current.inefficient ?? ""} className={`${selectCls} w-40`}>
          <option value="">Barchasi</option>
          <option value="1">Samarasiz</option>
          <option value="0">Samarali</option>
        </select>
      </div>

      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        style={{ background: "var(--cobalt)" }}
      >
        <Search className="h-4 w-4" />
        Qidirish
      </button>
      <a
        href="/dashboard/objects"
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50"
      >
        <RotateCcw className="h-4 w-4" />
        Tozalash
      </a>
    </form>
  );
}
