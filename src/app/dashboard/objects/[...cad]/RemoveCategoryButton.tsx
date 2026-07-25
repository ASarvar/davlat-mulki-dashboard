"use client";

import { useActionState } from "react";
import { Undo2 } from "lucide-react";
import { removeCategoryAction, type AssignState } from "../actions";

export function RemoveCategoryButton({ cadNumber }: { cadNumber: string }) {
  const [state, formAction, pending] = useActionState<AssignState, FormData>(removeCategoryAction, {});

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("Kategoriya belgisini olib tashlaysizmi? Obyekt yana \"Bo'sh turgan\"ga qaytadi.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="cadNumber" value={cadNumber} />
      {state.error ? <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      {state.ok ? <p className="mb-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Olib tashlandi ✓</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
      >
        <Undo2 className="h-4 w-4" />
        {pending ? "Bekor qilinmoqda..." : "Kategoriyani olib tashlash"}
      </button>
    </form>
  );
}
