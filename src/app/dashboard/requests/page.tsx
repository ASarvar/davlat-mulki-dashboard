import { ClipboardCheck, History, ExternalLink, ImageIcon } from "lucide-react";
import type { ChangeRequestStatus } from "@prisma/client";
import { requireUser } from "@/lib/authz";
import { listPendingRequests, listRequestHistory, reviewableStages } from "@/server/services/assignment";
import { CATEGORY_BY_CODE } from "@/lib/categories";
import { objectHref } from "@/lib/cadastre";
import { RequestRow } from "./RequestRow";

const STATUS_STYLE: Record<ChangeRequestStatus, { label: string; cls: string }> = {
  PENDING_MODERATOR: { label: "Moderatorda", cls: "bg-amber-100 text-amber-800" },
  PENDING_RAHBARIYAT: { label: "Rahbariyatda", cls: "bg-violet-100 text-violet-800" },
  APPROVED: { label: "Tasdiqlangan", cls: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Rad etilgan", cls: "bg-red-100 text-red-800" },
};

// Bosqich qarori: kim + izoh (izoh rad etishda majburiy bo'lgani uchun doim mazmunli).
function Decision({ name, note }: { name: string | null; note: string | null }) {
  if (!name) return <span className="text-muted-foreground">—</span>;
  return (
    <div>
      <p>{name}</p>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

export default async function RequestsPage() {
  const user = await requireUser();
  const canReview = reviewableStages(user.role).length > 0;

  const [pending, history] = await Promise.all([
    canReview ? listPendingRequests(user) : Promise.resolve([]),
    listRequestHistory(user),
  ]);

  const hint =
    user.role === "MODERATOR"
      ? "Ijrochilar yuborgan so'rovlar. Obyektni o'rganib qabul qiling — so'ng rahbariyat yakuniy qaror qabul qiladi."
      : user.role === "RAHBARIYAT"
        ? "Moderator qabul qilgan so'rovlar. Tasdiqlansa kategoriya darhol qo'llanadi."
        : user.role === "IJROCHI"
          ? "Siz yuborgan so'rovlar va ular qaysi bosqichda ekani."
          : "Barcha bosqichdagi kutilayotgan so'rovlar va to'liq tarix.";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-1 flex items-center gap-2 text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
          <ClipboardCheck className="h-5 w-5" style={{ color: "var(--gold)" }} />
          Tasdiqlash so'rovlari
        </h1>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>

      {canReview ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Ko'rib chiqish kutilmoqda ({pending.length})
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Obyekt</th>
                  <th className="px-4 py-3 font-medium">Bosqich</th>
                  <th className="px-4 py-3 font-medium">Kategoriya</th>
                  <th className="px-4 py-3 font-medium">So'rovchi</th>
                  <th className="px-4 py-3 font-medium">Hujjatlar</th>
                  <th className="px-4 py-3 font-medium">Amal</th>
                </tr>
              </thead>
              <tbody>
                {pending.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      Kutilayotgan so'rov yo'q.
                    </td>
                  </tr>
                ) : (
                  pending.map((r) => (
                    <RequestRow
                      key={r.id}
                      req={{
                        id: r.id,
                        stage: r.status as "PENDING_MODERATOR" | "PENDING_RAHBARIYAT",
                        cadNumber: r.property.cadNumber,
                        regionName: r.property.region.name,
                        requestedBy: r.requestedBy.fullName,
                        moderatorName: r.moderator?.fullName ?? null,
                        toCategoryName: CATEGORY_BY_CODE.get(r.toCategory)?.nameUz ?? String(r.toCategory),
                        note: r.note,
                        documentId: r.document?.id ?? null,
                        documentName: r.document?.fileName ?? null,
                        images: r.document?.children ?? [],
                        createdAt: r.createdAt.toLocaleString("uz"),
                        objectHref: objectHref(r.property.cadNumber),
                      }}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <History className="h-4 w-4" />
          So'rovlar tarixi ({history.length})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Obyekt</th>
                <th className="px-4 py-3 font-medium">Kategoriya</th>
                <th className="px-4 py-3 font-medium">Holat</th>
                <th className="px-4 py-3 font-medium">So'rovchi</th>
                <th className="px-4 py-3 font-medium">Moderator</th>
                <th className="px-4 py-3 font-medium">Rahbariyat</th>
                <th className="px-4 py-3 font-medium">Hujjatlar</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Hozircha so'rov yo'q.
                  </td>
                </tr>
              ) : (
                history.map((r) => {
                  const st = STATUS_STYLE[r.status];
                  return (
                    <tr key={r.id} className="border-b border-border align-top last:border-0">
                      <td className="px-4 py-3">
                        <a
                          href={objectHref(r.property.cadNumber)}
                          className="font-medium hover:underline"
                          style={{ color: "var(--cobalt)" }}
                        >
                          {r.property.cadNumber}
                        </a>
                        <p className="text-xs text-muted-foreground">{r.property.region.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {CATEGORY_BY_CODE.get(r.toCategory)?.nameUz ?? r.toCategory}
                        </p>
                        {r.note ? <p className="text-xs text-muted-foreground">{r.note}</p> : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.requestedBy.fullName}
                        <p className="text-xs text-muted-foreground">{r.createdAt.toLocaleString("uz")}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Decision name={r.moderator?.fullName ?? null} note={r.moderatorNote} />
                      </td>
                      <td className="px-4 py-3">
                        <Decision name={r.rahbar?.fullName ?? null} note={r.rahbarNote} />
                      </td>
                      <td className="px-4 py-3">
                        {r.document ? (
                          <>
                            <a
                              href={`/api/documents/${r.document.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs hover:underline"
                              style={{ color: "var(--cobalt)" }}
                            >
                              PDF <ExternalLink className="h-3 w-3" />
                            </a>
                            {r.document.children.map((img, i) => (
                              <a
                                key={img.id}
                                href={`/api/documents/${img.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-xs hover:underline"
                                style={{ color: "var(--cobalt)" }}
                              >
                                <ImageIcon className="h-3 w-3" />
                                Rasm {i + 1}
                              </a>
                            ))}
                          </>
                        ) : (
                          // Rad etilganda hujjatlar o'chiriladi — shuning uchun bo'sh bo'lishi normal.
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
