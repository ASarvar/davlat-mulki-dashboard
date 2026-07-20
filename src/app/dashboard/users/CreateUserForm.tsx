"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import { createUserAction, type UserFormState } from "./actions";

const ROLES = [
  { value: "SUPER_ADMIN", label: "Super admin — tizim egasi" },
  { value: "REGION_USER", label: "Hudud foydalanuvchisi — kategoriya + PDF" },
  { value: "VIEWER", label: "Kuzatuvchi — faqat ko'rish" },
];

export function CreateUserForm({ regions }: { regions: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(createUserAction, {});
  const [role, setRole] = useState("REGION_USER");

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">F.I.SH</label>
        <input name="fullName" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
        <input name="email" type="email" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Parol</label>
        <input name="password" type="text" required minLength={8} placeholder="kamida 8 belgi" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Rol</label>
        <select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {role === "REGION_USER" ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Hudud</label>
          <select name="regionId" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Tanlang...</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="md:col-span-2">
        {state.error ? <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
        {state.ok ? <p className="mb-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Foydalanuvchi yaratildi ✓</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--navy)" }}
        >
          <UserPlus className="h-4 w-4" />
          {pending ? "Yaratilmoqda..." : "Foydalanuvchi qo'shish"}
        </button>
      </div>
    </form>
  );
}
