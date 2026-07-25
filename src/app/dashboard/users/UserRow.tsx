"use client";

import { useActionState, useState } from "react";
import { Save, KeyRound, Trash2 } from "lucide-react";
import type { Role } from "@prisma/client";
import { ASSIGNABLE_ROLES, ROLE_LABEL, regionMode } from "@/lib/roles";
import { updateUserAction, resetPasswordAction, deleteUserAction, type UserFormState } from "./actions";
import { RegionPicker } from "./RegionPicker";

export interface UserRowData {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  regionId: string | null;
  regionName: string | null;
  allRegions: boolean;
  moderatorRegionIds: string[];
  /** Hujjat/biriktirish/so'rov soni — 0 bo'lmasa o'chirib bo'lmaydi (audit izi). */
  activityCount: number;
}

export function UserRow({
  user,
  regions,
  currentUserId,
  canManageAdmins,
  isLastSuperAdmin,
}: {
  user: UserRowData;
  regions: { id: string; name: string }[];
  currentUserId: string;
  /** SUPER_ADMIN bo'lsa true — Admin rolini bera oladi va super adminlarni boshqaradi. */
  canManageAdmins: boolean;
  /** Bu yagona faol super admin bo'lsa — o'chirish/pasaytirish bloklanadi. */
  isLastSuperAdmin: boolean;
}) {
  const [updState, updAction, updPending] = useActionState<UserFormState, FormData>(updateUserAction, {});
  const [pwdState, pwdAction, pwdPending] = useActionState<UserFormState, FormData>(resetPasswordAction, {});
  const [delState, delAction, delPending] = useActionState<UserFormState, FormData>(deleteUserAction, {});
  const [role, setRole] = useState<Role>(user.role);
  const [showPwd, setShowPwd] = useState(false);

  // Super admin qatorini faqat super admin tahrirlaydi.
  const readOnly = user.role === "SUPER_ADMIN" && !canManageAdmins;
  const roleChoices = ASSIGNABLE_ROLES.filter((r) => canManageAdmins || r.value !== "ADMIN");

  const isSelf = user.id === currentUserId;
  const hasActivity = user.activityCount > 0;

  // O'chirib bo'lmaydigan holatlar — tugmani faol ko'rsatib, keyin xato bermaymiz.
  const blockReason = isSelf
    ? "O'z hisobingizni o'chira olmaysiz"
    : isLastSuperAdmin
      ? "Tizimdagi yagona faol super admin — o'chirib bo'lmaydi"
      : readOnly
        ? "Super adminni faqat super admin boshqaradi"
        : hasActivity
          ? `${user.activityCount} ta yozuvi bor — o'chirib bo'lmaydi, "Faol" belgisini oling`
          : null;

  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="px-4 py-3">
        <p className="font-medium">{user.fullName}</p>
        <p className="text-xs text-muted-foreground">
          {user.username} · {ROLE_LABEL[user.role]}
        </p>
      </td>

      <td className="px-4 py-3" colSpan={2}>
        {readOnly ? (
          <p className="text-xs text-muted-foreground">Tahrirlash uchun ruxsat yo'q.</p>
        ) : (
          <form action={updAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="userId" value={user.id} />
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              {/* Joriy rol super admin bo'lsa uni ham ko'rsatamiz (super admin ko'radi) */}
              {user.role === "SUPER_ADMIN" ? <option value="SUPER_ADMIN">Super admin</option> : null}
              {roleChoices.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            <div className="min-w-[200px]">
              <RegionPicker
                mode={regionMode(role)}
                regions={regions}
                initialRegionId={user.regionId}
                initialAllRegions={user.allRegions}
                initialModeratorRegionIds={user.moderatorRegionIds}
              />
            </div>

            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input type="checkbox" name="isActive" defaultChecked={user.isActive} className="h-4 w-4" />
              Faol
            </label>

            <button
              type="submit"
              disabled={updPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              {updPending ? "..." : "Saqlash"}
            </button>

            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Parol
            </button>
          </form>
        )}

        {updState.error ? <p className="mt-1 text-xs text-red-700">{updState.error}</p> : null}
        {updState.ok ? <p className="mt-1 text-xs text-emerald-700">Saqlandi ✓</p> : null}

        {/* O'chirish — faoliyati bo'lmagan userlar uchun. Audit izi bo'lsa bloklash tavsiya etiladi. */}
        <form
          action={delAction}
          className="mt-2"
          onSubmit={(e) => {
            if (!confirm(`"${user.fullName}" (${user.username}) butunlay o'chirilsinmi?\n\nBu amalni qaytarib bo'lmaydi.`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="userId" value={user.id} />
          <button
            type="submit"
            disabled={delPending || blockReason !== null}
            title={blockReason ?? "Foydalanuvchini o'chirish"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1 text-sm text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-white"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {delPending ? "..." : "O'chirish"}
          </button>
          {blockReason ? <span className="ml-2 text-xs text-muted-foreground">{blockReason}</span> : null}
          {delState.error ? <p className="mt-1 text-xs text-red-700">{delState.error}</p> : null}
        </form>

        {showPwd ? (
          <form action={pwdAction} className="mt-2 flex items-center gap-2">
            <input type="hidden" name="userId" value={user.id} />
            <input
              name="password"
              type="text"
              required
              minLength={8}
              placeholder="Yangi parol (8+ belgi)"
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
            <button
              type="submit"
              disabled={pwdPending}
              className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-60"
            >
              {pwdPending ? "..." : "Parolni yangilash"}
            </button>
            {pwdState.error ? <span className="text-xs text-red-700">{pwdState.error}</span> : null}
            {pwdState.ok ? <span className="text-xs text-emerald-700">Yangilandi ✓</span> : null}
          </form>
        ) : null}
      </td>

      <td className="px-4 py-3">
        {user.isActive ? (
          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Faol</span>
        ) : (
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Bloklangan</span>
        )}
      </td>
    </tr>
  );
}
