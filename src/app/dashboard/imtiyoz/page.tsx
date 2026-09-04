import Link from "next/link";
import { AlertTriangle, BadgePercent, History } from "lucide-react";
import { requireSection } from "@/server/services/sectionAccess";
import { imtiyozConfigured } from "@/server/integrations/imtiyoz";
import { CheckForm } from "./CheckForm";

/**
 * Ijara imtiyozi (ПҚ-3782) — tekshirish sahifasi.
 *
 * Qoida: mehnat shartnomasi asosida ishlayotgan xodimlarning kamida 30% ini
 * nogironligi bo'lgan shaxslar tashkil etsa, ijara to'lovi auksion natijasi
 * bo'yicha belgilangan summaning 50% i miqdorida belgilanadi.
 */
export default async function ImtiyozPage() {
  const user = await requireSection("imtiyoz");
  const operator = user ? `${user.name ?? ""} (${user.username ?? ""})`.trim() : "";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1
            className="mb-1 flex items-center gap-2 text-xl font-bold tracking-tight"
            style={{ color: "var(--navy)" }}
          >
            <BadgePercent className="h-5 w-5" style={{ color: "var(--gold)" }} />
            Ijara imtiyozi
          </h1>
          <p className="text-sm text-muted-foreground">
            ПҚ-3782 bo&apos;yicha 50% lik ijara imtiyozini tekshirish. Xodimlar ro&apos;yxati Soliq
            bazasidan, nogironlik holati esa TIEK reyestridan olinadi.
          </p>
        </div>
        <Link
          href="/dashboard/imtiyoz/tarix"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <History className="h-4 w-4" />
          Tekshiruvlar tarixi
        </Link>
      </div>

      {!imtiyozConfigured() ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Imtiyoz API&apos;lari sozlanmagan.</strong> `.env` da{" "}
            <code>IMTIYOZ_COMP_WORKERS_URL</code>, <code>IMTIYOZ_YATT_WORKERS_URL</code> va{" "}
            <code>IMTIYOZ_TIEK_URL</code> ko&apos;rsatilishi kerak.
          </p>
        </div>
      ) : null}

      <CheckForm operator={operator} />
    </div>
  );
}
