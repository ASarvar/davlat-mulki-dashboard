import { ClipboardCheck } from "lucide-react";
import { requireRole } from "@/lib/authz";
import { listPendingRequests } from "@/server/services/assignment";
import { CATEGORY_BY_CODE } from "@/lib/categories";
import { objectHref } from "@/lib/cadastre";
import { RequestRow } from "./RequestRow";

export default async function RequestsPage() {
  const user = await requireRole("MODERATOR", "SUPER_ADMIN", "ADMIN");
  const requests = await listPendingRequests(user);

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
        <ClipboardCheck className="h-5 w-5" style={{ color: "var(--gold)" }} />
        Tasdiqlash so'rovlari
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Nazoratchilar yuborgan kategoriya biriktirish so'rovlari. Tasdiqlansa kategoriya qo'llanadi.
      </p>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Obyekt</th>
              <th className="px-4 py-3 font-medium">Kategoriya</th>
              <th className="px-4 py-3 font-medium">So'rovchi</th>
              <th className="px-4 py-3 font-medium">Hujjat</th>
              <th className="px-4 py-3 font-medium">Amal</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Kutilayotgan so'rov yo'q.
                </td>
              </tr>
            ) : (
              requests.map((r) => (
                <RequestRow
                  key={r.id}
                  req={{
                    id: r.id,
                    cadNumber: r.property.cadNumber,
                    regionName: r.property.region.name,
                    requestedBy: r.requestedBy.fullName,
                    toCategoryName: CATEGORY_BY_CODE.get(r.toCategory)?.nameUz ?? String(r.toCategory),
                    note: r.note,
                    documentId: r.document?.id ?? null,
                    documentName: r.document?.fileName ?? null,
                    createdAt: r.createdAt.toLocaleString("uz"),
                    objectHref: objectHref(r.property.cadNumber),
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
