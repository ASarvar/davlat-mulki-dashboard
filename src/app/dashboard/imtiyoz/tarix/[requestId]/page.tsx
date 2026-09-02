import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Archive } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { getCheckAsResult } from "@/server/services/imtiyoz/audit";
import { ResultView } from "../../ResultView";

/**
 * Saqlangan tekshiruvning arxiv nusxasi.
 *
 * ⚠️ Jonli natija bilan AYNAN bir xil komponentda (`ResultView`) chiziladi — shu
 * sababli arxiv hech qachon jonli ko'rinishdan ajralib qolmaydi. `readonly: true`
 * bo'lgani uchun "Qayta tekshirish" tugmasi chiqmaydi: bu sahifa tashqi bazalarga
 * hech qachon murojaat qilmaydi.
 */
export default async function ImtiyozArchivePage({ params }: { params: Promise<{ requestId: string }> }) {
  await requireUser();
  const { requestId } = await params;
  const data = await getCheckAsResult(requestId);
  if (!data) notFound();

  return (
    <div>
      <Link
        href="/dashboard/imtiyoz/tarix"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-slate-700 print:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        Tarixga qaytish
      </Link>

      <h1 className="mb-1 flex items-center gap-2 text-xl font-bold tracking-tight" style={{ color: "var(--navy)" }}>
        <Archive className="h-5 w-5" style={{ color: "var(--gold)" }} />
        Saqlangan natija
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Bu — tekshiruv paytida qanday javob berilgan bo&apos;lsa, o&apos;shaning o&apos;zgarmagan nusxasi.
      </p>

      <ResultView data={data} opts={{ readonly: true }} />
    </div>
  );
}
