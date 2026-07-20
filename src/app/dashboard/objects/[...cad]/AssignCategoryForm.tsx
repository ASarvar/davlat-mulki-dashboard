"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { MANUAL_CATEGORIES } from "@/lib/categories";
import { assignCategoryAction, type AssignState } from "../actions";

export function AssignCategoryForm({ cadNumber }: { cadNumber: string }) {
  const [state, formAction, pending] = useActionState<AssignState, FormData>(assignCategoryAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="cadNumber" value={cadNumber} />

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Kategoriya (5–10)</label>
        <select name="categoryCode" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">Tanlang...</option>
          {MANUAL_CATEGORIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}. {c.nameUz}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Izoh (ixtiyoriy)</label>
        <textarea name="note" rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Asoslovchi hujjat (PDF)</label>
        <input
          type="file"
          name="file"
          accept="application/pdf"
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">Qo'lda kategoriyalar uchun PDF majburiy. Maks: 20MB.</p>
      </div>

      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      {state.ok ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saqlandi ✓</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
        style={{ background: "var(--navy)" }}
      >
        <Save className="h-4 w-4" />
        {pending ? "Saqlanmoqda..." : "Biriktirish"}
      </button>
    </form>
  );
}
