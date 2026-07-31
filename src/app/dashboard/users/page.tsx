import { Users, UserPlus, Search, RotateCcw } from "lucide-react";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sourceScopeLabel } from "@/lib/sourceLabel";
import { requireRole, isAdmin } from "@/lib/authz";
import { listUsers } from "@/server/services/users";
import { ROLE_LABEL } from "@/lib/roles";
import { CreateUserForm } from "./CreateUserForm";
import { UserRow } from "./UserRow";

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-cobalt focus:ring-2 focus:ring-cobalt/20";

export default async function UsersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireRole("SUPER_ADMIN", "ADMIN");
  const sp = await searchParams;

  const sourceId = str(sp.source) || undefined;
  const roleRaw = str(sp.role);
  const role = roleRaw && roleRaw in Role ? (roleRaw as Role) : undefined;

  // ADMIN Super adminni ko'rmaydi.
  const hideSuperAdmin = actor.role === "ADMIN";
  // Filtr uchun rollar (Admin uchun SUPER_ADMIN yashiriladi).
  const roleFilterOptions = (Object.keys(ROLE_LABEL) as Role[]).filter((r) => !(hideSuperAdmin && r === "SUPER_ADMIN"));

  const [users, sourceRows, activeAdmins] = await Promise.all([
    listUsers({ sourceId, role, hideSuperAdmin }),
    // Tashkilotlar — soha bo'yicha, keyin hudud tartibida (respublika darajasidagilar oxirida).
    prisma.organizationSource.findMany({
      orderBy: [{ name: "asc" }, { region: { sortOrder: "asc" } }],
      select: { id: true, name: true, orgName: true, region: { select: { name: true } } },
    }),
    prisma.user.count({ where: { role: "SUPER_ADMIN", isActive: true } }),
  ]);
  const sources = sourceRows.map((s) => ({
    id: s.id,
    name: s.name,
    orgName: s.orgName,
    regionName: s.region?.name ?? null,
  }));

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
        <Users className="h-5 w-5" style={{ color: "var(--gold)" }} />
        Foydalanuvchilar
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Tizim yopiq — foydalanuvchi faqat shu yerdan qo'shiladi, ochiq ro'yxatdan o'tish yo'q.
      </p>

      <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--navy)" }}>
          <UserPlus className="h-4 w-4" style={{ color: "var(--gold)" }} />
          Yangi foydalanuvchi
        </h2>
        <CreateUserForm sources={sources} isSuperAdmin={actor.role === "SUPER_ADMIN"} />
      </div>

      {/* Filtr */}
      <form
        method="get"
        action="/dashboard/users"
        className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-muted-foreground">Tashkilot</label>
          <select name="source" defaultValue={sourceId ?? ""} className={`${selectCls} w-64`}>
            <option value="">Barchasi</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {sourceScopeLabel(s.name, s.regionName)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-muted-foreground">Rol</label>
          <select name="role" defaultValue={role ?? ""} className={`${selectCls} w-52`}>
            <option value="">Barchasi</option>
            {roleFilterOptions.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
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
          href="/dashboard/users"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <RotateCcw className="h-4 w-4" />
          Tozalash
        </a>
        <span className="ml-auto text-sm text-muted-foreground">{users.length} ta foydalanuvchi</span>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Foydalanuvchi</th>
              <th className="px-4 py-3 font-medium" colSpan={2}>
                Rol / hudud / amallar
              </th>
              <th className="px-4 py-3 font-medium">Holat</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  Bunday foydalanuvchi topilmadi.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <UserRow
                  key={u.id}
                  sources={sources}
                  currentUserId={actor.id}
                  canManageAdmins={actor.role === "SUPER_ADMIN"}
                  isLastSuperAdmin={u.role === "SUPER_ADMIN" && u.isActive && activeAdmins <= 1}
                  user={{
                    id: u.id,
                    username: u.username,
                    fullName: u.fullName,
                    role: u.role,
                    isActive: u.isActive,
                    sourceId: u.source?.id ?? null,
                    sourceLabel: u.source
                      ? `${u.source.name} — ${sourceScopeLabel(u.source.name, u.source.region?.name)}`
                      : null,
                    allSources: u.allSources,
                    moderatorSourceIds: u.moderatorSources.map((m) => m.sourceId),
                    activityCount: u._count.documents + u._count.assignments + u._count.requestedChanges,
                  }}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
