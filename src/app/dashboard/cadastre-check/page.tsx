import { FileSearch, Search, AlertTriangle, ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/authz";
import { fetchPropertyBase } from "@/server/integrations/api2";
import { API2 } from "@/server/integrations/config";
import { objectHref } from "@/lib/cadastre";
import { prisma } from "@/lib/prisma";
import { JsonView } from "./JsonView";

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const inputCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-cobalt focus:ring-2 focus:ring-cobalt/20";

/**
 * Kadastrni tekshirish — API 2 (UZKAD) ga JONLI so'rov yuborib, xom javobni
 * JSON ko'rinishida ko'rsatadi. Faqat admin uchun: tashqi API'ga to'g'ridan-to'g'ri
 * murojaat qiladi va javobda ichki maydonlar bo'ladi.
 *
 * ⚠️ Bazaga HECH NARSA yozmaydi — bu diagnostika vositasi. Obyektni yangilash uchun
 * obyekt sahifasidagi "API orqali yangilash" yoki Sinxronizatsiya sahifasi ishlatiladi.
 */
export default async function CadastreCheckPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const sp = await searchParams;
  const cad = str(sp.cad)?.trim() || undefined;

  const result = cad ? await fetchPropertyBase(cad).catch((e: unknown) => ({
    ok: false as const,
    reason: e instanceof Error ? e.message : "Noma'lum xato",
  })) : null;

  // Bazada shu kadastr bormi — bo'lsa obyekt sahifasiga havola beramiz.
  const existing = cad
    ? await prisma.property.findUnique({ where: { cadNumber: cad }, select: { cadNumber: true } })
    : null;

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
        <FileSearch className="h-5 w-5" style={{ color: "var(--gold)" }} />
        Kadastrni tekshirish
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Kadastr raqami bo&apos;yicha API 2 (UZKAD) ga jonli so&apos;rov yuboriladi va xom javob
        to&apos;liq ko&apos;rsatiladi. Bazaga hech narsa yozilmaydi.
      </p>

      {!API2.baseUrl ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>API2_BASE_URL sozlanmagan.</strong> Tekshirish ishlashi uchun `.env` da API 2
            manzilini ko&apos;rsating.
          </p>
        </div>
      ) : null}

      <form
        method="get"
        action="/dashboard/cadastre-check"
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-muted-foreground">Kadastr raqami</label>
          <input
            name="cad"
            defaultValue={cad ?? ""}
            required
            autoFocus
            placeholder="17:15:40:01:02:0184"
            className={`${inputCls} w-72 font-mono`}
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          style={{ background: "var(--cobalt)" }}
        >
          <Search className="h-4 w-4" />
          Tekshirish
        </button>
        {existing ? (
          <a
            href={objectHref(existing.cadNumber)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            Obyekt sahifasi
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : cad ? (
          <span className="self-center text-xs text-muted-foreground">Bu kadastr bazada yo&apos;q</span>
        ) : null}
      </form>

      {result === null ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
          Kadastr raqamini kiriting.
        </p>
      ) : result.ok ? (
        <JsonView json={JSON.stringify(result.data.raw, null, 2)} />
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">API 2 javob bermadi</p>
            <p className="mt-0.5">{result.reason}</p>
          </div>
        </div>
      )}
    </div>
  );
}
