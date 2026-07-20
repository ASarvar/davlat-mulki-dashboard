"use client";

import { useActionState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { createSourceAction, updateSourceAction, deleteSourceAction, type SourceState } from "./actions";

export function CreateSourceForm({ regions }: { regions: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<SourceState, FormData>(createSourceAction, {});

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col">
        <label className="mb-1 text-xs text-muted-foreground">Hudud</label>
        <select name="regionId" required className="w-52 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Tanlang...</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col">
        <label className="mb-1 text-xs text-muted-foreground">Manba nomi</label>
        <input name="name" required defaultValue="Ijara markazi" className="w-52 rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col">
        <label className="mb-1 text-xs text-muted-foreground">STIR (9 raqam)</label>
        <input name="stir" required inputMode="numeric" pattern="\d{9}" placeholder="123456789" className="w-40 rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
        style={{ background: "var(--navy)" }}
      >
        <Plus className="h-4 w-4" />
        {pending ? "..." : "Qo'shish"}
      </button>
      {state.error ? <span className="text-sm text-red-700">{state.error}</span> : null}
      {state.ok ? <span className="text-sm text-emerald-700">Qo'shildi ✓</span> : null}
    </form>
  );
}

export interface SourceRowData {
  id: string;
  name: string;
  stir: string;
  isActive: boolean;
  regionName: string;
  propertyCount: number;
}

export function SourceRow({ source }: { source: SourceRowData }) {
  const [state, action, pending] = useActionState<SourceState, FormData>(updateSourceAction, {});
  const [delState, delAction, delPending] = useActionState<SourceState, FormData>(deleteSourceAction, {});

  // Obyektlari bor manbani o'chirsa, obyektlar ham yo'qolardi (Property.sourceId majburiy).
  const hasProperties = source.propertyCount > 0;

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3">{source.regionName}</td>
      <td className="px-4 py-3" colSpan={3}>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="sourceId" value={source.id} />
          <input name="name" defaultValue={source.name} className="w-44 rounded-md border border-slate-300 px-2 py-1 text-sm" />
          <input
            name="stir"
            defaultValue={source.stir}
            inputMode="numeric"
            pattern="\d{9}"
            className="w-32 rounded-md border border-slate-300 px-2 py-1 font-mono text-sm"
          />
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            <input type="checkbox" name="isActive" defaultChecked={source.isActive} className="h-4 w-4" />
            Faol
          </label>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            {pending ? "..." : "Saqlash"}
          </button>
          {state.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
          {state.ok ? <span className="text-xs text-emerald-700">✓</span> : null}
        </form>

        <form
          action={delAction}
          className="mt-2"
          onSubmit={(e) => {
            if (!confirm(`"${source.name}" (STIR ${source.stir}) manbasi o'chirilsinmi?\n\nBu amalni qaytarib bo'lmaydi.`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="sourceId" value={source.id} />
          <button
            type="submit"
            disabled={delPending || hasProperties}
            title={
              hasProperties
                ? `${source.propertyCount} ta obyekt bog'langan — o'chirib bo'lmaydi, "Faol" belgisini oling`
                : "Manbani o'chirish"
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1 text-sm text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-white"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {delPending ? "..." : "O'chirish"}
          </button>
          {hasProperties ? (
            <span className="ml-2 text-xs text-muted-foreground">obyektlari bor — bloklang</span>
          ) : null}
          {delState.error ? <p className="mt-1 text-xs text-red-700">{delState.error}</p> : null}
        </form>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{source.propertyCount}</td>
    </tr>
  );
}
