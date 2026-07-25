"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import type { Role } from "@prisma/client";
import { ASSIGNABLE_ROLES, regionMode } from "@/lib/roles";
import { createUserAction, type UserFormState } from "./actions";
import { RegionPicker } from "./RegionPicker";

export function CreateUserForm({
  regions,
  isSuperAdmin,
}: {
  regions: { id: string; name: string }[];
  isSuperAdmin: boolean;
}) {
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(createUserAction, {});
  const [role, setRole] = useState<Role>("IJROCHI");

  // ADMIN faqat Moderator/Nazoratchi/Kuzatuvchi yaratadi (Admin rolini super admin beradi).
  const roleOptions = ASSIGNABLE_ROLES.filter((r) => isSuperAdmin || r.value !== "ADMIN");

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">F.I.SH</label>
        <input name="fullName" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Login</label>
        <input
          name="username"
          required
          autoComplete="off"
          placeholder="masalan: nazoratchi_and"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
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
          onChange={(e) => setRole(e.target.value as Role)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {roleOptions.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label} — {r.desc}
            </option>
          ))}
        </select>
      </div>

      <RegionPicker mode={regionMode(role)} regions={regions} />

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
