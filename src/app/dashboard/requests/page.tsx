import { ClipboardCheck, History, ExternalLink, ImageIcon, Search, RotateCcw } from "lucide-react";
import type { ChangeRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { listPendingRequests, listRequestHistory, reviewableStages, type RequestFilters } from "@/server/services/assignment";
import { ASSIGNABLE_CATEGORIES, CATEGORY_BY_CODE } from "@/lib/categories";
import { objectHref } from "@/lib/cadastre";
import { RequestRow } from "./RequestRow";

const STATUS_STYLE: Record<ChangeRequestStatus, { label: string; cls: string }> = {
  PENDING_MODERATOR: { label: "Moderatorda", cls: "bg-amber-100 text-amber-800" },
  PENDING_RAHBARIYAT: { label: "Rahbariyatda", cls: "bg-violet-100 text-violet-800" },
  APPROVED: { label: "Tasdiqlangan", cls: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Rad etilgan", cls: "bg-red-100 text-red-800" },
};

const STATUS_OPTIONS: { value: ChangeRequestStatus; label: string }[] = [
  { value: "PENDING_MODERATOR", label: "Moderatorda" },
  { value: "PENDING_RAHBARIYAT", label: "Rahbariyatda" },
  { value: "APPROVED", label: "Tasdiqlangan" },
  { value: "REJECTED", label: "Rad etilgan" },
];

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-cobalt focus:ring-2 focus:ring-cobalt/20";

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

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function RequestsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const canReview = reviewableStages(user.role).length > 0;

  const categoryStr = str(sp.category);
  const categoryCode = categoryStr ? Number(categoryStr) : undefined;
  const regionId = str(sp.region) || undefined;
  const statusRaw = str(sp.status) || undefined;
  const status = statusRaw && statusRaw in STATUS_STYLE ? (statusRaw as ChangeRequestStatus) : undefined;
  const q = str(sp.q)?.trim() || undefined;
  const cad = str(sp.cad)?.trim() || undefined;

  const baseFilters: RequestFilters = { categoryCode, regionId, q, cad };

  // Hudud tanlagichi IJROCHI'ga ko'rsatilmaydi — u har doim faqat o'z hududini ko'radi,
  // filtr befoyda bo'lardi.
  const regions =
    user.role === "IJROCHI"
      ? []
      : await prisma.region.findMany({
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true },
        });

  const [pending, history] = await Promise.all([
    canReview ? listPendingRequests(user, baseFilters) : Promise.resolve([]),
    listRequestHistory(user, { ...baseFilters, status }),
  ]);

  const hasFilters = Boolean(categoryCode || regionId || status || q || cad);

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

      {/* Filtr: kadastr, kategoriya, holat, hudud, so'rovchi — ikkala jadvalga ham (holat faqat tarixga) qo'llanadi. */}
      <form
        method="get"
        action="/dashboard/requests"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-muted-foreground">Kadastr (yangi/eski)</label>
          <input
            name="cad"
            defaultValue={cad ?? ""}
            placeholder="Qidirish..."
            className={`${selectCls} w-48`}
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-muted-foreground">Kategoriya</label>
          <select name="category" defaultValue={categoryStr ?? ""} className={`${selectCls} w-48`}>
            <option value="">Barchasi</option>
            {ASSIGNABLE_CATEGORIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.nameUz}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-muted-foreground">Holat (tarixda)</label>
          <select name="status" defaultValue={statusRaw ?? ""} className={`${selectCls} w-44`}>
            <option value="">Barchasi</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        {regions.length > 0 ? (
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-muted-foreground">Hudud</label>
            <select name="region" defaultValue={regionId ?? ""} className={`${selectCls} w-52`}>
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
          <label className="mb-1 text-xs font-medium text-muted-foreground">So'rovchi</label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Ism yoki login"
            className={`${selectCls} w-44`}
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          style={{ background: "var(--cobalt)" }}
        >
          <Search className="h-4 w-4" />
          Filtrlash
        </button>
        {hasFilters ? (
          <a
            href="/dashboard/requests"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            Tozalash
          </a>
        ) : null}
      </form>

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
                      {hasFilters ? "Filtrga mos so'rov yo'q." : "Kutilayotgan so'rov yo'q."}
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
                    {hasFilters ? "Filtrga mos so'rov yo'q." : "Hozircha so'rov yo'q."}
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
